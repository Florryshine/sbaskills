// lib/content-factory/generators/pinterest.js
import { buildAssetContext, generateJson, PLATFORM_LIMITS } from './_shared';

export async function generatePinterest(asset) {
  const context = buildAssetContext(asset);

  const prompt = `You are writing a Pinterest Pin for Shiney Brain Academy. Pinterest is a visual SEARCH engine, not a social feed — people find pins by typing search terms months later, so titles/descriptions must be keyword-rich and evergreen, not "trendy".

${context}

Pinterest rules:
- Title: max ${PLATFORM_LIMITS.pinterest.title} characters, keyword-first (how a student would literally search, e.g. "Carbohydrates Notes for JAMB Biology").
- Description: max ${PLATFORM_LIMITS.pinterest.caption} characters, naturally keyword-dense (mention subject, exam type, "notes", "study guide", "revision" where true), still readable, ends with a soft CTA to save/click.
- The pin image should be described as a vertical (2:3) educational graphic — note this in "image_brief" (1 sentence) so a designer/AI image tool knows what to render.
- Separately provide 3-5 hashtags — used lightly on Pinterest compared to Instagram, mostly broad exam/subject tags (e.g. #JAMB2026, #StudyTips).

Return ONLY JSON:
{ "title": "...", "description": "...", "image_brief": "...", "hashtags": ["#tag1", "#tag2"] }`;

  const data = await generateJson(prompt, { expect: 'object' });

  return [
    {
      asset_type: 'pinterest_pin',
      platform: 'pinterest',
      format: 'image',
      title: data.title,
      body: data.description,
      metadata: { image_brief: data.image_brief, hashtags: data.hashtags || [] },
      // consumed by lib/content-factory/index.js, stripped before insert.
      // preset: 'pin' renders the vertical 2:3 graphic Pinterest expects,
      // instead of the landscape 'hero' default used by other platforms.
      _media: {
        type: 'hero_image',
        searchQuery: [asset.subject, asset.keyword].filter(Boolean).join(' '),
        category: asset.subject,
        preset: 'pin',
      },
    },
  ];
}
