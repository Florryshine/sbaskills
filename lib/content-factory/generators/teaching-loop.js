// lib/content-factory/generators/teaching-loop.js
//
// "Teaching Loop": a punchy, attention-grabbing ~2 minute vertical video
// that actually TEACHES or fully summarizes one topic — longer than a
// youtube_short (which is under 60s and just hooks/samples a topic), but
// still built to hold attention the whole way through, not a lecture.
//
// NOT rendered through Remotion/lib/video-engine — same technique as
// QuoteLoopRecorder/PastQuestionLoopRecorder: this only writes the script
// (segments of text), and TeachingLoopRecorder.js turns it into a real
// video entirely in the browser via <canvas> + Web Audio + MediaRecorder,
// no laptop worker, no server render step. See
// app/api/admin/teaching-loops/generate/route.js for how the script +
// one background candidate get saved as a draft, and
// components/TeachingLoopRecorder.js for how it's recorded.
//
// Kept OUT of the platforms GENERATORS registry in content-factory/index.js
// on purpose (same reasoning as quote_loop/meme_loop/countdown_loop: this
// isn't a per-platform caption, it's a standalone content type with its
// own admin page and generate/list routes).

import { buildAssetContext, generateJson } from './_shared';

// This is a SILENT video (background music only, no voiceover) — the
// viewer reads each segment's text card the way they'd read a quote-loop
// or past-question-loop, just cycling through many of them instead of one.
// Reading silently is slower than listening, so segment hold-times below
// are budgeted generously (~150 words/minute reading pace, same estimate
// narration.js already used, but applied to on-screen dwell time instead
// of speech) — see estimateHoldSeconds() below.
const TARGET_TOTAL_SECONDS = 120;

export async function generateTeachingScript(asset) {
  const context = buildAssetContext(asset);

  const prompt = `You are writing the text cards for a "Teaching Loop" — a punchy, fast-paced, ~2 minute SILENT vertical video (9:16, like a long-form TikTok/Reel with background music but no voiceover) for Shiney Brain Academy, a Nigerian exam-prep brand (JAMB/WAEC/NECO/Post-UTME). The viewer reads each card as it appears — this one actually TEACHES the topic well enough that a student watching alone could learn it, but every card must stay short and punchy since it has to be readable in a few seconds, never a wall of text.

${context}

STRUCTURE — break the script into 10-14 segments (each segment = one text card, short enough to read in 6-11 seconds). Follow this arc:
1. HOOK (segment 1 only): a surprising fact, bold claim, or direct callout about this topic — never a generic "today we're learning about X" intro. Must make someone stop scrolling.
2. WHY IT MATTERS (1-2 segments): a fast, concrete reason this topic actually costs students marks or shows up on the exam — grounds the video in stakes before teaching begins.
3. THE TEACHING CORE (bulk of the segments): break the concept into its real sub-parts and teach each one clearly and in order, using the actual key concepts/definitions/examples/facts given above — not invented content. Keep every card punchy: short sentences, one idea per card, concrete language over abstract language. Use rhetorical questions and direct address ("you") every few cards to keep momentum instead of reading like a textbook.
4. COMMON MISTAKE (1 segment): the single most common way students get this topic wrong on JAMB/WAEC/NECO/Post-UTME.
5. RECAP (1 segment): compress the whole lesson into one tight, memorable line — not a repeat of everything said, a distillation.
6. CTA (1 segment): a short call to action pointing at Shiney Brain Academy for more practice on this topic.

For each segment give:
- "text": the exact words on the card. Max 2 short sentences (roughly 12-22 words) — it has to be readable at a glance, not a paragraph.
- "label": a 2-4 word tag shown above the text identifying the beat (e.g. "WATCH OUT", "HERE'S WHY", "THE FIX") — vary these across the script, don't reuse the same label twice.

Also produce:
- "title": a punchy, specific video title under 100 characters (not a generic topic restatement — built from the hook/angle)
- "description": 2-3 sentences (40-70 words) expanding on the video for search/context, written for humans, naturally including the topic and subject keywords
- "tags": 8-12 short lowercase SEO keyword phrases (e.g. "jamb physics", "exam tips nigeria")
- "hashtags": 5-8 hashtags (with #, no spaces) mixing topic-specific and brand/exam-general tags
- "visualQuery": 3-6 words describing a single background scene (video or photo) that fits the WHOLE topic — this plays behind every card in the video, so keep it general to the subject rather than tied to one specific segment (e.g. "student writing exam nigeria")

Rules:
- No hashtags or emoji inside text/label/title/description — hashtags only belong in the "hashtags" field.
- No quotation marks around any part.
- Every segment's "text" must connect to real facts/concepts from the topic above — never generic filler that could apply to any topic.
- Don't pad segments just to hit the count — if the concept genuinely only needs fewer teaching cards, keep WHY IT MATTERS/COMMON MISTAKE substantial instead of stretching thin content.

Return ONLY JSON:
{
  "segments": [{ "text": "...", "label": "..." }],
  "title": "...",
  "description": "...",
  "tags": ["..."],
  "hashtags": ["#..."],
  "visualQuery": "..."
}`;

  const data = await generateJson(prompt, { expect: 'object', maxTokens: 3072 });
  const segments = Array.isArray(data.segments) ? data.segments : [];

  if (segments.length === 0) {
    throw new Error('Teaching loop generation returned no segments');
  }

  return {
    segments,
    title: data.title || asset.keyword,
    description: data.description || '',
    tags: Array.isArray(data.tags) ? data.tags : [],
    hashtags: Array.isArray(data.hashtags) ? data.hashtags : [],
    visualQuery: data.visualQuery || [asset.subject, asset.keyword].filter(Boolean).join(' '),
  };
}

/**
 * Budgets each segment a hold-time (seconds on screen) proportional to its
 * word count, floored so short cards ("THE FIX") still get a fair read,
 * then scaled so the whole script totals TARGET_TOTAL_SECONDS — used by
 * TeachingLoopRecorder.js to drive its draw() timeline.
 */
export function estimateSegmentTimings(segments) {
  const MIN_HOLD = 5;
  const raw = segments.map((s) => {
    const words = String(s.text || '').trim().split(/\s+/).filter(Boolean).length;
    return Math.max(MIN_HOLD, (words / 150) * 60 + 2); // +2s settle/read buffer per card
  });
  const rawTotal = raw.reduce((a, b) => a + b, 0);
  const scale = rawTotal > 0 ? TARGET_TOTAL_SECONDS / rawTotal : 1;
  return raw.map((s) => Math.max(MIN_HOLD * 0.7, s * scale));
}

export { TARGET_TOTAL_SECONDS };
