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
import { PublishError } from './base';

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

export async function publishYouTube(channel, contentAsset, media = []) {
  const video = media.find((m) => m.media_type === 'video');
  if (!video) throw new PublishError('YouTube requires a video file', { retryable: false });

  const auth = getOAuthClient(channel);
  const youtube = google.youtube({ version: 'v3', auth });

  const videoRes = await fetch(video.url);
  if (!videoRes.ok) throw new PublishError('Could not fetch rendered video for upload');
  const videoStream = videoRes.body;

  let insertResult;
  try {
    insertResult = await youtube.videos.insert({
      part: ['snippet', 'status'],
      requestBody: {
        snippet: {
          title: contentAsset.title,
          description: contentAsset.metadata?.description || '',
          tags: contentAsset.metadata?.tags || [],
          categoryId: '27', // Education
        },
        status: { privacyStatus: 'public', selfDeclaredMadeForKids: false },
      },
      media: { body: videoStream },
    });
  } catch (err) {
    const rateLimited = err.code === 403 && /quota/i.test(err.message || '');
    throw new PublishError(`YouTube upload: ${err.message}`, { rateLimited });
  }

  const videoId = insertResult.data.id;

  // Optional thumbnail
  const thumbnail = media.find((m) => m.role === 'thumbnail');
  if (thumbnail) {
    const thumbRes = await fetch(thumbnail.url);
    const thumbBuffer = Buffer.from(await thumbRes.arrayBuffer());
    await youtube.thumbnails.set({ videoId, media: { body: thumbBuffer } });
  }

  return { externalId: videoId, externalUrl: `https://youtube.com/watch?v=${videoId}` };
}
