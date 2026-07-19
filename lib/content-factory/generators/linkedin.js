// lib/content-factory/generators/linkedin.js
import { buildAssetContext, generateJson, PLATFORM_LIMITS } from './_shared';

export async function generateLinkedIn(asset) {
  const context = buildAssetContext(asset);

  const prompt = `You are writing a LinkedIn post on behalf of Shiney Brain Academy, aimed at educators, tutors, and education-sector professionals in Nigeria — NOT students directly. LinkedIn readers expect a professional, insight-led tone.

${context}

LinkedIn post rules:
- Open with an insight or observation about teaching/learning this topic — not a hook gimmick.
- Frame it around the value of good exam-prep pedagogy (why this topic trips students up, how structured content helps).
- Professional but not stiff — first person is fine ("We've found that...").
- 150-250 words.
- End with a genuine discussion question for educators, not a sales CTA.
- Max ${PLATFORM_LIMITS.linkedin.caption} characters.

Return ONLY JSON:
{ "caption": "..." }`;

  const data = await generateJson(prompt, { expect: 'object' });

  return [
    {
      asset_type: 'linkedin_post',
      platform: 'linkedin',
      format: 'image',
      title: asset.keyword,
      body: data.caption,
      metadata: {},
    },
  ];
}
