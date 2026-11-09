// lib/content-factory/generators/_shared.js
import { generateWithFallback } from '@/lib/llmFallbackChain';
import { parseJsonFromText } from '@/lib/robustJsonParse';
import { buildKnowledgeContext } from '@/lib/ka-package/context';

export function buildAssetContext(asset) {
  return buildKnowledgeContext(asset, { includeRawContent: false });
}

export async function generateJson(prompt, { expect = 'object', maxTokens = 2048 } = {}) {
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
  telegram: { caption: 1024 },
  pinterest: { title: 100, caption: 500 },
  youtube: { title: 100, description: 5000 },
  tiktok: { caption: 2200 },
};

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
