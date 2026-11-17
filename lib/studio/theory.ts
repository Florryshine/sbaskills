/**
 * Music theory helpers, deterministic PRNG and linguistics utilities
 * shared by every engine stage.
 */
import type { MoodId } from './types';

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;
const FLAT_MAP: Record<string, string> = { Db: 'C#', Eb: 'D#', Gb: 'F#', Ab: 'G#', Bb: 'A#' };

export function noteToMidiClass(name: string): number {
  const n = FLAT_MAP[name] ?? name;
  const idx = NOTE_NAMES.indexOf(n as (typeof NOTE_NAMES)[number]);
  return idx >= 0 ? idx : 0;
}

export function keyRootToMidi(key: string, octave = 4): number {
  return (octave + 1) * 12 + noteToMidiClass(key);
}

export const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];
export const MINOR_SCALE = [0, 2, 3, 5, 7, 8, 10];

export function scaleOf(scale: 'major' | 'minor'): number[] {
  return scale === 'major' ? MAJOR_SCALE : MINOR_SCALE;
}

/** midi -> frequency in Hz */
export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function midiToName(midi: number): string {
  return `${NOTE_NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
}

/** Parse a chord symbol like "C", "Am", "G7", "Fmaj7", "Bb", "C#" -> midi pitch classes. */
export function chordPitchClasses(symbol: string, scale: 'major' | 'minor'): number[] {
  const s = symbol.trim();
  const rootMatch = s.match(/^([A-G][#b]?)/);
  if (!rootMatch) return [noteToMidiClass(scaleRoot(scale))];
  const root = noteToMidiClass(rootMatch[1]);
  const quality = s.slice(rootMatch[1].length).toLowerCase();
  if (quality.startsWith('maj7')) return [root, root + 4, root + 7, root + 11];
  if (quality.startsWith('m7')) return [root, root + 3, root + 7, root + 10];
  if (quality.startsWith('m') || quality.startsWith('min')) return [root, root + 3, root + 7];
  if (quality.startsWith('dim')) return [root, root + 3, root + 6];
  if (quality.startsWith('sus')) return [root, root + 5, root + 7];
  if (quality.startsWith('7')) return [root, root + 4, root + 7, root + 10];
  if (quality.startsWith('6')) return [root, root + 4, root + 7, root + 9];
  return [root, root + 4, root + 7]; // default major triad
}

function scaleRoot(scale: 'major' | 'minor'): string {
  return scale === 'major' ? 'C' : 'A';
}

/** The root midi (pitch class) of a chord symbol. */
export function chordRootClass(symbol: string, scale: 'major' | 'minor'): number {
  const pcs = chordPitchClasses(symbol, scale);
  return pcs[0];
}

/** Convert a scale degree (1..7, allow 'b'/'+' accidentals) to a midi offset from key root. */
export function degreeToOffset(degree: string | number, scale: 'major' | 'minor'): number {
  const str = String(degree);
  let semis = 0;
  const acc = str.match(/^([+#-]?)/)![1];
  const num = parseInt(str.replace(/[^1-7]/g, ''), 10);
  const idx = Math.max(0, Math.min(6, (isNaN(num) ? 1 : num) - 1));
  semis = scaleOf(scale)[idx];
  if (acc === '+' || acc === '#') semis += 1;
  if (acc === '-' || acc === 'b') semis -= 1;
  return semis;
}

/** Snap a midi note to the nearest instance of the given pitch classes. */
export function snapToPitchClasses(midi: number, pitchClasses: number[]): number {
  let best = midi;
  let bestDist = Infinity;
  for (const pc of pitchClasses) {
    const pcMod = ((pc % 12) + 12) % 12;
    for (let oct = -2; oct <= 2; oct++) {
      const cand = pcMod + 12 * (Math.floor(midi / 12) + oct);
      const d = Math.abs(cand - midi);
      if (d < bestDist) { bestDist = d; best = cand; }
    }
  }
  return best;
}

/* ------------------------------------------------------------------ */
/* Deterministic PRNG (mulberry32) — seeds make regeneration reproducible */
/* ------------------------------------------------------------------ */

export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pickRng<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length) % arr.length];
}

/* ------------------------------------------------------------------ */
/* Syllabification (heuristic, English-oriented)                        */
/* ------------------------------------------------------------------ */

const VOWELS = 'aeiouy';

/**
 * Split a word into syllables using vowel-group heuristics.
 * Deliberately simple but stable — the singing engine uses the same
 * split for typography sync, so consistency matters more than perfection.
 */
export function syllabify(word: string): string[] {
  const w = word.toLowerCase().replace(/[^a-z']/g, '');
  if (w.length <= 3) return [word];
  const chunks: string[] = [];
  let i = 0;
  let cur = '';
  while (i < w.length) {
    const ch = w[i];
    if (VOWELS.includes(ch)) {
      cur += ch;
      // consume following vowel group
      while (i + 1 < w.length && VOWELS.includes(w[i + 1])) {
        cur += w[i + 1]; i++;
      }
      // silent trailing 'e' stays with the syllable
      chunks.push(cur); cur = '';
    } else {
      cur += ch;
    }
    i++;
  }
  if (cur) {
    if (chunks.length > 0 && !VOWELS.includes(cur[0])) {
      chunks[chunks.length - 1] += cur;
    } else {
      chunks.push(cur);
    }
  }
  return chunks.length ? chunks : [word];
}

/** Split a lyric line into word tokens (keeps apostrophes and hyphens). */
export function tokenizeLine(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean);
}

/** Is this token singable (not pure punctuation)? */
export function isSingable(token: string): boolean {
  return /[a-zA-Z0-9]/.test(token);
}

/* ------------------------------------------------------------------ */
/* Vowel / consonant classification for the singing synthesizer         */
/* ------------------------------------------------------------------ */

/** Map the nucleus of a syllable to one of the synth's vowel slots. */
export function vowelOf(syllable: string): string {
  const s = syllable.toLowerCase();
  if (/ea|ee|i[ne]|y$/.test(s)) return 'ee';
  if (/oo|ou|u[e]?[^aeiouy]/.test(s)) return 'oo';
  if (/a[ly]$|ay|ai/.test(s)) return 'ay';
  if (/ow|o$/.test(s)) return 'oh';
  if (/ar|ah/.test(s)) return 'ah';
  if (/er|ir|ur|or$/.test(s)) return 'er';
  const firstVowel = s.match(/[aeiouy]/)?.[0];
  switch (firstVowel) {
    case 'a': return 'ah';
    case 'e': return 'eh';
    case 'i': return 'ih';
    case 'o': return 'oh';
    case 'u': return 'oo';
    case 'y': return 'ee';
    default: return 'ah';
  }
}

export function onsetCoda(syllable: string, prevCoda: string): { onset: string; coda: string } {
  const s = syllable.toLowerCase().replace(/[^a-z]/g, '');
  const m = s.match(/^([^aeiouy]*)([aeiouy]+[^aeiouy]*|[aeiouy]+)/);
  if (!m) return { onset: prevCoda || '', coda: '' };
  const onset = m[1] || (prevCoda || '');
  const rest = s.slice(m[1].length + m[2].length);
  return { onset, coda: rest };
}

/* ------------------------------------------------------------------ */
/* Mood helpers                                                         */
/* ------------------------------------------------------------------ */

export const MOOD_TEMPO: Record<MoodId, [number, number]> = {
  upbeat: [100, 124],
  happy: [104, 128],
  groovy: [92, 110],
  calm: [70, 90],
  epic: [88, 108],
  dreamy: [72, 92],
};

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
