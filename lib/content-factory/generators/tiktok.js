// lib/content-factory/generators/tiktok.js
//
// PATCHED: same fix as youtube.js — script_segments instead of one flat
// script string, plus a _media instruction so index.js queues a real render
// via video_scripts. See youtube.js for the full explanation.
import { buildAssetContext, generateJson, PLATFORM_LIMITS } from './_shared';

export async function generateTikTok(asset) {
  const context = buildAssetContext(asset);

  const prompt = `You are producing a TikTok script for Shiney Brain Academy. TikTok audiences (Nigerian Gen-Z students) respond to fast-paced, informal, meme-literate delivery — more casual than YouTube Shorts, shorter sentences, direct address to camera.

${context}

Break the script into 3-6 short segments (a segment = one beat/idea, roughly 3-8 seconds of narration each when spoken aloud). Very casual/conversational, like a student explaining to a friend. For each segment give:
- "text": the exact narration line for that segment (natural spoken sentence, may include a pacing note like "[pause for effect]" if useful)
- "visual_cue": a short phrase describing what should be on screen
- "stock_search": 2-4 words to search stock video/image libraries for that visual

Also produce:
- A caption (max ${PLATFORM_LIMITS.tiktok.caption} chars) — short, uses current casual phrasing, ends with a question to drive comments.
- 5-8 hashtags mixing broad (#LearnOnTikTok, #JAMB2026) and niche tags.
- privacy_level: "PUBLIC_TO_EVERYONE" (default), "MUTUAL_FOLLOW_FRIENDS", or "FOLLOWING_ONLY".

Return ONLY JSON:
{
  "segments": [
    { "text": "...", "visual_cue": "...", "stock_search": "..." }
  ],
  "caption": "...",
  "hashtags": ["#tag1"],
  "privacy_level": "PUBLIC_TO_EVERYONE"
}`;

  const data = await generateJson(prompt, { expect: 'object' });
  const segments = data.segments || [];

  return [
    {
      asset_type: 'tiktok_video',
      platform: 'tiktok',
      format: 'video',
      title: asset.keyword,
      body: segments.map((s) => s.text).join(' '),
      metadata: {
        caption: data.caption,
        hashtags: data.hashtags || [],
        privacy_level: data.privacy_level || 'PUBLIC_TO_EVERYONE',
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
