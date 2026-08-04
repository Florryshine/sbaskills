// lib/content-factory/generators/telegram.js
import { buildAssetContext, generateJson, PLATFORM_LIMITS, generateCarouselSlides, buildCarouselRelationshipNote } from './_shared';

export async function generateTelegram(asset) {
  const context = buildAssetContext(asset);

  // Carousel first — Telegram's carousel should carry the core teaching
  // (the facts/bullets), so the caption text can be the shorter "why this
  // matters + memory trick/practice" layer instead of restating the same facts.
  const slides = await generateCarouselSlides(context, {
    toneNote: 'Keep the tone tight, no-fluff, and study-note-like — like an exclusive study group, not a marketing message.',
  });

  const prompt = `You are the tutor running the Shiney Brain Academy Telegram study channel. Everyone here is a student who joined specifically for exam-prep content (JAMB/WAEC/NECO/Post-UTME) — they came to study, not to be marketed to.

Your mission: make every message feel like "I'm learning something the moment I open Telegram" — like being inside an exclusive study group with almost zero marketing feel.

${context}

${buildCarouselRelationshipNote(slides)}

Telegram post rules:
- No fluff, no wasted words — every line should deliver real academic value.
- Since the carousel already covers the core facts, this caption should focus on ONE of these labeled additions instead of repeating the slide content:
  📌 Exam Tip — how this actually shows up in the exam
  ⚠️ Common Mistake — a mistake students make with this exact topic
  🧠 Memory Trick — a mnemonic or memory hack not already on the slides
  📝 Practice Question — one quick question to test it
- Open with a one-line hook connecting the topic to something the student actually deals with, then give the one labeled addition above.
- End with a short, low-key nudge to check the full notes/quiz on the app — not a sales pitch.
- Max ${PLATFORM_LIMITS.telegram.caption} characters (this will be sent as a photo caption). Aim for well under that — concise beats complete.
- Separately provide 3-5 hashtags for categorizing the post within the channel (e.g. #Physics, #JAMB2026, #ExamPrep).

Return ONLY JSON:
{ "caption": "...", "hashtags": ["#tag1", "#tag2"] }`;

  const data = await generateJson(prompt, { expect: 'object' });

  return [
    {
      asset_type: 'telegram_post',
      platform: 'telegram',
      format: 'carousel',
      title: asset.keyword,
      body: data.caption,
      metadata: { slides, hashtags: data.hashtags || [] },
      // consumed by lib/content-factory/index.js, stripped before insert
      _media: {
        type: 'carousel',
        slides,
        summary: asset.summary,
        platform: 'telegram', // picks Telegram's plain, low-branding visual style
      },
    },
  ];
}
