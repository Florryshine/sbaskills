// src/imagery/style.ts — style presets and the style-locked prompt builder.
//
// All image providers receive prompts through here so every illustration in
// an episode shares one visual language (the psych-edu explainer look):
// flat hand-drawn cartoons on warm paper-white, thick clean outlines, a
// restrained palette, generous negative space, never any embedded text.

import type { StylePreset } from '../types';

export const STYLE_PRESETS: Record<StylePreset, { label: string; prefix: string; suffix: string; negative: string }> = {
  cartoon: {
    label: 'Flat cartoon (explainer)',
    prefix:
      'flat 2D cartoon illustration in a consistent children educational book style, thick clean dark outlines, simple geometric shapes, soft flat colors with one warm accent, plain warm off-white paper background, generous empty margins around the subject',
    suffix: 'centered composition, expressive friendly character, high clarity, professional explainer video art',
    negative: 'no words, no letters, no numbers, no captions, no watermark, no signature, no photo, no realistic shading, no busy background, no border frame',
  },
  photo: {
    label: 'Documentary photo',
    prefix: 'professional editorial photograph, natural colors, soft depth of field, clean uncluttered composition, bright even lighting',
    suffix: 'realistic, high resolution, subject clearly visible and centered',
    negative: 'no words, no letters, no watermark, no caption, no collage',
  },
  sketch: {
    label: 'Ink sketch',
    prefix: 'hand-drawn ink sketch illustration, confident linework, light watercolor washes, cream paper background, sketchbook aesthetic',
    suffix: 'clear readable subject, centered, calm composition',
    negative: 'no words, no letters, no numbers, no watermark, no signature, no clutter',
  },
};

/** Build the full style-locked prompt for one scene's subject. */
export function buildImagePrompt(subject: string, style: StylePreset, aspectHint: 'wide' | 'square' | 'tall', variation = ''): string {
  const preset = STYLE_PRESETS[style];
  const hint =
    aspectHint === 'wide'
      ? 'horizontal composition'
      : aspectHint === 'tall'
        ? 'vertical composition'
        : 'square composition';
  const varText = variation ? ` ${variation}.` : '.';
  return `${preset.prefix}. ${subject}${varText} ${hint}. ${preset.suffix}. ${preset.negative}`;
}

/**
 * Per-shot CONTENT variations: each shot is a genuinely different
 * illustration of the story beat (different metaphor / moment / focus), so
 * the <=3s carousel shows new pictures instead of one picture re-framed.
 */
export const SHOT_VARIATIONS: string[] = [
  '', // shot 0: the prompt as written
  'a different visual metaphor for the same idea: show it with objects and symbols instead of people',
  'the surroundings of the same story moment: the place, the tools, the environment',
  'the same idea drawn as a simple symbolic scene with arrows, shapes and icons',
  'a contrasting scene: what goes wrong when this idea is ignored',
  'the same idea happening at a different time of day or in a different place',
  'a joyful scene showing the idea succeeding, characters celebrating the result',
  'a quiet close scene focused on the single most important object of the idea',
];

/** Stop words dropped when turning an image prompt into a stock search query. */
const STOPWORDS = new Set(
  ('a an the with of for and or in on at to from showing show scene concept about ' +
    'illustration cartoon flat vector style simple metaphor symbol symbols person people ' +
    'characters character idea ideas key visual around its what when where how why ' +
    'glowing happy sad tired fresh clean moment story instead drawn shown accurate educational visual explaining this specific lesson point relevant subject matter correct relationships directly depicting central real components clearly only')
    .split(' '),
);

/** Stock search keyword variants — short queries are what stock APIs match on. */
const STOCK_ANGLES = ['', 'closeup', 'classroom', 'books', 'desk', 'night', 'study', 'success'];

/**
 * Build a SHORT keyword query per shot from an image prompt. Stock APIs AND
 * all terms, so more than ~3 keywords returns zero results (Commons/Openverse
 * even 3 is risky): default 2 core keywords + 1 angle word.
 */
export function stockQueryFrom(subject: string, shotIndex = 0, maxTerms = 2, withAngle = true): string {
  const cleaned = subject
    .replace(/flat 2D cartoon illustration[^:.]*[.:]/gi, '')
    .replace(/illustration showing|illustration of|a cartoon|cartoon/gi, '')
    .replace(/[^\w\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const keywords = cleaned
    .split(/\s+/)
    .map((w) => w.toLowerCase())
    .filter((w) => w.length > 2 && !STOPWORDS.has(w))
    .filter((w, i, all) => all.indexOf(w) === i)
    .slice(0, maxTerms);
  const base = keywords.join(' ') || 'education learning';
  if (!withAngle) return base;
  const angle = STOCK_ANGLES[shotIndex % STOCK_ANGLES.length];
  return `${base} ${angle}`.trim();
}
