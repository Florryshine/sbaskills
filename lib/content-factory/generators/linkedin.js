import { buildAssetContext, generateJson, PLATFORM_LIMITS, generateCarouselSlides, buildCarouselRelationshipNote } from './_shared';

export async function generateLinkedIn(asset, options = {}) {
  const context = buildAssetContext(asset);
  const slides = options.sharedSlides || await generateCarouselSlides(context, {
    toneNote: 'Keep slide copy confident, evidence-informed and authoritative for educators and education-sector peers.',
  });
  const prompt = 'Write a LinkedIn post for Shiney Brain Academy, an education technology company focused on exam preparation in Africa. Audience: teachers, school owners, education investors, NGOs, policymakers and EdTech founders.\n\n' +
    context + '\n\n' + buildCarouselRelationshipNote(slides) +
    '\n\nOpen with an insight about learning, assessment or education. Sound professional but human. Do not invent data or claim internal research absent from the source. Write 150-250 words and end with a thoughtful discussion question. Max ' +
    PLATFORM_LIMITS.linkedin.caption + ' characters. Return ONLY JSON: {"caption":"...","hashtags":["#tag1"]}';
  const data = await generateJson(prompt, { expect: 'object' });
  return [{ asset_type:'linkedin_post', platform:'linkedin', format:'carousel', title:asset.keyword,
    body:data.caption, metadata:{slides,hashtags:data.hashtags||[]},
    _media:{type:'carousel',slides,summary:asset.summary,platform:'linkedin'} }];
}
