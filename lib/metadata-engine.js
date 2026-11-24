// lib/metadata-engine.js
//
// Centralized, schema-validated metadata generation for cross-platform content.
// Each platform has its own required fields and limits. Engine-specific metadata
// (for example quote-loop per-video metadata) should not be regenerated here.

import { generateWithFallback } from '@/lib/llmFallbackChain';
import { parseJsonFromText } from '@/lib/robustJsonParse';

export const PLATFORM_LIMITS = {
  youtube: { title: 100, description: 5000, tags: 500, hashtags: 8 },
  tiktok: { caption: 2200, hashtags: 8 },
  instagram: { caption: 2200, hashtags: 30 },
  facebook: { caption: 63206, hashtags: 10 },
  linkedin: { caption: 3000, hashtags: 10 },
  telegram: { caption: 4096, hashtags: 10 },
};

const REQUIRED_PLATFORMS = ['youtube', 'tiktok', 'instagram', 'facebook', 'linkedin', 'telegram'];

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function validateMetadata(parsed) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return false;

  const youtube = parsed.youtube;
  if (!youtube || !nonEmptyString(youtube.title) || youtube.title.trim().length > PLATFORM_LIMITS.youtube.title) return false;
  if (!nonEmptyString(youtube.description) || youtube.description.trim().length > PLATFORM_LIMITS.youtube.description) return false;
  if (!Array.isArray(youtube.tags) || youtube.tags.length < 3 || youtube.tags.some((tag) => !nonEmptyString(tag))) return false;
  if (youtube.tags.join(',').length > PLATFORM_LIMITS.youtube.tags) return false;
  if (!Array.isArray(youtube.hashtags) || youtube.hashtags.length < 1 || youtube.hashtags.length > PLATFORM_LIMITS.youtube.hashtags || youtube.hashtags.some((tag) => !nonEmptyString(tag))) return false;

  for (const platform of REQUIRED_PLATFORMS.filter((name) => name !== 'youtube')) {
    const data = parsed[platform];
    const limit = PLATFORM_LIMITS[platform];
    if (!data || !nonEmptyString(data.caption) || data.caption.trim().length > limit.caption) return false;
    if (!Array.isArray(data.hashtags) || data.hashtags.length < 1 || data.hashtags.length > limit.hashtags || data.hashtags.some((tag) => !nonEmptyString(tag))) return false;
  }

  if (youtube.categoryId != null && !nonEmptyString(String(youtube.categoryId))) return false;
  if (youtube.privacyStatus != null && !['public', 'private', 'unlisted'].includes(youtube.privacyStatus)) return false;
  return true;
}

validateMetadata.describe = (parsed) => {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return 'expected a JSON object containing metadata for all six platforms';
  const issues = [];
  const y = parsed.youtube;
  if (!y) issues.push('youtube object is missing');
  else {
    if (!nonEmptyString(y.title)) issues.push('youtube.title is missing');
    else if (y.title.trim().length > PLATFORM_LIMITS.youtube.title) issues.push('youtube.title exceeds 100 characters');
    if (!nonEmptyString(y.description)) issues.push('youtube.description is missing');
    else if (y.description.trim().length > PLATFORM_LIMITS.youtube.description) issues.push('youtube.description exceeds 5000 characters');
    if (!Array.isArray(y.tags) || y.tags.length < 3 || y.tags.some((v) => !nonEmptyString(v))) issues.push('youtube.tags must contain at least 3 non-empty search tags');
    if (Array.isArray(y.tags) && y.tags.join(',').length > PLATFORM_LIMITS.youtube.tags) issues.push('youtube.tags exceed the 500-character combined limit');
    if (!Array.isArray(y.hashtags) || y.hashtags.length < 1 || y.hashtags.length > PLATFORM_LIMITS.youtube.hashtags) issues.push('youtube.hashtags must contain 1-8 entries');
  }
  for (const platform of REQUIRED_PLATFORMS.filter((name) => name !== 'youtube')) {
    const data = parsed[platform];
    if (!data) {
      issues.push(platform + ' object is missing');
      continue;
    }
    const limit = PLATFORM_LIMITS[platform];
    if (!nonEmptyString(data.caption)) issues.push(platform + '.caption is missing');
    else if (data.caption.trim().length > limit.caption) issues.push(platform + '.caption exceeds ' + limit.caption + ' characters');
    if (!Array.isArray(data.hashtags) || data.hashtags.length < 1 || data.hashtags.length > limit.hashtags) {
      issues.push(platform + '.hashtags must contain 1-' + limit.hashtags + ' entries');
    }
  }
  if (y?.privacyStatus != null && !['public', 'private', 'unlisted'].includes(y.privacyStatus)) {
    issues.push('youtube.privacyStatus must be public, private, or unlisted');
  }
  return issues.length ? issues.join('; ') : 'metadata failed platform validation';
};

/**
 * Generate complete metadata for the six platforms supported by this engine.
 * The fallback chain repairs invalid output and tries other providers before failing.
 */
export async function generateAllMetadata(asset) {
  const keyConcepts = (asset.key_concepts || []).slice(0, 5).join(', ') || 'none listed';
  const facts = (asset.facts || []).slice(0, 5).join('; ') || 'none listed';

  const prompt = `You are generating accurate cross-platform metadata for Shiney Brain Academy content about "${asset.keyword}".

Ground every claim in the supplied material. Do not invent facts, links, statistics, qualifications or promises.
Subject: ${asset.subject || 'General'}
Summary: ${asset.summary || 'No summary available.'}
Key concepts: ${keyConcepts}
Facts: ${facts}

Return metadata for ALL SIX platforms, with every required field:
YOUTUBE: title (max 100 chars), description (useful 2-3 paragraphs, max 5000 chars), tags (8-12 search phrases, not hashtags), hashtags (5-8), categoryId "27", thumbnail_brief (one sentence), privacyStatus "public" unless otherwise requested.
TIKTOK: caption (max 2200 chars), hashtags (5-8).
INSTAGRAM: caption (max 2200 chars), hashtags (10-15).
FACEBOOK: caption (max 63206 chars), hashtags (3-5).
LINKEDIN: caption (max 3000 chars), hashtags (5-8).
TELEGRAM: caption (max 4096 chars), hashtags (3-5).

Hashtags must be strings beginning with #. Captions must be complete, platform-appropriate and ready to publish. Do not leave any platform blank.
Return ONLY this JSON shape:
{
  "youtube": {"title":"...", "description":"...", "tags":["..."], "hashtags":["#..."], "categoryId":"27", "thumbnail_brief":"...", "privacyStatus":"public"},
  "tiktok": {"caption":"...", "hashtags":["#..."]},
  "instagram": {"caption":"...", "hashtags":["#..."]},
  "facebook": {"caption":"...", "hashtags":["#..."]},
  "linkedin": {"caption":"...", "hashtags":["#..."]},
  "telegram": {"caption":"...", "hashtags":["#..."]}
}`;

  const { result, errors } = await generateWithFallback(
    prompt,
    (text) => parseJsonFromText(text, 'object'),
    validateMetadata,
    4096
  );

  if (!result) {
    throw new Error(
      `Metadata generation failed validation across all providers.${errors?.length ? ' Errors: ' + errors.join('; ') : ''}`
    );
  }

  return result;
}

/**
 * Merge one platform's metadata without erasing engine-owned narration/media fields.
 * Existing non-empty platform fields win unless the caller explicitly supplies
 * a replacement, so this helper must only be used when enrichment is intended.
 */
export function applyPlatformMetadata(existingMetadata = {}, platformMetadata = {}, platform) {
  const platformData = platformMetadata?.[platform];
  if (!platformData) return existingMetadata || {};

  return {
    ...(existingMetadata || {}),
    ...platformData,
    script_segments: existingMetadata?.script_segments,
    background: existingMetadata?.background,
  };
}

/**
 * Enrich content rows only when a platform-specific metadata object is present.
 */
export async function enrichContentWithMetadata(contentAssets, allMetadata) {
  return contentAssets.map((asset) => {
    const platform = asset.platform;
    if (!platform || !allMetadata?.[platform]) return asset;

    const platformData = allMetadata[platform];
    return {
      ...asset,
      metadata: applyPlatformMetadata(asset.metadata, allMetadata, platform),
      title: platformData.title || asset.title,
      body: platformData.caption || platformData.description || asset.body,
    };
  });
}
