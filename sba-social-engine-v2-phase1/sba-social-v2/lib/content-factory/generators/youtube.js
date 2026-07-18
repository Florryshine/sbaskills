// lib/content-factory/generators/youtube.js
import { buildAssetContext, generateJson, PLATFORM_LIMITS } from './_shared';

export async function generateYouTube(asset) {
  const context = buildAssetContext(asset);

  const prompt = `You are producing a YouTube Short script + SEO metadata for Shiney Brain Academy. YouTube Shorts are vertical, under 60 seconds, and need a hook in the first 1-2 seconds or viewers swipe away.

${context}

Produce:
1. A 40-55 second spoken script (roughly 100-140 words), written for a confident, energetic teacher-style narrator. First line MUST be a hook (surprising fact or question), not an intro.
2. An SEO-optimized title (max ${PLATFORM_LIMITS.youtube.title} chars) that a student would actually search for.
3. A description (max ${PLATFORM_LIMITS.youtube.description} chars) — first 2 lines matter most (shown before "...more"), include natural keywords, end with channel CTA.
4. 8-12 tags (search keywords, not hashtags).
5. A one-sentence thumbnail_brief describing a bold, high-contrast thumbnail concept (this feeds an image generator, not a human designer).

Return ONLY JSON:
{
  "script": "...",
  "title": "...",
  "description": "...",
  "tags": ["tag1", "tag2"],
  "thumbnail_brief": "..."
}`;

  const data = await generateJson(prompt, { expect: 'object' });

  return [
    {
      asset_type: 'youtube_short',
      platform: 'youtube',
      format: 'video',
      title: data.title,
      body: data.script,
      metadata: {
        description: data.description,
        tags: data.tags || [],
        thumbnail_brief: data.thumbnail_brief,
      },
    },
  ];
}
