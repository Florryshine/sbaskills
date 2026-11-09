import { buildAssetContext, generateJson, generateCarouselSlides, buildCarouselRelationshipNote } from './_shared';

export async function generateFacebook(asset, options = {}) {
  const context = buildAssetContext(asset);
  const slides = options.sharedSlides || await generateCarouselSlides(context, {
    toneNote: 'Keep the tone witty, bold, and energetic like a favourite senior talking to students directly.',
  });
  const prompt = 'You are the lead Facebook content strategist for Shiney Brain Academy. Audience: Nigerian secondary-school and Post-UTME students.\n\n' +
    context + '\n\n' + buildCarouselRelationshipNote(slides) +
    '\n\nOpen with curiosity or tension: a surprising fact, common mistake, bold opinion, exam myth, challenge, question or mini story. Avoid generic openings. Use short punchy paragraphs and a natural Nigerian mentor voice. End with a question and one casual follow line. Max 250 words. Return ONLY JSON: {"caption":"...","hashtags":["#tag1"]}';
  const data = await generateJson(prompt, { expect: 'object' });
  return [
    { asset_type:'facebook_post', platform:'facebook', format:'carousel', title:asset.keyword,
      body:data.caption, metadata:{slides,hashtags:data.hashtags||[]},
      _media:{type:'carousel',slides,summary:asset.summary,platform:'facebook'} },
    { asset_type:'facebook_hero', platform:'facebook', format:'image', title:asset.keyword,
      body:data.caption, metadata:{hashtags:data.hashtags||[]},
      _media:{type:'hero_image',searchQuery:[asset.subject,asset.keyword].filter(Boolean).join(' '),category:asset.subject,preset:'hero'} },
  ];
}
