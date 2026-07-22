// lib/content-factory/generators/facebook.js
import { buildAssetContext, generateJson, generateCarouselSlides } from './_shared';

export async function generateFacebook(asset) {
  const context = buildAssetContext(asset);

  const prompt = `You are a community manager writing a Facebook post for Shiney Brain Academy, a Nigerian exam-prep platform (JAMB/WAEC/NECO/Post-UTME). Facebook's audience here skews slightly older/parents + community groups compared to Instagram — write accordingly.

${context}

Facebook post rules:
- Warm, community/conversational tone — can be longer than Instagram, 3-5 short paragraphs is fine.
- Open with a relatable question or statement parents/students would nod along to.
- Explain the concept clearly and usefully — Facebook readers expect more substance, not just a hook.
- End with an invitation to comment/share, and a soft mention of Shiney Brain Academy.
- Do NOT reuse Instagram-style short punchy hook lines — this should read like a genuine community post, not an ad.
- Separately provide 3-5 hashtags — Facebook hashtags are used sparingly compared to Instagram, so keep it to broad/community ones (e.g. #JAMB2026, #NigerianParents) rather than niche tags.

Return ONLY JSON:
{ "caption": "...", "hashtags": ["#tag1", "#tag2"] }`;

  const [data, slides] = await Promise.all([
    generateJson(prompt, { expect: 'object' }),
    generateCarouselSlides(context, {
      toneNote: 'Keep the tone warm and community-oriented, matching a Facebook audience of students and parents.',
    }),
  ]);

  return [
    {
      asset_type: 'facebook_post',
      platform: 'facebook',
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
