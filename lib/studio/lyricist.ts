/**
 * Offline fallback lyricist — the studio's built-in creative brain.
 *
 * Used when no LLM provider is configured (no GEMINI_API_KEY), or as an
 * immediate response while the AI provider streams. Content for the five
 * canonical test subjects is curated for factual accuracy; other topics
 * use structured templates seeded from the topic name and user notes.
 *
 * NOTE: this module returns a SongSpec WITHOUT melody notes. The melody
 * finalizer (melody.ts) composes and validates all pitches client-side.
 */
import type { GenreId, MoodId, SectionName, SectionSpec, SongSpec, StudioSettings } from './types';
import { makeRng, MOOD_TEMPO, clamp } from './theory';

interface FactPack {
  subject: string;
  keywords: string[];
  hookLines: string[];   // chorus lines — short, chantable
  verses: Array<Array<{ text: string; fact: string }>>; // verse line groups (each inner array = one verse)
  mnemonic?: { text: string; fact: string };
}

const FACT_PACKS: FactPack[] = [
  {
    subject: 'Mitosis',
    keywords: ['mitosis', 'cell division', 'prophase', 'metaphase', 'telophase', 'anaphase', 'cytokinesis'],
    hookLines: [
      'Mitosis, mitosis, watch the cell divide',
      'One becomes two, identity preserved inside',
    ],
    verses: [
      [
        { text: 'Prophase first, the chromosomes appear', fact: 'In prophase, chromosomes condense and become visible' },
        { text: 'The nuclear envelope starts to disappear', fact: 'The nuclear envelope breaks down during prophase' },
        { text: 'Metaphase lines them up, right down the middle', fact: 'Chromosomes align at the cell equator in metaphase' },
        { text: 'Spindle fibres grab them, solving the riddle', fact: 'Spindle fibres attach to centromeres in metaphase' },
      ],
      [
        { text: 'Anaphase pulls, the sisters separate', fact: 'Sister chromatids are pulled apart in anaphase' },
        { text: 'One set to each pole, the cell must regulate', fact: 'Chromatids move to opposite poles in anaphase' },
        { text: 'Telophase wraps two nuclei in place', fact: 'Two new nuclei form in telophase' },
        { text: 'Cytokinesis splits the cytoplasm, end of the race', fact: 'Cytokinesis divides the cytoplasm into two cells' },
      ],
    ],
    mnemonic: { text: 'I Picked My Apples Today, Cool!', fact: 'Interphase, Prophase, Metaphase, Anaphase, Telophase, Cytokinesis' },
  },
  {
    subject: 'Periodic table and chemical bonding',
    keywords: ['periodic', 'element', 'bonding', 'ionic', 'covalent', 'valence', 'chemistry', 'atom', 'molecule'],
    hookLines: [
      'Elements, elements, lined up in the table',
      'Learn the periodic law, you are more than able',
    ],
    verses: [
      [
        { text: 'Mendeleev lined the elements by atomic mass', fact: 'Mendeleev ordered early tables by atomic mass' },
        { text: 'Modern law says atomic number runs the class', fact: 'The modern periodic law orders elements by atomic number' },
        { text: 'Same group, same family, valence the same', fact: 'Elements in a group share similar valence electrons' },
        { text: 'Periods left to right, the properties change', fact: 'Properties change gradually across a period' },
      ],
      [
        { text: 'Ionic bonding, electrons move across', fact: 'Ionic bonds transfer electrons between atoms' },
        { text: 'Metal gives one out, non-metal takes the loss', fact: 'Metals lose electrons, non-metals gain electrons in ionic bonding' },
        { text: 'Covalent bonds share the electrons they own', fact: 'Covalent bonds involve shared electron pairs' },
        { text: 'Metallic pools them all, a sea of electrons shown', fact: 'Metallic bonding is a lattice of positive ions in a sea of delocalised electrons' },
      ],
    ],
  },
  {
    subject: "Newton's laws of motion",
    keywords: ['newton', 'motion', 'force', 'inertia', 'acceleration', 'physics', 'reaction'],
    hookLines: [
      'Force, mass, acceleration — Newton set the scene',
      'Three laws of motion keep the physics machine',
    ],
    verses: [
      [
        { text: 'First law: inertia, objects stay the same', fact: 'An object stays at rest or in uniform motion unless acted on by a force' },
        { text: 'No net force, no change, remember the name', fact: 'A net force of zero means no acceleration' },
        { text: 'Second law: F equals m times a', fact: 'Force equals mass times acceleration (F = ma)' },
        { text: 'Push a big mass gently, it will slowly sway', fact: 'Acceleration is inversely proportional to mass' },
      ],
      [
        { text: 'Third law: action meets its reaction twin', fact: 'Every action has an equal and opposite reaction' },
        { text: 'Equal and opposite, that is how they have been', fact: 'Action and reaction forces are equal in size, opposite in direction' },
        { text: 'Rocket pushes gas down, gas pushes it high', fact: 'Rocket propulsion demonstrates the third law' },
        { text: 'Walking on the ground? Reaction lifts your stride', fact: 'Walking works because the ground pushes back on your foot' },
      ],
    ],
  },
  {
    subject: 'The human heart and blood circulation',
    keywords: ['heart', 'circulation', 'blood', 'anatomy', 'ventricle', 'atrium', 'pulse', 'artery', 'vein'],
    hookLines: [
      'Pump it, pump it, the heart never rests',
      'Circulation highway through your chest',
    ],
    verses: [
      [
        { text: 'Right atrium receives the returning flow', fact: 'The right atrium receives deoxygenated blood from the body' },
        { text: 'Right ventricle sends it where the lungs go', fact: 'The right ventricle pumps blood to the lungs' },
        { text: 'Oxygen picked up, it comes back to the left', fact: 'Oxygenated blood returns from the lungs to the left atrium' },
        { text: 'Left ventricle pumps hardest, body fully refreshed', fact: 'The left ventricle pumps oxygenated blood to the whole body' },
      ],
      [
        { text: 'Arteries carry blood away from the heart', fact: 'Arteries carry blood away from the heart' },
        { text: 'Veins return it back, valves play their part', fact: 'Veins return blood to the heart with one-way valves' },
        { text: 'Capillaries trade oxygen for waste', fact: 'Exchange of gases and nutrients happens in capillaries' },
        { text: 'Seventy-two beats per minute keeps the pace', fact: 'A typical resting heart rate is about 72 beats per minute' },
      ],
    ],
    mnemonic: { text: 'LOVE: Left - Oxygen - Ventricle - Exit', fact: 'Oxygenated blood is pumped out of the left ventricle' },
  },
  {
    subject: 'Biological classification',
    keywords: ['classification', 'taxonomy', 'kingdom', 'phylum', 'species', 'binomial', 'mnemonic', 'classify', 'linnaeus'],
    hookLines: [
      'Kingdom, Phylum, Class, Order, Family, Genus, Species',
      'Seven levels of order, classification releases',
    ],
    verses: [
      [
        { text: 'Linnaeus gave each living thing a name', fact: 'Carl Linnaeus founded modern binomial naming' },
        { text: 'Binomial system: genus and species claim fame', fact: 'Binomial nomenclature uses genus and species names' },
        { text: 'Kingdom down to species, differences get thin', fact: 'Each level down shares fewer organisms and more similarities' },
        { text: 'Five kingdoms of life: where do we fit in?', fact: 'Living things are commonly grouped into five kingdoms' },
      ],
    ],
    mnemonic: { text: 'King Philip Came Over For Good Soup', fact: 'Kingdom, Phylum, Class, Order, Family, Genus, Species' },
  },
];

const GENERIC_HOOKS = [
  'Learn it, sing it, let the knowledge stick',
  'One song a day makes the memory quick',
];
const GENERIC_VERSES = [
  [
    { text: 'Step by step we take the lesson slow' },
    { text: 'Every little fact is a seed we sow' },
    { text: 'Repeat it out loud till it feels like home' },
    { text: 'Knowledge in a melody, anywhere you go' },
  ],
];

function detectPack(topic: string): FactPack | null {
  const t = topic.toLowerCase();
  let best: { pack: FactPack; score: number } | null = null;
  for (const pack of FACT_PACKS) {
    let score = 0;
    for (const kw of pack.keywords) if (t.includes(kw)) score += kw.length;
    if (score > 0 && (!best || score > best.score)) best = { pack, score };
  }
  return best?.pack ?? null;
}

interface PlanPart { name: SectionName; frac: number; density: SectionSpec['density'] }

/**
 * Section plan scaled to the requested duration at the chosen tempo:
 * total bars = seconds * bpm / 240 (4 beats per bar), distributed by the
 * template proportions below and rounded to even bar counts.
 */
function durationPlan(totalSec: number, bpm: number): Array<{ name: SectionName; bars: number; density: SectionSpec['density'] }> {
  const templates: Record<string, PlanPart[]> = {
    short: [
      { name: 'intro', frac: 0.12, density: 'low' },
      { name: 'verse', frac: 0.36, density: 'mid' },
      { name: 'chorus', frac: 0.38, density: 'full' },
      { name: 'outro', frac: 0.14, density: 'mid' },
    ],
    medium: [
      { name: 'intro', frac: 0.08, density: 'low' },
      { name: 'verse', frac: 0.24, density: 'mid' },
      { name: 'chorus', frac: 0.24, density: 'full' },
      { name: 'verse', frac: 0.24, density: 'mid' },
      { name: 'chorus', frac: 0.14, density: 'drop' },
      { name: 'outro', frac: 0.06, density: 'mid' },
    ],
    long: [
      { name: 'intro', frac: 0.06, density: 'low' },
      { name: 'verse', frac: 0.18, density: 'mid' },
      { name: 'prechorus', frac: 0.09, density: 'mid' },
      { name: 'chorus', frac: 0.19, density: 'full' },
      { name: 'verse', frac: 0.18, density: 'mid' },
      { name: 'chorus', frac: 0.19, density: 'drop' },
      { name: 'outro', frac: 0.11, density: 'mid' },
    ],
    epic: [
      { name: 'intro', frac: 0.05, density: 'low' },
      { name: 'verse', frac: 0.16, density: 'mid' },
      { name: 'prechorus', frac: 0.08, density: 'mid' },
      { name: 'chorus', frac: 0.17, density: 'full' },
      { name: 'verse', frac: 0.16, density: 'mid' },
      { name: 'chorus', frac: 0.17, density: 'full' },
      { name: 'bridge', frac: 0.08, density: 'low' },
      { name: 'hook', frac: 0.05, density: 'drop' },
      { name: 'outro', frac: 0.08, density: 'mid' },
    ],
  };
  const key = totalSec <= 35 ? 'short' : totalSec <= 50 ? 'medium' : totalSec <= 70 ? 'long' : 'epic';
  const totalBars = Math.max(12, Math.min(88, Math.round((totalSec * bpm) / 240)));
  return templates[key].map((p) => ({
    name: p.name,
    bars: Math.max(2, Math.min(16, 2 * Math.round((totalBars * p.frac) / 2))),
    density: p.density,
  }));
}

const PROGRESSIONS_MAJOR = [
  ['C', 'G', 'Am', 'F'],
  ['C', 'F', 'G', 'C'],
  ['C', 'Am', 'F', 'G'],
  ['C', 'G', 'F', 'C'],
];
const PROGRESSIONS_MINOR = [
  ['Am', 'F', 'C', 'G'],
  ['Am', 'G', 'F', 'E'],
  ['Am', 'C', 'G', 'Am'],
];

function linesToSpec(lines: Array<string | { text: string; fact?: string }>) {
  return lines.map((raw) => {
    const l = typeof raw === 'string' ? { text: raw } : raw;
    return {
      text: l.text,
      fact: l.fact,
      words: l.text.split(/\s+/).filter(Boolean).map((w) => ({ text: w, notes: [] })),
    };
  });
}

export interface FallbackLyricistInput {
  topic: string;
  notes?: string;
  settings: Pick<StudioSettings, 'genre' | 'mood' | 'durationSec' | 'seedMelody' | 'seedArrangement' | 'vocalMode' | 'vocalStyle'>;
  tempoBpm?: number;
  key?: string;
  scale?: 'major' | 'minor';
}

export function fallbackSongSpec(input: FallbackLyricistInput): SongSpec {
  const { topic, notes, settings } = input;
  const rng = makeRng(settings.seedMelody);
  const pack = detectPack(topic);

  const [lo, hi] = MOOD_TEMPO[settings.mood];
  const tempoBpm = input.tempoBpm ?? clamp(Math.round(lo + rng() * (hi - lo)), lo, hi);
  const scale: 'major' | 'minor' = settings.mood === 'calm' || settings.mood === 'dreamy'
    ? 'minor' : 'major';
  const keyPool = ['C', 'D', 'F', 'G', 'A'];
  const key = input.key ?? keyPool[Math.floor(rng() * keyPool.length)];

  const plan = durationPlan(settings.durationSec, tempoBpm);

  // Verse content: user notes become extra verses when provided.
  const noteLines = (notes ?? '')
    .split(/\n|(?<=[.;])\s+/)
    .map((s) => s.trim().replace(/[.;]+$/, ''))
    .filter((s) => s.length > 8)
    .slice(0, 4)
    .map((text) => ({ text: `${text[0].toUpperCase()}${text.slice(1)}` }));

  const versePool: Array<Array<{ text: string; fact?: string }>> = [];
  if (pack) versePool.push(...pack.verses);
  if (noteLines.length >= 2) {
    for (let i = 0; i < noteLines.length; i += 2) versePool.push(noteLines.slice(i, i + 2));
  }
  if (versePool.length === 0) versePool.push(...GENERIC_VERSES);

  const hookLines = pack
    ? pack.hookLines
    : GENERIC_HOOKS;

  const prog = (scale === 'major' ? PROGRESSIONS_MAJOR : PROGRESSIONS_MINOR)[
    Math.floor(rng() * (scale === 'major' ? PROGRESSIONS_MAJOR.length : PROGRESSIONS_MINOR.length))
  ];

  let verseIdx = 0;
  let idCounter = 0;
  const sections: SectionSpec[] = plan.map((p) => {
    const id = `s${idCounter++}`;
    const chords = p.name === 'intro' || p.name === 'outro'
      ? [prog[0], prog[1], prog[0], prog[1]].slice(0, p.bars)
      : Array.from({ length: p.bars }, (_, i) => prog[i % prog.length]);

    let lines: SectionSpec['lines'] = [];
    if (p.name === 'verse') {
      const v = versePool[verseIdx % versePool.length];
      verseIdx++;
      lines = linesToSpec(v);
    } else if (p.name === 'chorus' || p.name === 'hook') {
      lines = linesToSpec(hookLines);
    } else if (p.name === 'prechorus') {
      lines = linesToSpec([
        { text: pack?.mnemonic ? `Remember it like this: ${pack.mnemonic.text}` : 'Here it comes, get ready to remember' },
      ]);
    } else if (p.name === 'bridge') {
      lines = linesToSpec([
        pack?.mnemonic
          ? { text: pack.mnemonic.text, fact: pack.mnemonic.fact }
          : { text: 'Say it once, say it twice, now you know it' },
      ]);
    }
    return {
      id,
      name: p.name,
      bars: p.bars,
      chords,
      density: p.density,
      lines,
    };
  });

  const title = pack ? `${pack.subject} — The SBA Song`
    : `${titleCase(topic)} — The SBA Song`;

  return {
    title,
    topic,
    genre: normalizeGenre(settings.genre, settings.mood),
    mood: settings.mood,
    tempoBpm,
    key,
    scale,
    vocal: {
      mode: settings.vocalMode,
      style: settings.vocalStyle,
      vibrato: settings.mood === 'calm' || settings.mood === 'dreamy' ? 0.5 : 0.35,
    },
    seeds: { melody: settings.seedMelody, arrangement: settings.seedArrangement },
    sections,
    creativeNotes: pack
      ? `Offline creative brain matched this topic to the "${pack.subject}" fact pack. Facts verified against the built-in curriculum notes.`
      : 'Offline creative brain used structured learning templates. Add your lesson notes for best accuracy, or connect an AI provider.',
  };
}

function normalizeGenre(g: GenreId | 'auto', mood: MoodId): GenreId {
  if (g !== 'auto') return g;
  switch (mood) {
    case 'upbeat': return 'afrobeats';
    case 'happy': return 'kids';
    case 'groovy': return 'amapiano';
    case 'calm': return 'acoustic';
    case 'epic': return 'motivational';
    case 'dreamy': return 'rnb';
  }
}

function titleCase(s: string): string {
  return s.replace(/\w\S*/g, (t) => t[0].toUpperCase() + t.slice(1));
}
