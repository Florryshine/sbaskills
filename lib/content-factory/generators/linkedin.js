// lib/content-factory/generators/linkedin.js
import { buildAssetContext, generateJson, PLATFORM_LIMITS, generateCarouselSlides } from './_shared';

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
- Separately provide 3-5 hashtags, professional/industry style (e.g. #EdTech, #NigerianEducation, #JAMB2026) — not consumer-social hashtag spam.

Return ONLY JSON:
{ "caption": "...", "hashtags": ["#tag1", "#tag2"] }`;

  const [data, slides] = await Promise.all([
    generateJson(prompt, { expect: 'object' }),
    generateCarouselSlides(context, {
      toneNote: 'Keep the slide copy professional and insight-led, matching a LinkedIn audience of educators — not the punchier tone used for consumer social platforms.',
    }),
  ]);

  return [
    {
      asset_type: 'linkedin_post',
      platform: 'linkedin',
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
