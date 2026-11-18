/**
 * Visemes — mouth shapes driven by the syllable being spoken.
 *
 * A "viseme" is the visible shape of the mouth during speech. We use a small,
 * readable set that covers 80% of English mouth positions:
 *
 *   M   lips together       (m, b, p)
 *   FV  teeth on lip        (f, v)
 *   TH  tongue visible      (th)
 *   S   narrow hiss         (s, z, sh, ch)
 *   A   wide open           (a, ah)
 *   E   wide flat           (e, eh)
 *   I   narrow              (i, ee)
 *   O   rounded open        (o, oh)
 *   U   pursed small        (u, oo, w)
 *   closed  mouth resting   (silence, consonant-only)
 *
 * Each syllable maps to one viseme based on its vowel (or leading consonant
 * cluster if the syllable has no vowel). The renderer interpolates the mouth
 * path between consecutive visemes so speech looks smooth, not stuttered.
 */
import { CaptionWord } from '../rig/character';

export type Viseme = 'closed' | 'M' | 'FV' | 'TH' | 'S' | 'A' | 'E' | 'I' | 'O' | 'U';

/** Map a syllable to its dominant viseme. Order matters: consonant clusters
 *  first (they often collapse the vowel), then vowels, then fallback. */
export function syllableToViseme(syllable: string): Viseme {
  const s = (syllable || '').toLowerCase().replace(/[^a-z]/g, '');
  if (!s) return 'closed';

  // Silent / lip-closed consonants at start
  if (/^(m|b|p)/.test(s)) return 'M';
  if (/^(f|v)/.test(s)) return 'FV';
  if (/^th/.test(s)) return 'TH';
  if (/^(s|z|sh|ch|j)/.test(s)) return 'S';

  // Vowel-dominant: look for the first vowel and map it
  const firstVowel = s.match(/[aeiouy]/);
  if (!firstVowel) return 'closed';
  const v = firstVowel[0];
  if (v === 'a') return 'A';
  if (v === 'e') return 'E';
  if (v === 'i' || v === 'y') return 'I';
  if (v === 'o') return 'O';
  if (v === 'u') return 'U';

  return 'closed';
}

/**
 * Find the active viseme at a given frame, given the caption's word list.
 *
 * Behavior:
 *   - Inside a word's [start, end]: use the word's viseme (blended at edges)
 *   - Between words (start_n < frame < end_{n+1}): closed or transitioning
 *   - Before first or after last word: closed
 */
export function visemeAtFrame(words: CaptionWord[], frame: number): Viseme {
  if (!words || words.length === 0) return 'closed';

  // Find the word containing the frame
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (frame >= w.start && frame <= w.end) {
      return syllableToViseme(w.w);
    }
  }

  // Between words: silent-mouth. If we're within 2 frames of the next word
  // starting, return 'closed' anyway (the renderer will blend).
  return 'closed';
}

/**
 * Interpolate the mouth size between two visemes. Used by the renderer to
 * smooth transitions so the mouth doesn't snap from 'A' to 'closed' in one
 * frame. Returns a numeric 0..1 "openness" value plus the shape hint.
 */
export interface MouthState {
  shape: Viseme;
  /** 0 = fully closed, 1 = fully open. */
  open: number;
  /** 0 = flat (I, E), 1 = rounded (O, U). Used to lerp width. */
  round: number;
}

const VISEME_OPEN: Record<Viseme, number> = {
  closed: 0.02, M: 0.03, FV: 0.15, TH: 0.35, S: 0.20,
  A: 0.95, E: 0.45, I: 0.25, O: 0.75, U: 0.55,
};
const VISEME_ROUND: Record<Viseme, number> = {
  closed: 0.5, M: 0.5, FV: 0.4, TH: 0.5, S: 0.6,
  A: 0.3, E: 0.2, I: 0.15, O: 0.9, U: 0.95,
};

export function visemeToMouthState(v: Viseme): MouthState {
  return { shape: v, open: VISEME_OPEN[v], round: VISEME_ROUND[v] };
}
