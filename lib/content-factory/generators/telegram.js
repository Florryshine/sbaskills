import { buildAssetContext, generateJson, PLATFORM_LIMITS, generateCarouselSlides, buildCarouselRelationshipNote } from './_shared';

export async function generateTelegram(asset, options = {}) {
  const context = buildAssetContext(asset);
  const slides = options.sharedSlides || await generateCarouselSlides(context, {
    toneNote: 'Keep the tone tight, no-fluff, and study-note-like — an exclusive study group.',
  });
  const prompt = 'You are the tutor running the Shiney Brain Academy Telegram study channel. Students joined to study, not to be marketed to.\n\n' +
    context + '\n\n' + buildCarouselRelationshipNote(slides) +
    '\n\nWrite one concise complementary addition: an exam tip, common mistake, memory trick or practice question. Open with a one-line hook. End with a low-key nudge to check full notes/quiz. Max ' +
    PLATFORM_LIMITS.telegram.caption + ' characters. Return ONLY JSON: {"caption":"...","hashtags":["#tag1"]}';
  const data = await generateJson(prompt, { expect: 'object' });
  return [{ asset_type:'telegram_post', platform:'telegram', format:'carousel', title:asset.keyword,
    body:data.caption, metadata:{slides,hashtags:data.hashtags||[]},
    _media:{type:'carousel',slides,summary:asset.summary,platform:'telegram'} }];
}
