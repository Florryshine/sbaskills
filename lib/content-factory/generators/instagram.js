// lib/content-factory/generators/instagram.js
//
// PATCHED: the carousel row carries a `_media` instruction. index.js strips
// this before inserting into content_assets, then (after the row has a real
// id) calls attachCarouselMedia(), which renders slides in-memory via
// lib/carousel-engine/render-canvas.js and writes one media_files row per
// slide. Carousel is generated before the caption so the caption prompt can
// see the slide headlines and avoid repeating them (see
// buildCarouselRelationshipNote in _shared.js).
import { buildAssetContext, generateJson, generateCarouselSlides, buildCarouselRelationshipNote, PLATFORM_LIMITS } from './_shared';

/**
 * Produces TWO content_assets rows: an instagram_carousel (slide text/structure
 * + real rendered slide images via _media) and an instagram_caption (the feed
 * caption + hashtags). Kept separate so "regenerate only the caption" doesn't
 * touch the carousel slide copy.
 */
export async function generateInstagram(asset) {
  const context = buildAssetContext(asset);

  const slides = await generateCarouselSlides(context, {
    toneNote: 'Keep the tone motivational, premium, and visually confident — this carousel needs to reassure parents while inspiring students.',
  });

  const captionPrompt = `You are an Instagram content lead for Shiney Brain Academy (Nigerian exam-prep: JAMB/WAEC/NECO/Post-UTME). Write ONE Instagram feed caption for this topic.

Your audience is BOTH students (who want motivation and results) and parents (who want reassurance that Shiney Brain Academy actually delivers). The caption should work for either reader — a student should feel inspired, a parent should feel confident this academy can help their child.

${context}

${buildCarouselRelationshipNote(slides)}

Instagram caption rules:
- Start with an emotional hook in the first line (shows before "...more" — must stand alone). Examples of the register to aim for: "Your future starts with today's decision.", "One chapter can change your entire life.", "This habit separates top scorers."
- Premium, positive, confident tone — this should read like the caption under a beautiful, aspirational carousel, not a casual chat.
- Conversational, uses emojis naturally, short paragraphs/line breaks.
- End with a clear call-to-action to save or share: "Save this post 📌" or "Send this to a friend preparing for JAMB."
- Max ${PLATFORM_LIMITS.instagram.caption} characters.
- Separately provide 15-20 relevant hashtags mixing broad (#JAMB2026) and niche (#${(asset.subject || 'study').replace(/\s+/g, '')}Tips) tags — no spaces inside a hashtag.

Return ONLY JSON:
{ "caption": "...", "hashtags": ["#tag1", "#tag2"] }`;

  const captionData = await generateJson(captionPrompt, { expect: 'object' });

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
        platform: 'instagram', // picks Instagram's bold/square visual style
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
