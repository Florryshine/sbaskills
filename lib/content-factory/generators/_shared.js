// lib/content-factory/generators/_shared.js
//
// Shared helpers used by every per-platform generator. Keeps the
// knowledge-asset → prompt-context step in one place so every generator
// sees the same underlying facts and only differs in tone/format/length.

import { generateWithFallback } from '@/lib/llmFallbackChain';
import { parseJsonFromText } from '@/lib/robustJsonParse';

/**
 * Build the shared "facts block" every platform prompt is grounded in.
 * Keeping this identical across platforms is what prevents the AI from
 * inventing different facts per platform — only tone/format should vary.
 */
export function buildAssetContext(asset) {
  const keyConcepts = (asset.key_concepts || []).slice(0, 5).join(', ') || 'none listed';
  const definitions = (asset.definitions || [])
    .slice(0, 5)
    .map((d) => `${d.term}: ${d.definition}`)
    .join(' | ') || 'none listed';
  const examples = (asset.examples || []).slice(0, 3).join('; ') || 'none listed';
  const facts = (asset.facts || []).slice(0, 5).join('; ') || 'none listed';

  return `Topic: "${asset.keyword}"
Subject: ${asset.subject || 'General'}
Summary: ${asset.summary || 'No summary available.'}
Key concepts: ${keyConcepts}
Key terms: ${definitions}
Examples: ${examples}
Facts: ${facts}`;
}

/**
 * Calls the shared LLM fallback chain and requires strict JSON back.
 * `expect` is 'object' or 'array' — passed straight to parseJsonFromText,
 * which already does fence-stripping / brace-matching / repair.
 */
export async function generateJson(prompt, { expect = 'object', maxTokens = 2048 } = {}) {
  // Was calling generateWithFallback(prompt, { maxTokens, temperature }) —
  // the "just give me raw text from whichever provider responds first"
  // signature — then parsing that single response once. If that one
  // provider's output didn't parse (even with robustJsonParse's cleanup),
  // the whole generator failed immediately with "Model returned
  // unparseable content", with no chance for Groq/OpenRouter/HuggingFace
  // to be tried instead. Using the (prompt, parseFn, validateFn) signature
  // instead makes it actually retry across every provider until one
  // produces genuinely parseable JSON, the same reliability behavior
  // quiz/flashcards/blog/study-notes already get from this same fallback
  // chain. Trade-off: this signature doesn't take a custom `temperature`,
  // so all content-factory prompts now use generateWithFallback's default
  // (0.7) instead of the previous 0.85 — slightly less varied phrasing,
  // but not worth blocking retries over.
  const { result, errors } = await generateWithFallback(
    prompt,
    (text) => parseJsonFromText(text, expect),
    (parsed) => parsed !== null && parsed !== undefined && (expect !== 'array' || Array.isArray(parsed)),
    maxTokens
  );

  if (!result) {
    throw new Error(
      `Model returned unparseable content across all providers.${errors?.length ? ' Errors: ' + errors.join('; ') : ''}`
    );
  }
  return result;
}

export const PLATFORM_LIMITS = {
  x: { caption: 280 },
  instagram: { caption: 2200, hashtags: 30 },
  facebook: { caption: 63206 },
  linkedin: { caption: 3000 },
  telegram: { caption: 1024 }, // photo-caption limit; plain messages allow more
  pinterest: { title: 100, caption: 500 },
  youtube: { title: 100, description: 5000 },
  tiktok: { caption: 2200 },
};

/**
 * Generates the same shape of educational carousel every platform can use,
 * with slide COPY tailored per-platform via `toneNote`/`slideRange`. Visual
 * rendering (colors/layout/size) is a separate concern handled by
 * lib/carousel-engine/render-canvas.js via the `platform` key passed through
 * generator._media.platform — this function only controls the words on
 * each slide.
 */
export async function generateCarouselSlides(context, { toneNote = '', slideRange = '5-7' } = {}) {
  const prompt = `You are a senior content designer for an exam-prep education brand (Shiney Brain Academy). Design a ${slideRange} slide educational carousel for this topic.

${context}

Carousels work because each slide teaches ONE small idea with minimal text — think bold headline + one supporting line, not paragraphs. Slide 1 is a hook (a question or bold claim), the middle slides teach the concept step by step, the last slide is a call-to-action.${toneNote ? `\n\n${toneNote}` : ''}

Return ONLY JSON:
{
  "slides": [
    { "position": 1, "headline": "short bold hook, max 8 words", "body": "one supporting line, max 15 words" }
  ]
}
${slideRange} slides total. No markdown, no extra text.`;

  const data = await generateJson(prompt, { expect: 'object' });
  return data.slides || [];
}

/**
 * Builds the instruction block every caption prompt should include once a
 * carousel already exists for the same post. Without this, captions tend to
 * re-explain the same headlines that are already on the slides, which makes
 * the post feel redundant instead of like one complete experience (hook on
 * the slides, context/reason-to-care in the caption).
 *
 * `slides` is the already-generated slide array so the caption model can see
 * exactly what NOT to repeat, and write something that complements it.
 */
export function buildCarouselRelationshipNote(slides) {
  const slideSummary = (slides || [])
    .map((s) => `Slide ${s.position}: "${s.headline}"`)
    .join(' | ') || 'none';

  return `CAROUSEL RELATIONSHIP
This caption accompanies a carousel that already exists and already teaches the lesson. The carousel's slides are: ${slideSummary}

Assume the reader will see the carousel. Your caption must NOT repeat or re-explain what's already on the slides.

Instead, the caption should:
- create curiosity before the reader swipes/reads the carousel
- explain why this topic actually matters to them right now
- connect the lesson to the reader's real life or exam prep
- add extra context, a story, or a detail that isn't already on the slides

The caption and carousel should feel like one complete experience, not two versions of the same content.`;
}
