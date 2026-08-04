// lib/content-factory/generators/instagram.js
//
// PATCHED: previously produced TWO disconnected rows — an
// instagram_carousel with body:null (no caption attached) and a separate
// instagram_caption with no image. Instagram doesn't support a text-only
// feed post or a carousel with no caption, so that shape didn't map to
// anything postable. Now produces ONE carousel+caption post, plus a second
// hero-image+caption variant so there's always a ready-to-post alternative
// that doesn't require the carousel render to succeed.
import { buildAssetContext, generateJson, generateCarouselSlides, buildCarouselRelationshipNote, PLATFORM_LIMITS } from './_shared';

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
      // Carousel variant: same caption, rendered carousel slides as media.
      asset_type: 'instagram_carousel',
      platform: 'instagram',
      format: 'carousel',
      title: asset.keyword,
      body: captionData.caption,
      metadata: { slides, hashtags: captionData.hashtags || [] },
      // consumed by lib/content-factory/index.js, stripped before insert
      _media: {
        type: 'carousel',
        slides,
        summary: asset.summary,
        platform: 'instagram', // picks Instagram's bold/square visual style
      },
    },
    {
      // Hero-image variant: identical caption, single branded photo instead
      // of a carousel — a ready fallback if the carousel render fails, and
      // a genuinely different post style (single-image posts still perform
      // well on Instagram and are faster to review/approve).
      asset_type: 'instagram_hero',
      platform: 'instagram',
      format: 'image',
      title: asset.keyword,
      body: captionData.caption,
      metadata: { hashtags: captionData.hashtags || [] },
      _media: {
        type: 'hero_image',
        searchQuery: [asset.subject, asset.keyword].filter(Boolean).join(' '),
        category: asset.subject,
        preset: 'square', // 1080x1080 — matches Instagram's feed aspect ratio
      },
    },
  ];
}
