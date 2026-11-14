// src/narration/align.ts — word timing reconstruction for providers that
// don't expose word boundaries (proportional alignment from measured audio).

import type { WordTiming } from '../types';

const F = (n: number) => Math.round(n * 1000) / 1000;

/**
 * Proportionally distribute words across a measured duration.
 * Longer words get proportionally more time; sentence-ending punctuation
 * adds a small pause. This is a good approximation of neural-TTS pacing.
 */
export function proportionalWords(text: string, duration: number, startOffset = 0.06): WordTiming[] {
  const rawWords = text.trim().split(/\s+/).filter(Boolean);
  if (rawWords.length === 0) return [];

  const weights = rawWords.map((w) => {
    let weight = Math.max(1, w.replace(/[^\w]/g, '').length) + 1;
    if (/[.!?;:,]$/.test(w)) weight += 2.2; // pause after punctuation
    return weight;
  });
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const speech = Math.max(0.4, duration - startOffset);

  const words: WordTiming[] = [];
  let t = startOffset;
  for (let i = 0; i < rawWords.length; i++) {
    const share = (weights[i] / totalWeight) * speech;
    words.push({
      word: rawWords[i],
      start: F(t),
      end: F(t + share * 0.94), // tiny inter-word gap
    });
    t += share;
  }
  return words;
}
