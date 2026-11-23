// Script analysis for the Motion Graphics Engine.
// Splits a raw script into scenes, extracts emphasis words, numbers and
// content signals (questions, lists, comparisons, processes, definitions)
// that drive layout selection in the scene planner.

import { Rng, hashSeed } from './random.js';

const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'if', 'then', 'else', 'when', 'at', 'by', 'for',
  'with', 'about', 'against', 'between', 'into', 'through', 'during', 'before', 'after',
  'above', 'below', 'to', 'from', 'up', 'down', 'in', 'out', 'on', 'off', 'over', 'under',
  'again', 'further', 'once', 'here', 'there', 'all', 'any', 'both', 'each', 'few', 'more',
  'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than',
  'too', 'very', 'can', 'will', 'just', 'should', 'now', 'is', 'are', 'was', 'were', 'be',
  'been', 'being', 'have', 'has', 'had', 'having', 'do', 'does', 'did', 'doing', 'would',
  'could', 'ought', 'it', 'its', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she',
  'we', 'they', 'them', 'his', 'her', 'their', 'our', 'your', 'my', 'me', 'him', 'us',
  'what', 'which', 'who', 'whom', 'how', 'why', 'where', 'because', 'as', 'until', 'while',
  'also', 'even', 'ever', 'never', 'always', 'often', 'sometimes', 'still', 'get', 'got',
  'make', 'made', 'want', 'wanted', 'know', 'known', 'thing', 'things', 'way', 'ways',
  'lot', 'lots', 'like', 'unlike', 'okay', 'ok', 'yes', 'yeah', 'oh', 'well', 'let', 'lets',
]);

const NUMBER_RE = /(?:₦|\$|€|£)?\d[\d,]*(?:\.\d+)?\s*(?:%|percent|million|billion|trillion|thousand|k|m|bn|hrs?|hours?|minutes?|mins?|seconds?|secs?|days?|weeks?|months?|years?|x|times)?/gi;

const SIGNAL_WORDS = {
  question: /^(what|why|how|when|where|who|which|can|do|does|did|is|are|could|would|should)\b.*\?$/i,
  list: ['first', 'second', 'third', 'next', 'finally', 'one,', 'two,', 'three,', '1.', '2.', '3.', 'another', 'also', 'plus'],
  compare: ['vs', 'versus', 'more than', 'less than', 'better than', 'worse than', 'instead', 'rather than', 'compared', 'while', 'whereas', 'difference'],
  process: ['step', 'first', 'then', 'next', 'after that', 'finally', 'process', 'how to', 'method', 'guide', ' stages'],
  definition: [' is ', ' are ', ' means ', ' refers to', ' defined as', ' called ', ' known as'],
  quote: ['"', '“', '”', 'once said', 'famous', 'quote'],
  emphasizers: ['most', 'best', 'worst', 'never', 'always', 'everything', 'nothing', 'everyone', 'key', 'important', 'critical', 'essential', 'huge', 'massive', 'tiny', 'shocking', 'secret', 'proven', 'free', 'instantly', 'forever'],
};

function splitSentences(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"“'(])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function extractNumbers(text) {
  const matches = String(text || '').match(NUMBER_RE) || [];
  return matches
    .map((m) => m.trim())
    .filter((m) => /\d/.test(m))
    .slice(0, 6);
}

function keywordScores(text) {
  const counts = new Map();
  const words = String(text || '').toLowerCase().match(/[a-z][a-z'’-]{2,}/g) || [];
  for (const raw of words) {
    const word = raw.replace(/['’-]+$/, '');
    if (STOPWORDS.has(word) || word.length < 3) continue;
    counts.set(word, (counts.get(word) || 0) + 1);
  }
  return counts;
}

function topKeywords(text, limit) {
  return [...keywordScores(text).entries()]
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .slice(0, limit)
    .map(([w]) => w);
}

function detectSignals(sentence) {
  const lower = ' ' + sentence.toLowerCase() + ' ';
  const signals = {
    question: SIGNAL_WORDS.question.test(sentence.trim()) || /\?/.test(sentence),
    list: SIGNAL_WORDS.list.some((w) => lower.includes(w)),
    compare: SIGNAL_WORDS.compare.some((w) => lower.includes(w)),
    process: SIGNAL_WORDS.process.some((w) => lower.includes(w)),
    definition: SIGNAL_WORDS.definition.some((w) => lower.includes(w)),
    quote: SIGNAL_WORDS.quote.some((w) => sentence.includes(w)),
  };
  return signals;
}

function emphasisWords(sentence, globalCounts) {
  const local = keywordScores(sentence);
  const words = String(sentence).match(/[A-Za-z][A-Za-z'’-]{2,}/g) || [];
  const scored = [];
  for (const raw of words) {
    const word = raw.replace(/['’-]+$/, '');
    const lower = word.toLowerCase();
    if (STOPWORDS.has(lower) || lower.length < 3) continue;
    const globalShare = (globalCounts.get(lower) || 1);
    // local rarity + global frequency = worth highlighting
    const score = (local.get(lower) || 1) * 2 + Math.min(globalShare, 4) + lower.length / 8;
    scored.push({ word: raw, score });
  }
  // emphasizer boost
  const lowerSentence = sentence.toLowerCase();
  const boosted = scored.map((s) => ({
    ...s,
    score: s.score + (SIGNAL_WORDS.emphasizers.some((e) => s.word.toLowerCase().includes(e)) ? 3 : 0),
  }));
  const seen = new Set();
  const picked = [];
  for (const { word } of boosted.sort((a, b) => b.score - a.score)) {
    const key = word.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    picked.push(word);
    if (picked.length >= 2) break;
  }
  return picked;
}

function makeHeading(sentence, keywords, index, rng) {
  const cleanSentence = sentence.replace(/[.!?]+$/, '');
  const words = cleanSentence.split(/\s+/).filter(Boolean);
  if (words.length <= 6) return cleanSentence.toUpperCase();
  // Heading = densest window of 3-5 words (punctuation stripped)
  const scores = keywordScores(cleanSentence);
  let best = null;
  const clean = (w) => w.replace(/[^\w'\-]/g, '');
  for (let size = Math.min(4, words.length); size >= 3; size--) {
    for (let i = 0; i + size <= words.length; i++) {
      const windowWords = words.slice(i, i + size).map(clean).filter(Boolean);
      if (windowWords.length < size) continue;
      const window = windowWords.join(' ');
      const score = windowWords.reduce((acc, w) => acc + (scores.get(w.toLowerCase()) || 0.2), 0) / size;
      if (!best || score > best.score) best = { text: window, score };
    }
    if (best) break;
  }
  const base = best && best.score > 0.6 ? best.text : keywords[0] || `Scene ${index + 1}`;
  return String(base).replace(/[^\w'\- ]/g, '').trim().toUpperCase().slice(0, 42);
}

function estimateDuration(text, wordsPerSecond = 2.6) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean).length;
  return Math.max(2.2, Math.min(14, words / wordsPerSecond + 1.1));
}

// Group sentences into scenes of 1-2 sentences, respecting natural beats.
export function segmentScript(scriptText, opts = {}) {
  const { seed = hashSeed(scriptText), maxScenes = 12 } = opts;
  const rng = new Rng(seed);
  const sentences = splitSentences(scriptText);
  if (!sentences.length) return [];

  const totalWords = String(scriptText || '').split(/\s+/).filter(Boolean).length;
  // Short scripts (reels/loops) get finer scene granularity.
  const maxGroupWords = totalWords < 90 ? 14 : 22;

  const groups = [];
  let current = [];
  for (const sentence of sentences) {
    const sentenceWords = sentence.split(/\s+/).length;
    const currentWords = current.reduce((a, s) => a + s.split(/\s+/).length, 0);
    // A long sentence starts a scene of its own; otherwise accumulate up to
    // the adaptive word budget so scenes stay punchy.
    if (current.length && (currentWords + sentenceWords > maxGroupWords || sentenceWords > 20)) {
      groups.push(current);
      current = [sentence];
    } else {
      current.push(sentence);
    }
  }
  if (current.length) groups.push(current);

  // Merge tiny trailing groups; cap the scene count by merging the least
  // distinctive neighbors (keeps every scene meaningful, no 1-word scenes).
  const capped = [];
  for (const group of groups) {
    if (capped.length && capped.length >= maxScenes) {
      capped[capped.length - 1].push(...group);
    } else {
      capped.push(group);
    }
  }

  return capped.map((group, index) => {
    const narration = group.join(' ').trim();
    const signals = detectSignals(narration);
    return {
      index,
      id: `s${index + 1}`,
      narration,
      signals,
      numbers: extractNumbers(narration),
      isIntro: index === 0,
      isOutro: index === capped.length - 1,
    };
  });
}

export function analyzeScript(scriptText, opts = {}) {
  const seed = opts.seed ?? hashSeed(scriptText || opts.topic || 'motion');
  const scenes = segmentScript(scriptText, { seed, maxScenes: opts.maxScenes });
  const globalCounts = keywordScores(scriptText);
  const keywords = topKeywords(scriptText, 10);
  const totalWords = String(scriptText || '').split(/\s+/).filter(Boolean).length;

  for (const scene of scenes) {
    scene.emphasis = emphasisWords(scene.narration, globalCounts);
    scene.heading = makeHeading(scene.narration, keywords, scene.index, new Rng(seed ^ scene.index));
    scene.estimatedDuration = estimateDuration(scene.narration);
  }

  const signalCounts = scenes.reduce((acc, scene) => {
    for (const [key, on] of Object.entries(scene.signals)) if (on) acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  return {
    seed,
    scenes,
    keywords,
    numbers: scenes.flatMap((s) => s.numbers).slice(0, 12),
    totalWords,
    sceneCount: scenes.length,
    signalCounts,
    estimatedTotalDuration: scenes.reduce((a, s) => a + s.estimatedDuration, 0),
    averageSceneDuration: scenes.length ? scenes.reduce((a, s) => a + s.estimatedDuration, 0) / scenes.length : 0,
    wordsPerSecond: 2.6,
  };
}
