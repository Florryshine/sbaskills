// lib/content-factory/generators/instagram.js
//
// PATCHED: the carousel row now carries a `_media` instruction. index.js
// strips this before inserting into content_assets, then (after the row has
// a real id) calls attachCarouselMedia(), which runs the existing
// carousel-engine (generate.js -> Marp markdown, render.js -> Marp CLI PNGs)
// and writes one media_files row per slide. The slide text itself is
// unchanged — this only adds the rendering step that was missing.
import { buildAssetContext, generateJson, PLATFORM_LIMITS } from './_shared';

/**
 * Produces TWO content_assets rows: an instagram_carousel (slide text/structure
 * + real rendered slide images via _media) and an instagram_caption (the feed
 * caption + hashtags). Kept separate so "regenerate only the caption" doesn't
 * touch the carousel slide copy.
 */
export async function generateInstagram(asset) {
  const context = buildAssetContext(asset);

  const carouselPrompt = `You are a senior Instagram content designer for an exam-prep education brand (Shiney Brain Academy). Design a 5-7 slide educational carousel for this topic.

${context}

Instagram carousels work because each slide teaches ONE small idea with minimal text — think bold headline + one supporting line, not paragraphs. Slide 1 is a hook (a question or bold claim), the middle slides teach the concept step by step, the last slide is a call-to-action.

Return ONLY JSON:
{
  "slides": [
    { "position": 1, "headline": "short bold hook, max 8 words", "body": "one supporting line, max 15 words" }
  ]
}
5-7 slides total. No markdown, no extra text.`;

  const captionPrompt = `You are an Instagram community manager for Shiney Brain Academy (Nigerian exam-prep: JAMB/WAEC/NECO/Post-UTME). Write ONE Instagram feed caption for this topic.

${context}

Instagram caption rules:
- Hook in the first line (shows before "...more" — must stand alone).
- Conversational, uses emojis naturally, short paragraphs/line breaks.
- End with a clear call-to-action ("Save this for later 📌", "Tag a friend who needs this").
- Max ${PLATFORM_LIMITS.instagram.caption} characters.
- Separately provide 15-20 relevant hashtags mixing broad (#JAMB2026) and niche (#${(asset.subject || 'study').replace(/\s+/g, '')}Tips) tags — no spaces inside a hashtag.

Return ONLY JSON:
{ "caption": "...", "hashtags": ["#tag1", "#tag2"] }`;

  const [carousel, captionData] = await Promise.all([
    generateJson(carouselPrompt, { expect: 'object' }),
    generateJson(captionPrompt, { expect: 'object' }),
  ]);

  const slides = carousel.slides || [];

  return [
    {
      asset_type: 'instagram_carousel',
      platform: 'instagram',
      format: 'carousel',
      title: asset.keyword,
      body: null,
      metadata: { slides },
      // consumed by lib/content-factory/index.js, stripped before insert
      _media: {
        type: 'carousel',
        slides,
        summary: asset.summary,
      },
    },
    {
      asset_type: 'instagram_caption',
      platform: 'instagram',
      format: 'text',
      title: asset.keyword,
      body: captionData.caption,
      metadata: { hashtags: captionData.hashtags || [] },
    },
  ];
}
