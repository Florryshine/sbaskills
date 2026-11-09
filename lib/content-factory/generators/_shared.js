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
  if (!result) throw new Error(`Model returned unparseable content across all providers.${errors?.length ? ' Errors: ' + errors.join('; ') : ''}`);
  return result;
}

export const PLATFORM_LIMITS = {
  x: { caption: 280 }, instagram: { caption: 2200, hashtags: 30 },
  facebook: { caption: 63206 }, linkedin: { caption: 3000 },
  telegram: { caption: 1024 }, pinterest: { title: 100, caption: 500 },
  youtube: { title: 100, description: 5000 }, tiktok: { caption: 2200 },
};

export async function generateCarouselSlides(context, { toneNote = '', slideRange = '5-7' } = {}) {
  const prompt = `You are a senior content designer for an exam-prep education brand (Shiney Brain Academy). Design a ${slideRange} slide educational carousel for this topic.

${context}

Carousels work because each slide teaches ONE small idea with minimal text — bold headline + one supporting line. Slide 1 is a hook, middle slides teach step by step, final slide gives a recap or practice prompt.${toneNote ? `\n\n${toneNote}` : ''}

Return ONLY JSON: {"slides":[{"position":1,"headline":"short bold hook, max 8 words","body":"one supporting line, max 15 words"}]}
${slideRange} slides total. No markdown, no extra text.`;
  const data = await generateJson(prompt, { expect: 'object' });
  return data.slides || [];
}

export function buildCarouselRelationshipNote(slides) {
  const slideSummary = (slides || []).map((s) => `Slide ${s.position}: "${s.headline}"`).join(' | ') || 'none';
  return `CAROUSEL RELATIONSHIP
This caption accompanies a carousel that already teaches the lesson. Slides: ${slideSummary}
Do not repeat or re-explain the slides. Add curiosity, relevance, real-life context or a useful detail not already on the slides. The caption and carousel should feel like one complete experience.`;
}

export function buildSharedCaptionNote(captionBase) {
  if (!captionBase) return '';
  return `\n\nSHARED CAPTION FOUNDATION (adapt it to this platform; do not copy blindly):
Hook: ${captionBase.hook || ''}
Core idea: ${captionBase.caption || ''}
CTA: ${captionBase.cta || ''}
Hashtags: ${(captionBase.hashtags || []).join(' ')}
Preserve the educational meaning, adapt tone and length to this platform, and do not add unsupported facts.`;
}

export function buildSharedSeoNote(seo) {
  if (!seo) return '';
  return `\n\nSHARED SEO FOUNDATION (adapt it to the platform):
Title: ${seo.title || ''}
Description: ${seo.description || ''}
Keywords: ${(seo.keywords || []).join(', ')}
Tags: ${(seo.tags || []).join(', ')}
Use these as a factual starting point; respect platform-specific limits and do not keyword-stuff.`;
}
