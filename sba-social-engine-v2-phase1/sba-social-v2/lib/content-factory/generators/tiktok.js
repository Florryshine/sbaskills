// lib/content-factory/generators/tiktok.js
import { buildAssetContext, generateJson, PLATFORM_LIMITS } from './_shared';

export async function generateTikTok(asset) {
  const context = buildAssetContext(asset);

  const prompt = `You are producing a TikTok script for Shiney Brain Academy. TikTok audiences (Nigerian Gen-Z students) respond to fast-paced, informal, meme-literate delivery — more casual than YouTube Shorts, shorter sentences, direct address to camera.

${context}

Produce:
1. A 25-40 second script, very casual/conversational, like a student explaining to a friend. Include natural pauses/beats noted in [brackets] for pacing (e.g. "[pause for effect]").
2. A caption (max ${PLATFORM_LIMITS.tiktok.caption} chars) — short, uses current casual phrasing, ends with a question to drive comments.
3. 5-8 hashtags mixing broad (#LearnOnTikTok, #JAMB2026) and niche tags.

Return ONLY JSON:
{ "script": "...", "caption": "...", "hashtags": ["#tag1"] }`;

  const data = await generateJson(prompt, { expect: 'object' });

  return [
    {
      asset_type: 'tiktok_video',
      platform: 'tiktok',
      format: 'video',
      title: asset.keyword,
      body: data.script,
      metadata: { caption: data.caption, hashtags: data.hashtags || [] },
    },
  ];
}
