// lib/content-factory/generators/telegram.js
import { buildAssetContext, generateJson, PLATFORM_LIMITS, generateCarouselSlides } from './_shared';

export async function generateTelegram(asset) {
  const context = buildAssetContext(asset);

  const prompt = `You are writing for the Shiney Brain Academy Telegram study channel — students who joined specifically to get exam-prep content, more focused/serious than social media browsers.

${context}

Telegram post rules:
- Educational and direct — treat it like a mini study-note post, not an ad.
- Use simple structure: a one-line topic intro, then 2-4 short bullet-style facts (use "•" not markdown), then one practice tip or common mistake to avoid.
- End with a short call-to-action to check the full study notes/quiz on the app.
- Max ${PLATFORM_LIMITS.telegram.caption} characters (this will be sent as a photo caption).
- Separately provide 3-5 hashtags for categorizing the post within the channel (e.g. #Physics, #JAMB2026, #ExamPrep).

Return ONLY JSON:
{ "caption": "...", "hashtags": ["#tag1", "#tag2"] }`;

  const [data, slides] = await Promise.all([
    generateJson(prompt, { expect: 'object' }),
    generateCarouselSlides(context, {
      toneNote: 'Keep the tone focused and study-note-like, matching a Telegram study channel audience.',
    }),
  ]);

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
      },
    },
  ];
}
