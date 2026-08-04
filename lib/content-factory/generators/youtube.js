// lib/content-factory/generators/youtube.js
//
// PATCHED: previously returned one flat `script` string, which the video
// engine can't use — narration.js/render.js need script_segments: an array
// of { text, visual_cue, stock_search } so narration can be generated and
// synced per-segment, and visuals.js can search a real stock clip/image for
// each one. This now asks the LLM for segments directly and attaches a
// `_media` instruction so index.js queues the render via the existing
// video_scripts table (picked up by local-video-renderer/worker.js or an
// in-process call to lib/video-engine/render.js) instead of nothing.
import { buildAssetContext, generateJson, PLATFORM_LIMITS } from './_shared';

export async function generateYouTube(asset) {
  const context = buildAssetContext(asset);

  const prompt = `You are producing a YouTube Short script + SEO metadata for Shiney Brain Academy. YouTube Shorts are vertical, under 60 seconds, and need a hook in the first 1-2 seconds or viewers swipe away.

${context}

Break the script into 4-7 short segments (a segment = one beat/idea, roughly 3-8 seconds of narration each when spoken aloud). First segment MUST be a hook (surprising fact or question), not an intro. For each segment give:
- "text": the exact narration line for that segment (natural spoken sentence, not written prose)
- "visual_cue": a short phrase describing what should be on screen (e.g. "Close-up of a plant leaf")
- "stock_search": 2-4 words to search stock video/image libraries for that visual (e.g. "leaf photosynthesis macro")

Also produce:
- An SEO-optimized title (max ${PLATFORM_LIMITS.youtube.title} chars) that a student would actually search for.
- A description (max ${PLATFORM_LIMITS.youtube.description} chars) — first 2 lines matter most (shown before "...more"), include natural keywords, end with channel CTA.
- 8-12 tags (search keywords, not hashtags).
- 5-8 hashtags (first 3 will appear above the video title).
- A one-sentence thumbnail_brief describing a bold, high-contrast thumbnail concept (this feeds an image generator, not a human designer).
- privacyStatus: "public" (default), "private", or "unlisted".
- Optional playlistId if there's a relevant playlist.

Return ONLY JSON:
{
  "segments": [
    { "text": "...", "visual_cue": "...", "stock_search": "..." }
  ],
  "title": "...",
  "description": "...",
  "tags": ["tag1", "tag2"],
  "hashtags": ["#tag1", "#tag2"],
  "thumbnail_brief": "...",
  "privacyStatus": "public",
  "playlistId": "..."
}`;

  const data = await generateJson(prompt, { expect: 'object' });
  const segments = data.segments || [];

  return [
    {
      asset_type: 'youtube_short',
      platform: 'youtube',
      format: 'video',
      title: data.title,
      // the full narration joined for quick reading in the review dashboard;
      // the segments themselves (source of truth for rendering) live in metadata
      body: segments.map((s) => s.text).join(' '),
      metadata: {
        description: data.description,
        tags: data.tags || [],
        hashtags: data.hashtags || [],
        thumbnail_brief: data.thumbnail_brief,
        privacyStatus: data.privacyStatus || 'public',
        playlistId: data.playlistId || null,
        script_segments: segments,
      },
      // consumed by lib/content-factory/index.js, stripped before insert
      _media: {
        type: 'video_script',
        format: 'short',
        segments,
      },
    },
  ];
}
