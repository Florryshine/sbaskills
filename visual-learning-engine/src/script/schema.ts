// src/script/schema.ts — episode script validation + light repair.
//
// The script is the creative contract between the planner (LLM or template)
// and the deterministic timeline/composition stages. Validation is strict
// about what the renderer needs and forgiving about what it doesn't: unknown
// fields are dropped, minor violations are repaired (trimmed sentences,
// clamped item counts) and reported, hard violations throw.

import type { EpisodeScript, SceneSpec, VLJobSpec } from '../types';

export class ScriptValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScriptValidationError';
  }
}

const SCENE_TYPES = new Set([
  'hook', 'title', 'statement', 'compare', 'list', 'stat', 'process', 'quote', 'recap', 'outro',
]);

export function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === 'number' ? Math.round(v) : Number(v);
  if (!isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function cleanText(v: unknown, maxLen: number): string {
  return typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, maxLen) : '';
}

function cleanImagePrompt(v: unknown): string {
  // Image prompts keep commas/punctuation (they steer the model) but no newlines.
  return typeof v === 'string' ? v.replace(/\s*\n+\s*/g, ', ').replace(/\s+/g, ' ').trim().slice(0, 240) : '';
}

function requireNarration(raw: Record<string, unknown>, index: number): string {
  const narration = cleanText(raw.narration, 1200);
  if (narration.split(' ').length < 4) {
    throw new ScriptValidationError(`scene ${index} (${raw.type}): narration must be at least ~4 words`);
  }
  return narration;
}

/**
 * Validate + repair a parsed script object. Throws ScriptValidationError when
 * the structure cannot be rendered. Returns a normalized copy.
 */
export function validateScript(
  raw: unknown,
  job: Pick<VLJobSpec, 'title' | 'topic' | 'audience' | 'aspect' | 'accent'>,
): EpisodeScript {
  if (!raw || typeof raw !== 'object') throw new ScriptValidationError('script must be an object');
  const r = raw as Record<string, unknown>;
  const metaRaw = (r.meta && typeof r.meta === 'object' ? r.meta : {}) as Record<string, unknown>;
  const scenesRaw = Array.isArray(r.scenes) ? r.scenes : null;
  if (!scenesRaw || scenesRaw.length === 0) throw new ScriptValidationError('script.scenes must be a non-empty array');
  if (scenesRaw.length > 40) throw new ScriptValidationError(`too many scenes (${scenesRaw.length}); keep episodes under 40 scenes`);

  const scenes: SceneSpec[] = scenesRaw.map((s, i) => {
    if (!s || typeof s !== 'object') throw new ScriptValidationError(`scene ${i} must be an object`);
    const sc = s as Record<string, unknown>;
    if (!SCENE_TYPES.has(String(sc.type))) {
      throw new ScriptValidationError(`scene ${i}: unknown type "${String(sc.type)}" (allowed: ${[...SCENE_TYPES].join(', ')})`);
    }
    const narration = requireNarration(sc, i);
    const base = { narration };
    switch (sc.type) {
      case 'hook':
        return {
          type: 'hook',
          ...base,
          headline: cleanText(sc.headline, 90) || job.title.slice(0, 90),
          accentWord: cleanText(sc.accentWord, 24) || undefined,
          image_prompt: cleanImagePrompt(sc.image_prompt) || `a curious student wondering about ${job.topic}, surrounded by question marks`,
        };
      case 'title':
        return {
          type: 'title',
          ...base,
          headline: cleanText(sc.headline, 90) || job.title.slice(0, 90),
          subtitle: cleanText(sc.subtitle, 140) || undefined,
          image_prompt: cleanImagePrompt(sc.image_prompt) || `hero illustration about ${job.topic}`,
        };
      case 'statement': {
        const badgesRaw = Array.isArray(sc.badges) ? sc.badges.slice(0, 3) : [];
        const badges = badgesRaw.flatMap((b) => {
          const bo = (b && typeof b === 'object' ? b : {}) as Record<string, unknown>;
          const label = cleanText(bo.label, 40);
          return label ? [{ label, emoji: cleanText(bo.emoji, 8) || undefined }] : [];
        });
        return {
          type: 'statement',
          ...base,
          headline: cleanText(sc.headline, 110),
          accentWord: cleanText(sc.accentWord, 24) || undefined,
          image_prompt: cleanImagePrompt(sc.image_prompt) || `illustration explaining ${job.topic}`,
          badges,
        };
      }
      case 'compare': {
        const side = (v: unknown, fallbackPrompt: string, fallbackLabel: string) => {
          const so = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
          const toneRaw = String(so.tone || 'neutral');
          const tone = toneRaw === 'good' || toneRaw === 'bad' ? toneRaw : 'neutral';
          return {
            label: cleanText(so.label, 40) || fallbackLabel,
            image_prompt: cleanImagePrompt(so.image_prompt) || fallbackPrompt,
            tone: tone as 'bad' | 'good' | 'neutral',
          };
        };
        return {
          type: 'compare',
          ...base,
          left: side(sc.left, `person struggling with ${job.topic}, tired and confused`, 'OPTION A'),
          right: side(sc.right, `person succeeding at ${job.topic}, confident and happy`, 'OPTION B'),
          versus: cleanText(sc.versus, 12) || 'VS',
        };
      }
      case 'list': {
        const itemsRaw = Array.isArray(sc.items) ? sc.items : [];
        const items = itemsRaw.slice(0, 6).flatMap((it) => {
          const io = (it && typeof it === 'object' ? it : {}) as Record<string, unknown>;
          const text = cleanText(io.text, 90);
          return text ? [{ text, emoji: cleanText(io.emoji, 8) || undefined }] : [];
        });
        if (items.length < 2) throw new ScriptValidationError(`scene ${i} (list): needs at least 2 valid items`);
        return { type: 'list', ...base, title: cleanText(sc.title, 80) || job.title.slice(0, 80), items };
      }
      case 'stat': {
        const source = cleanText(sc.source, 240);
        if (!source) throw new ScriptValidationError(`scene ${i} (stat): factual statistics require a traceable source; remove the stat if no source is available`);
        const number = cleanText(sc.number, 12);
        if (!number) throw new ScriptValidationError(`scene ${i} (stat): number is required`);
        return { type: 'stat', ...base, number, headline: cleanText(sc.headline, 110), source, image_prompt: cleanImagePrompt(sc.image_prompt) || undefined };
      }
      case 'process': {
        const stepsRaw = Array.isArray(sc.steps) ? sc.steps : [];
        const steps = stepsRaw.slice(0, 4).flatMap((it) => {
          const io = (it && typeof it === 'object' ? it : {}) as Record<string, unknown>;
          const text = cleanText(io.text, 80);
          return text ? [{ text, emoji: cleanText(io.emoji, 8) || undefined }] : [];
        });
        if (steps.length < 2) throw new ScriptValidationError(`scene ${i} (process): needs at least 2 valid steps`);
        return { type: 'process', ...base, title: cleanText(sc.title, 80) || job.title.slice(0, 80), steps };
      }
      case 'quote':
        return {
          type: 'quote',
          ...base,
          text: cleanText(sc.text, 260),
          author: cleanText(sc.author, 60),
        };
      case 'recap': {
        const items = (Array.isArray(sc.items) ? sc.items : [])
          .map((it) => cleanText(typeof it === 'string' ? it : (it as Record<string, unknown>)?.text, 110))
          .filter((t) => t.length > 0)
          .slice(0, 5);
        if (items.length < 2) throw new ScriptValidationError(`scene ${i} (recap): needs at least 2 valid items`);
        return { type: 'recap', ...base, title: cleanText(sc.title, 80) || 'Remember this', items };
      }
      case 'outro':
        return {
          type: 'outro',
          ...base,
          headline: cleanText(sc.headline, 90) || job.title.slice(0, 90),
          cta: cleanText(sc.cta, 90) || undefined,
        };
      default:
        throw new ScriptValidationError(`scene ${i}: unreachable`);
    }
  });

  // A valid episode must teach, not merely introduce a topic and tell a story.
  const teachingScenes = scenes.filter((scene) =>
    ['statement', 'compare', 'list', 'stat', 'process'].includes(scene.type),
  );
  if (teachingScenes.length < 2) {
    throw new ScriptValidationError('episode needs at least two substantive teaching scenes (concept explanation, meaningful comparison, useful list, sourced evidence, or real process)');
  }
  const shortTeachingScene = teachingScenes.find((scene) =>
    scene.narration.trim().split(/\\s+/).filter(Boolean).length < 12,
  );
  if (shortTeachingScene) {
    throw new ScriptValidationError('each teaching scene needs an explanation, not just a headline: provide at least 12 spoken words of useful teaching narration');
  }

  const meta = {
    title: cleanText(metaRaw.title, 120) || job.title.slice(0, 120),
    hookHeadline: cleanText(metaRaw.hookHeadline, 120) || job.title.slice(0, 120),
    subtitle: cleanText(metaRaw.subtitle, 160) || `${job.audience} · ${job.topic}`.slice(0, 160),
    style: (['cartoon', 'photo', 'sketch'] as const).includes(metaRaw.style as 'cartoon') ? (metaRaw.style as 'cartoon') : 'cartoon',
    accent: /^#[0-9a-fA-F]{6}$/.test(String(metaRaw.accent)) ? String(metaRaw.accent) : (job.accent || '#E63946'),
  };

  // A hook or title must open the episode; an outro should close it.
  if (scenes[0].type !== 'hook' && scenes[0].type !== 'title') {
    scenes.unshift({
      type: 'title',
      narration: meta.hookHeadline,
      headline: meta.hookHeadline,
      subtitle: meta.subtitle,
      image_prompt: `hero illustration about ${job.topic}`,
    } as SceneSpec);
  }
  if (scenes[scenes.length - 1].type !== 'outro') {
    scenes.push({
      type: 'outro',
      narration: `That's it for this one. Keep learning, keep asking questions, and I'll see you in the next video.`,
      headline: meta.title,
      cta: 'Subscribe for more visual learning.',
    } as SceneSpec);
  }

  return { meta, scenes };
}
