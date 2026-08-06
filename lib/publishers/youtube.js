// lib/publishers/youtube.js
//
// PREREQUISITE (not code — a one-time setup step on your end):
// 1. Create an OAuth2 Client ID in Google Cloud Console, enable "YouTube Data API v3".
// 2. Run the OAuth consent flow once for your channel to get a refresh_token.
// 3. Store { access_token, refresh_token, token_expires_at } on the
//    social_channels_v2 row for platform='youtube'.
// Without that, this adapter has nothing to authenticate with — no amount
// of code here substitutes for that consent step, which only you can do.

import { google } from 'googleapis';
import { Readable } from 'stream';
import { PublishError } from './base';
import { generateWithFallback } from '@/lib/llmFallbackChain';
import { parseJsonFromText } from '@/lib/robustJsonParse';

function getOAuthClient(channel) {
  const client = new google.auth.OAuth2(
    process.env.YOUTUBE_CLIENT_ID,
    process.env.YOUTUBE_CLIENT_SECRET,
    process.env.YOUTUBE_REDIRECT_URI
  );
  client.setCredentials({
    access_token: channel.access_token,
    refresh_token: channel.refresh_token,
  });
  return client;
}

export async function refreshYouTubeToken(channel) {
  const client = getOAuthClient(channel);
  const { credentials } = await client.refreshAccessToken();
  return {
    access_token: credentials.access_token,
    token_expires_at: new Date(credentials.expiry_date).toISOString(),
  };
}

/**
 * Generate AI thumbnail from thumbnail_brief using available image generation.
 * Falls back to branded thumbnail if AI generation fails.
 */
async function generateThumbnailFromBrief(thumbnailBrief, title, category) {
  if (!thumbnailBrief) return null;
  
  try {
    // Try to generate image using LLM that supports image generation
    const prompt = `Generate an image based on this thumbnail concept: "${thumbnailBrief}". 
    The image should be bold, high-contrast, suitable for a YouTube thumbnail.
    Text overlay: "${title}"
    Style: Educational, engaging, professional but eye-catching.
    
    Return JSON with image_url if your model supports image generation, or null if not.`;
    
    const { result } = await generateWithFallback(
      prompt,
      (text) => parseJsonFromText(text, 'object'),
      (parsed) => parsed && typeof parsed === 'object',
      2048
    );
    
    if (result?.image_url) {
      const response = await fetch(result.image_url);
      if (response.ok) {
        return Buffer.from(await response.arrayBuffer());
      }
    }
  } catch (err) {
    console.warn('AI thumbnail generation failed:', err.message);
  }
  
  // Fallback: use existing branded thumbnail generator
  try {
    const { createFallbackThumbnail, IMAGE_PRESETS } = await import('@/lib/image-engine');
    const youtubePreset = { width: 1280, height: 720 }; // YouTube thumbnail size
    return await createFallbackThumbnail(title, category, youtubePreset);
  } catch (fallbackErr) {
    console.warn('Branded thumbnail fallback failed:', fallbackErr.message);
    return null;
  }
}

/**
 * Build SEO-optimized description with hashtags integrated naturally.
 * Includes CTA and keyword-rich content.
 */
function buildDescription(metadata, contentAsset) {
  const baseDescription = metadata.description || contentAsset.body || '';
  const hashtags = metadata.hashtags || [];
  const tags = metadata.tags || [];
  
  // Add hashtags at the end (YouTube displays first 3 hashtags above title)
  let description = baseDescription;
  
  if (!description.includes('\n\n') && hashtags.length > 0) {
    description += '\n\n';
  }
  
  // Add visible hashtags (first 3 appear above video title)
  const visibleHashtags = hashtags.slice(0, 3);
  if (visibleHashtags.length > 0) {
    description += visibleHashtags.join(' ') + '\n\n';
  }
  
  // Add remaining hashtags below fold
  const remainingHashtags = hashtags.slice(3);
  if (remainingHashtags.length > 0) {
    description += '\n---\n' + remainingHashtags.join(' ');
  }
  
  // Add CTA if not present
  if (!description.toLowerCase().includes('subscribe') && !description.toLowerCase().includes('cta')) {
    description += '\n\n🔔 Subscribe to Shiney Brain Academy for more educational content!';
  }
  
  return description;
}

/**
 * Enhance tags with relevant keywords and trending terms.
 */
function buildTags(metadata, contentAsset, keyword) {
  const baseTags = metadata.tags || [];
  const enhancedTags = new Set(baseTags.map(t => t.toLowerCase()));
  
  // Add keyword-based tags
  if (keyword) {
    enhancedTags.add(keyword.toLowerCase());
    enhancedTags.add(`learn ${keyword}`.toLowerCase());
    enhancedTags.add(`${keyword} explained`.toLowerCase());
  }
  
  // Add educational/trending tags
  const evergreenTags = [
    'education',
    'learning',
    'study tips',
    'academic success',
    'shiney brain academy',
    'educational content',
    'online learning',
  ];
  
  evergreenTags.forEach(tag => enhancedTags.add(tag));
  
  // Limit to YouTube's 500 character tag limit
  let totalLength = 0;
  const finalTags = [];
  for (const tag of enhancedTags) {
    if (totalLength + tag.length + 1 <= 500) {
      finalTags.push(tag);
      totalLength += tag.length + 1;
    } else {
      break;
    }
  }
  
  return finalTags;
}

export async function publishYouTube(channel, contentAsset, media = []) {
  const video = media.find((m) => m.media_type === 'video');
  if (!video) throw new PublishError('YouTube requires a video file', { retryable: false });

  const auth = getOAuthClient(channel);
  const youtube = google.youtube({ version: 'v3', auth });

  const videoRes = await fetch(video.url);
  if (!videoRes.ok) throw new PublishError('Could not fetch rendered video for upload');
  if (!videoRes.body) throw new PublishError('Rendered video response had no body');
  // fetch() returns a Web Streams ReadableStream, but googleapis' upload
  // machinery calls .pipe() on media.body, which only exists on Node.js
  // streams. Convert before handing it off, or uploads fail with
  // "t.body.pipe is not a function".
  const videoStream = Readable.fromWeb(videoRes.body);

  // Extract metadata with defaults
  const metadata = contentAsset.metadata || {};
  const privacyStatus = metadata.privacyStatus || 'public'; // 'public' | 'private' | 'unlisted'
  const categoryId = metadata.categoryId || '27'; // Education default
  const playlistId = metadata.playlistId || null;
  
  // Get keyword from knowledge asset for tag enhancement
  const keyword = contentAsset.keyword || '';
  
  // Build enhanced metadata
  const seoTitle = metadata.title || contentAsset.title || 'Educational Video';
  const seoDescription = buildDescription(metadata, contentAsset);
  const seoTags = buildTags(metadata, contentAsset, keyword);
  
  let insertResult;
  try {
    insertResult = await youtube.videos.insert({
      part: ['snippet', 'status'],
      requestBody: {
        snippet: {
          title: seoTitle,
          description: seoDescription,
          tags: seoTags,
          categoryId: categoryId,
        },
        status: { 
          privacyStatus: privacyStatus,
          selfDeclaredMadeForKids: false,
        },
      },
      media: { body: videoStream },
    });
  } catch (err) {
    const rateLimited = err.code === 403 && /quota/i.test(err.message || '');
    throw new PublishError(`YouTube upload: ${err.message}`, { rateLimited });
  }

  const videoId = insertResult.data.id;

  // Upload custom thumbnail (AI-generated or branded fallback)
  const existingThumbnail = media.find((m) => m.role === 'thumbnail');
  if (existingThumbnail) {
    try {
      const thumbRes = await fetch(existingThumbnail.url);
      const thumbBuffer = Buffer.from(await thumbRes.arrayBuffer());
      await youtube.thumbnails.set({ videoId, media: { body: thumbBuffer } });
      console.log(`✅ Custom thumbnail uploaded for video ${videoId}`);
    } catch (thumbErr) {
      console.warn('Custom thumbnail upload failed:', thumbErr.message);
    }
  } else if (metadata.thumbnail_brief) {
    // Generate thumbnail from brief
    try {
      const category = contentAsset.subject || 'Education';
      const thumbBuffer = await generateThumbnailFromBrief(
        metadata.thumbnail_brief,
        seoTitle,
        category
      );
      
      if (thumbBuffer) {
        await youtube.thumbnails.set({ videoId, media: { body: thumbBuffer } });
        console.log(`✅ AI-generated thumbnail uploaded for video ${videoId}`);
      }
    } catch (genErr) {
      console.warn('AI thumbnail generation/upload failed:', genErr.message);
    }
  }

  // Optional playlist addition
  if (playlistId) {
    try {
      await youtube.playlistItems.insert({
        part: ['snippet'],
        requestBody: {
          snippet: {
            playlistId,
            resourceId: { kind: 'youtube#video', videoId },
          },
        },
      });
      console.log(`✅ Video added to playlist ${playlistId}`);
    } catch (playlistErr) {
      console.warn('Playlist addition failed:', playlistErr.message);
    }
  }

  return { externalId: videoId, externalUrl: `https://youtube.com/watch?v=${videoId}` };
}
