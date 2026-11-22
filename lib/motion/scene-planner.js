// Scene planner: turns analyzed script scenes into concrete composition
// specs (layout archetype, element recipes, camera, transition, SFX).
// Selection is signal-driven but seeded, with anti-repetition guards so the
// same layout rarely repeats back-to-back and no scene is left empty.

import { Rng } from './random.js';

const TRANSITION_DURATION = 0.55;

// Layouts each scene composition may use, with the signals that favor them.
const LAYOUT_POOL = [
  { key: 'kineticHeadline', weight: (s) => (s.isIntro ? 3 : s.emphasis.length ? 1.4 : 1) },
  { key: 'counterFocus', weight: (s) => (s.numbers.length ? 5 : 0) },
  { key: 'dataViz', weight: (s) => (s.numbers.length >= 2 ? 3.4 : 0) },
  { key: 'splitCompare', weight: (s) => (s.signals.compare ? 4.5 : 0.08) },
  { key: 'flowSteps', weight: (s) => (s.signals.process ? 4.5 : 0.1) },
  { key: 'staggerList', weight: (s) => (s.signals.list ? 3.6 : 0.5) },
  { key: 'questionReveal', weight: (s) => (s.signals.question ? 5 : 0.05) },
  { key: 'quoteCard', weight: (s) => (s.signals.quote ? 4 : 0.12) },
  { key: 'definitionCard', weight: (s) => (s.signals.definition && !s.isIntro ? 2.6 : 0.15) },
  { key: 'radialBurst', weight: (s) => (s.isOutro ? 2 : 0.8) },
  { key: 'gridReveal', weight: (s) => (s.signals.list ? 2.4 : 0.5) },
  { key: 'spotlight', weight: (s) => (s.signals.dramaticHint ? 2.5 : 0.5) },
  { key: 'timelineTrack', weight: (s) => (s.signals.process ? 2 : 0.3) },
  { key: 'waveFocus', weight: (s) => (s.isOutro ? 1.6 : 0.7) },
];

// Which vocabularies each layout consumes from the direction.
const LAYOUT_SHAPES = {
  kineticHeadline: ['lines', 'dots', 'rings'],
  counterFocus: ['counters', 'rings', 'ticks'],
  dataViz: ['bars', 'lines', 'grid'],
  splitCompare: ['split', 'slashes', 'arrows'],
  flowSteps: ['steps', 'arrows', 'nodes'],
  staggerList: ['bullets', 'dots', 'brackets'],
  questionReveal: ['rings', 'brackets', 'lines'],
  quoteCard: ['frames', 'lines'],
  definitionCard: ['brackets', 'lines', 'dots'],
  radialBurst: ['rays', 'rings', 'particles'],
  gridReveal: ['tiles', 'grid', 'dots'],
  spotlight: ['beam', 'particles', 'dots'],
  timelineTrack: ['track', 'dots', 'arrows'],
  waveFocus: ['waveform', 'bars'],
};

function pickTransition(direction, rng, previous, sceneIndex) {
  const pool = direction.transitions.filter((t) => t !== previous || direction.transitions.length === 1);
  const chosen = rng.pick(pool.length ? pool : direction.transitions);
  return {
    type: chosen,
    direction: rng.pick(['left', 'right', 'up', 'down']),
    duration: Math.max(0.32, TRANSITION_DURATION * (direction.cutSpeed || 1)),
  };
}

function pickCamera(direction, rng, previous) {
  const pool = direction.camera.filter((c) => c !== previous);
  return rng.pick(pool.length ? pool : direction.camera);
}

function sfxForScene(direction, scene, duration, rng) {
  if (!direction.sfxKit?.length) return [];
  const events = [];
  if (rng.chance(0.85)) events.push({ type: rng.pick(['impact', 'pop']), at: 0.05, strength: scene.isIntro ? 1 : 0.8 });
  if (duration > 4 && rng.chance(0.6)) events.push({ type: rng.pick(['shimmer', 'tick']), at: duration * 0.55, strength: 0.5 });
  return events;
}

function vizForScene(scene, rng, density) {
  const numbers = scene.numbers || [];
  if (scene.signals.compare) {
    return { type: 'compare', left: { label: (scene.emphasis[0] || 'Option A').toUpperCase(), value: numbers[0] || 'A' }, right: { label: (scene.emphasis[1] || 'Option B').toUpperCase(), value: numbers[1] || 'B' } };
  }
  if (scene.numbers.length >= 2 && rng.chance(0.7)) {
    const values = numbers.map((n) => {
      const parsed = parseFloat(String(n).replace(/[^\d.]/g, ''));
      return Number.isFinite(parsed) && parsed > 0 ? parsed : Math.round(rng.float(12, 96));
    });
    return { type: rng.chance(0.5) ? 'bars' : 'line', labels: numbers, values: values.slice(0, 6) };
  }
  if (numbers.length === 1) {
    return { type: 'ring', label: scene.heading, value: numbers[0] };
  }
  return null;
}

function stepsForScene(scene, rng) {
  // Derive 2-4 steps from process sentences or emphasis words.
  const parts = scene.narration
    .split(/,\s|\.\s|;\s| then /i)
    .map((p) => p.trim())
    .filter((p) => p.length > 6)
    .slice(0, 4);
  if (parts.length >= 2) return parts.map((p, i) => ({ label: p.split(/\s+/).slice(0, 5).join(' ').replace(/[.,]$/, ''), step: i + 1 }));
  const words = scene.emphasis.length ? scene.emphasis : [scene.heading];
  return words.slice(0, 3).map((w, i) => ({ label: String(w).toUpperCase(), step: i + 1 }));
}

function listItemsForScene(scene, rng) {
  const headingKey = String(scene.heading || '').toLowerCase();
  const parts = scene.narration
    .split(/,\s|\.\s|;\s|\band\b|\bor\b/i)
    .map((p) => p.trim().replace(/[.,;]$/, ''))
    .filter((p) => p.length > 4 && p.length < 70)
    .filter((p) => p.toLowerCase() !== headingKey);
  if (parts.length >= 3) return parts.slice(0, 5);
  // Fall back to emphasis words + top narration keywords, never the heading itself.
  const fallback = [...new Set([...(scene.emphasis || []), ...(scene.keywordsSlice || [])])]
    .filter((w) => w && w.toLowerCase() !== headingKey)
    .map((w) => String(w).toUpperCase())
    .slice(0, 4);
  return fallback.length >= 2 ? fallback : [String(scene.heading || 'KEY IDEA').toUpperCase(), ...(scene.emphasis || []).map((w) => String(w).toUpperCase())].slice(0, 3);
}

/**
 * Plan all scenes.
 * @param {object} args
 * @param {Array} args.scenes       analyzed scenes from analyzeScript
 * @param {object} args.direction   chosen direction
 * @param {number} args.seed        master seed
 * @param {object} args.narrationDurations optional map sceneId -> seconds
 * @param {number} args.durationScale multiply estimated durations (e.g. narration length)
 */
export function planScenes({ scenes, direction, seed, narrationDurations = {}, durationScale = 1 }) {
  const used = [];
  return scenes.map((scene) => {
    const rng = new Rng((seed ^ (scene.index * 0x9e3779b9)) >>> 0);

    // Weighted layout choice with repetition penalty (avoid same layout twice
    // in a row; halve weight of layouts used within the last two scenes).
    const weighted = LAYOUT_POOL.map((entry) => {
      let w = entry.weight(scene);
      if (used[used.length - 1] === entry.key) w *= 0.05;
      if (used[used.length - 2] === entry.key) w *= 0.45;
      if (used[used.length - 3] === entry.key) w *= 0.75;
      return { key: entry.key, w: Math.max(w, 0.02) };
    });
    const layout = rng.weighted(weighted, (x) => x.w).key;
    used.push(layout);

    const duration = (narrationDurations[scene.id] || scene.estimatedDuration) * durationScale;
    const transition = pickTransition(direction, rng, used.transitions?.at(-1), scene.index);
    if (!used.transitions) used.transitions = [];
    used.transitions.push(transition.type);

    const spec = {
      id: scene.id,
      index: scene.index,
      heading: scene.heading,
      narration: scene.narration,
      emphasis: scene.emphasis,
      numbers: scene.numbers,
      layout,
      durationSeconds: Math.max(2, Number(duration.toFixed(3))),
      seed: rng.int(1, 2 ** 31),
      camera: pickCamera(direction, rng, used.camera?.at(-1)),
      transition,
      sfx: sfxForScene(direction, scene, duration, rng),
      shapes: LAYOUT_SHAPES[layout] || ['dots'],
      accentWord: scene.emphasis[0] || null,
      showSubtitle: true,
    };
    if (!used.camera) used.camera = [];
    used.camera.push(spec.camera);

    // Layout-specific payload
    if (layout === 'counterFocus') {
      const raw = scene.numbers[0] || '';
      const numeric = parseFloat(String(raw).replace(/[^\d.]/g, ''));
      spec.counter = {
        value: Number.isFinite(numeric) ? numeric : rng.int(10, 999),
        prefix: /[₦]/.test(raw) ? '₦' : /[$]/.test(raw) ? '$' : '',
        suffix: /%|percent/i.test(raw) ? '%' : /million/i.test(raw) ? 'M' : /billion/i.test(raw) ? 'B' : /x\b/i.test(raw) ? 'x' : '',
        decimals: /\./.test(String(raw)) ? 1 : 0,
        label: scene.emphasis[0] ? scene.emphasis[0].toUpperCase() : scene.heading,
      };
    }
    if (layout === 'dataViz') {
      spec.viz = vizForScene(scene, rng, direction.layoutDensity) || { type: 'bars', labels: scene.emphasis.slice(0, 3), values: scene.emphasis.slice(0, 3).map(() => Math.round(rng.float(30, 95))) };
    }
    if (layout === 'flowSteps' || layout === 'timelineTrack') {
      spec.steps = stepsForScene(scene, rng);
    }
    if (layout === 'staggerList' || layout === 'gridReveal') {
      spec.items = listItemsForScene(scene, rng);
    }
    if (layout === 'splitCompare') {
      spec.compare = {
        left: { label: (scene.emphasis[0] || 'THIS WAY').toUpperCase(), value: scene.numbers[0] || null },
        right: { label: (scene.emphasis[1] || 'THAT WAY').toUpperCase(), value: scene.numbers[1] || null },
      };
    }
    if (layout === 'questionReveal') {
      spec.question = scene.narration.replace(/\?$/, '').slice(0, 120);
      spec.answer = scene.emphasis[0] ? String(scene.emphasis[0]).toUpperCase() : null;
    }
    if (layout === 'quoteCard') {
      spec.quote = scene.narration.replace(/^["“]|["”]$/g, '').slice(0, 180);
    }
    if (layout === 'definitionCard') {
      const match = scene.narration.match(/^(.{2,40}?)\s+(?:is|are|means|refers to)\s+(.{10,})/i);
      const PRONOUN_TERMS = new Set(['we', 'it', 'they', 'this', 'that', 'these', 'those', 'there', 'here', 'you', 'everyone', 'someone', 'anything', 'everything', 'people']);
      const rawTerm = (match ? match[1] : '').trim();
      const termOk = rawTerm.length >= 4 && !PRONOUN_TERMS.has(rawTerm.toLowerCase());
      spec.definition = {
        term: (termOk ? rawTerm : (scene.emphasis[0] || scene.heading)).trim().toUpperCase(),
        body: (termOk ? match[2] : scene.narration).trim().slice(0, 160),
      };
    }
    if (layout === 'radialBurst' || layout === 'waveFocus') {
      spec.focusWord = (scene.emphasis[0] || scene.heading).toUpperCase().slice(0, 16);
    }
    return spec;
  });
}

/** Re-plan a single scene with a fresh variation seed (scene regeneration). */
export function replanScene(spec, direction, seedBump = 1) {
  const fakeAnalyzed = {
    index: spec.index,
    id: spec.id,
    narration: spec.narration,
    signals: { question: /\?/.test(spec.narration), list: /,|\band\b/i.test(spec.narration), compare: /\bvs\b|more than|better than/i.test(spec.narration), process: /\bstep\b|first|then|finally/i.test(spec.narration), definition: / is |means|refers to/i.test(' ' + spec.narration + ' '), quote: /["“]/.test(spec.narration) },
    numbers: spec.numbers || (spec.narration.match(/\d[\d,.]*/g) || []),
    emphasis: spec.emphasis?.length ? spec.emphasis : [],
    estimatedDuration: spec.durationSeconds,
    heading: spec.heading,
    isIntro: spec.index === 0,
    isOutro: false,
    keywordsSlice: [],
  };
  const planned = planScenes({ scenes: [fakeAnalyzed], direction, seed: (spec.seed + seedBump * 2654435761) >>> 0 });
  const next = planned[0];
  // Preserve user-authored text fields.
  return { ...next, id: spec.id, index: spec.index, heading: spec.heading, narration: spec.narration, durationSeconds: spec.durationSeconds, emphasis: spec.emphasis };
}
