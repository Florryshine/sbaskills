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
export async function generateJson(prompt, { expect = 'object', maxTokens = 2048, temperature = 0.85 } = {}) {
  const text = await generateWithFallback(prompt, { maxTokens, temperature });
  const parsed = parseJsonFromText(text, expect);
  if (!parsed) throw new Error('Model returned unparseable content');
  return parsed;
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
