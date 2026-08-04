// lib/metadata-engine.js
//
// Centralized metadata generation for all platforms.
// Called AFTER content generation but BEFORE rendering/publishing.
// Ensures consistent titles, descriptions, hashtags across all platforms.
//
// Flow: Generator -> Metadata Engine -> Renderer -> Publisher

import { generateWithFallback } from '@/lib/llmFallbackChain';
import { parseJsonFromText } from '@/lib/robustJsonParse';

const PLATFORM_LIMITS = {
  youtube: { title: 100, description: 5000, tags: 500 },
  tiktok: { caption: 2200, hashtags: 8 },
  instagram: { caption: 2200, hashtags: 30 },
  facebook: { caption: 63206, hashtags: 10 },
  linkedin: { caption: 3000, hashtags: 10 },
  telegram: { caption: 4096, hashtags: 10 },
};

/**
 * Generate platform-specific metadata from a knowledge asset.
 * Returns an object with metadata for each platform.
 */
export async function generateAllMetadata(asset) {
  const keyConcepts = (asset.key_concepts || []).slice(0, 5).join(', ') || 'none listed';
  const facts = (asset.facts || []).slice(0, 5).join('; ') || 'none listed';

  const prompt = `You are generating cross-platform metadata for Shiney Brain Academy content about "${asset.keyword}".

Subject: ${asset.subject || 'General'}
Summary: ${asset.summary || 'No summary available.'}
Key concepts: ${keyConcepts}
Facts: ${facts}

Generate metadata for ALL these platforms in ONE response. Each platform has different requirements:

YOUTUBE (Shorts):
- title: SEO-optimized, under 100 chars, hook in first 50 chars
- description: 2-3 paragraphs, keywords naturally integrated, CTA at end
- tags: 8-12 search keywords (not hashtags)
- hashtags: 5-8 hashtags (first 3 will appear above title)
- categoryId: "27" (Education)
- thumbnail_brief: One sentence describing a bold thumbnail concept
- privacyStatus: "public" | "private" | "unlisted" (default: "public")
- playlistId: optional playlist ID to add video to

TIKTOK:
- caption: Casual, Gen-Z friendly, ends with engagement question
- hashtags: 5-8 mix of broad (#LearnOnTikTok, #JAMB2026) and niche

INSTAGRAM:
- caption: Engaging, emoji-appropriate, CTA included
- hashtags: 10-15 relevant hashtags

FACEBOOK:
- caption: Clear, shareable, includes context
- hashtags: 3-5 broad hashtags

LINKEDIN:
- caption: Professional tone, value-focused
- hashtags: 5-8 professional/educational hashtags

TELEGRAM:
- caption: Concise, informative, may include links
- hashtags: 3-5 relevant hashtags

Return ONLY JSON in this exact structure:
{
  "youtube": {
    "title": "...",
    "description": "...",
    "tags": ["tag1", "tag2"],
    "hashtags": ["#tag1", "#tag2"],
    "categoryId": "27",
    "thumbnail_brief": "...",
    "privacyStatus": "public",
    "playlistId": "..."
  },
  "tiktok": {
    "caption": "...",
    "hashtags": ["#tag1"]
  },
  "instagram": {
    "caption": "...",
    "hashtags": ["#tag1"]
  },
  "facebook": {
    "caption": "...",
    "hashtags": ["#tag1"]
  },
  "linkedin": {
    "caption": "...",
    "hashtags": ["#tag1"]
  },
  "telegram": {
    "caption": "...",
    "hashtags": ["#tag1"]
  }
}`;

  const { result, errors } = await generateWithFallback(
    prompt,
    (text) => parseJsonFromText(text, 'object'),
    (parsed) => parsed && typeof parsed === 'object' && parsed.youtube && parsed.tiktok,
    4096
  );

  if (!result) {
    throw new Error(
      `Metadata generation failed across all providers.${errors?.length ? ' Errors: ' + errors.join('; ') : ''}`
    );
  }

  return result;
}

/**
 * Apply generated metadata to a content_assets row.
 * Merges platform-specific metadata into the existing metadata field.
 */
export function applyPlatformMetadata(existingMetadata, platformMetadata, platform) {
  const platformData = platformMetadata[platform];
  if (!platformData) return existingMetadata;

  return {
    ...existingMetadata,
    ...platformData,
    // Preserve any existing fields
    script_segments: existingMetadata?.script_segments,
    background: existingMetadata?.background,
  };
}

/**
 * Update content_assets rows with generated metadata.
 * Called after content generation, before rendering.
 */
export async function enrichContentWithMetadata(contentAssets, allMetadata) {
  return contentAssets.map((asset) => {
    const platform = asset.platform;
    if (!platform || !allMetadata[platform]) return asset;

    return {
      ...asset,
      metadata: applyPlatformMetadata(asset.metadata, allMetadata, platform),
      // Override title/body if platform metadata provides better versions
      title: allMetadata[platform].title || asset.title,
      body: allMetadata[platform].caption || allMetadata[platform].description || asset.body,
    };
  });
}
