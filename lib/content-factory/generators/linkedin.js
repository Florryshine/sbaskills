// lib/content-factory/generators/linkedin.js
import { buildAssetContext, generateJson, PLATFORM_LIMITS, generateCarouselSlides, buildCarouselRelationshipNote } from './_shared';

export async function generateLinkedIn(asset) {
  const context = buildAssetContext(asset);

  // Carousel first — the LinkedIn "document" carousel carries the data
  // points/insight structure; the caption below is told what's already
  // covered so it adds the surrounding argument instead of repeating it.
  const slides = await generateCarouselSlides(context, {
    toneNote: 'Keep the slide copy confident, data-informed, and authoritative — written for educators, investors, and policymakers, not students.',
  });

  const prompt = `You are writing a LinkedIn post on behalf of Shiney Brain Academy — NOT a tutorial centre, an education technology company building the future of exam-prep in Africa.

Your audience is NOT students. It is teachers, school owners, education investors, NGOs, policymakers, EdTech founders, and universities — people who could become partners, collaborators, or believers in the brand's authority.

Your mission here is not to sell. It is to position Shiney Brain Academy as the education company people in this industry listen to — an authority shaping the conversation, not asking for attention.

${context}

${buildCarouselRelationshipNote(slides)}

Voice and confidence:
- Speak with the confidence of an institution that has analyzed real data, not a guess. Use constructions like "Our analysis of student learning interactions shows...", "One pattern we've consistently observed...", "The data suggests...", "We believe the future of African education depends on...".
- Never hedge with "I think" — say "Evidence suggests" instead. Never sound uncertain, and never sound like a generic AI wrote it.
- Open with an insight, a pattern you've observed, or a bold claim about education, learning science, assessment design, EdTech, or educational policy — not a hook gimmick, not small talk.
- Discuss the topic through a bigger lens: what it reveals about how Nigerian/African students learn, how exams should be designed, or where education is heading — not just "how to study this topic."
- Professional but human — first person plural is fine ("We've found that...").
- 150-250 words.
- End with a genuine, thoughtful discussion question aimed at educators/industry peers — not a sales CTA, not "check our app."
- Max ${PLATFORM_LIMITS.linkedin.caption} characters.
- Separately provide 3-5 professional/industry hashtags (e.g. #EdTech, #AfricanEducation, #LearningScience) — never consumer hashtag spam.

Return ONLY JSON:
{ "caption": "...", "hashtags": ["#tag1", "#tag2"] }`;

  const data = await generateJson(prompt, { expect: 'object' });

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
        platform: 'linkedin', // picks LinkedIn's editorial/data-card visual style
      },
    },
  ];
}
