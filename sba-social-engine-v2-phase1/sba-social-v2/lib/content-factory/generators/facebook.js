// lib/content-factory/generators/facebook.js
import { buildAssetContext, generateJson } from './_shared';

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

Return ONLY JSON:
{ "caption": "..." }`;

  const data = await generateJson(prompt, { expect: 'object' });

  return [
    {
      asset_type: 'facebook_post',
      platform: 'facebook',
      format: 'image', // paired with a single hero image by default
      title: asset.keyword,
      body: data.caption,
      metadata: {},
    },
  ];
}
