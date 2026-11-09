import { buildAssetContext, generateJson, generateCarouselSlides, buildCarouselRelationshipNote, PLATFORM_LIMITS } from './_shared';

export async function generateInstagram(asset, options = {}) {
  const context = buildAssetContext(asset);
  const slides = options.sharedSlides || await generateCarouselSlides(context, {
    toneNote: 'Keep the tone motivational, premium, and visually confident — reassure parents while inspiring students.',
  });
  const captionPrompt = 'You are an Instagram content lead for Shiney Brain Academy (Nigerian exam-prep: JAMB/WAEC/NECO/Post-UTME). Write ONE feed caption for students and parents.\n\n' +
    context + '\n\n' + buildCarouselRelationshipNote(slides) +
    '\n\nStart with an emotional hook. Use natural emojis and short paragraphs. End with a save/share CTA. Max ' +
    PLATFORM_LIMITS.instagram.caption + ' characters. Separately provide 15-20 relevant hashtags.\n\nReturn ONLY JSON: {"caption":"...","hashtags":["#tag1"]}';
  const captionData = await generateJson(captionPrompt, { expect: 'object' });
  return [
    { asset_type:'instagram_carousel', platform:'instagram', format:'carousel', title:asset.keyword,
      body:captionData.caption, metadata:{slides,hashtags:captionData.hashtags||[]},
      _media:{type:'carousel',slides,summary:asset.summary,platform:'instagram'} },
    { asset_type:'instagram_hero', platform:'instagram', format:'image', title:asset.keyword,
      body:captionData.caption, metadata:{hashtags:captionData.hashtags||[]},
      _media:{type:'hero_image',searchQuery:[asset.subject,asset.keyword].filter(Boolean).join(' '),category:asset.subject,preset:'square'} },
  ];
}
