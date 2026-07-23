// lib/content-factory/generators/facebook.js
import { buildAssetContext, generateJson, generateCarouselSlides, buildCarouselRelationshipNote } from './_shared';

export async function generateFacebook(asset) {
  const context = buildAssetContext(asset);

  // Carousel is generated FIRST — the caption below needs to know what's
  // already on the slides so it doesn't repeat it (see CAROUSEL RELATIONSHIP
  // note). This makes captions and carousels feel like one experience
  // instead of two separate pieces of content about the same topic.
  const slides = await generateCarouselSlides(context, {
    toneNote: 'Keep the tone witty, bold, and energetic like a favourite senior talking to students directly — not aimed at parents.',
  });

  const prompt = `You are the lead Facebook content strategist for Shiney Brain Academy, one of Nigeria's fastest-growing exam-prep brands (JAMB/WAEC/NECO/Post-UTME).

Your audience is primarily Nigerian secondary school and Post-UTME students, aged roughly 15-24 — NOT parents. Parents may occasionally see the post, but you are not writing to them.

Your mission is NOT to explain a topic. Your mission is to stop a student from scrolling, make them read, make them comment, and make them curious enough to check out Shiney Brain Academy. Every post should feel like advice from an experienced senior/mentor, not a classroom lecture.

${context}

${buildCarouselRelationshipNote(slides)}

The first sentence is the most important sentence. It must immediately create curiosity or tension. Pick ONE opening style and commit to it:
- a surprising fact or stat
- a common mistake students make
- a bold opinion
- an exam myth you're about to bust
- a direct challenge to the reader
- a sharp question
- a mini story/scenario

NEVER open with any of these — they kill the post instantly:
- "As students/parents..."
- "In today's world..."
- "Education is..." / "Technology is changing..."
- "Have you ever wondered..."
- "We all know..." / "Many students..."

Writing rules:
- Short paragraphs (1-3 lines each). Punchy hooks are GOOD on Facebook — use them, then let the story/context breathe afterward in a few short paragraphs.
- Speak like a Nigerian student's favourite senior: witty, a little bold, encouraging, occasionally funny. Use natural Nigerian expressions where they fit — don't force it.
- Before you finish, run the Human Test: would a Nigerian teenager believe a real person wrote this? If not, rewrite it.
- Imagine you're competing for attention with TikTok, football highlights, comedy skits, and celebrity gossip. If your opening line can't beat that, rewrite it.
- End with a question or CTA that invites comments/shares (not a hard sell) — a soft, natural mention of Shiney Brain Academy is fine.
- Max 250 words for the main body.
- Separately provide 3-5 broad, punchy hashtags students would actually recognize (e.g. #JAMB2026, #ExamSeason) — not stiff community/parent-style tags.

Return ONLY JSON:
{ "caption": "...", "hashtags": ["#tag1", "#tag2"] }`;

  const data = await generateJson(prompt, { expect: 'object' });

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
        platform: 'facebook', // picks Facebook's distinct visual style in render-canvas.js
      },
    },
  ];
}
