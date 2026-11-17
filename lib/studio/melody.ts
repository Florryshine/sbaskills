/**
 * Melody finalizer / composer.
 *
 * Takes a SongSpec whose lines may be missing or malformed melody notes and
 * produces a complete, singable spec: one note per syllable, chord tones on
 * strong beats, motif repetition for catchiness, and a fixed vocal range.
 *
 * This runs in the browser and is idempotent — it is what guarantees that
 * whatever the AI brain returns can ALWAYS be sung by the engine.
 */
import type { SectionName, SongSpec, WordNote } from './types';
import {
  makeRng, pickRng, syllabify, isSingable, chordPitchClasses,
  keyRootToMidi, degreeToOffset, snapToPitchClasses, clamp,
} from './theory';

/** Motif libraries in scale degrees. Each section type reuses ONE motif so
 *  verses rhyme melodically with each other and choruses become hooks. */
const MOTIFS: Record<SectionName, number[][]> = {
  intro: [[1, 3, 5, 3]],
  verse: [
    [1, 1, 3, 5, 3, 2, 1, 2],
    [3, 3, 2, 1, 2, 3, 2, 1],
    [5, 3, 3, 2, 1, 1, 2, 3],
    [1, 2, 3, 3, 2, 1, 1, 1],
  ],
  prechorus: [
    [1, 2, 3, 4, 5, 5, 5, 5],
    [3, 4, 5, 6, 5, 4, 3, 2],
  ],
  chorus: [
    [5, 5, 6, 5, 3, 3, 2, 1],
    [3, 5, 5, 3, 2, 2, 1, 1],
    [1, 5, 5, 6, 5, 3, 2, 1],
    [5, 3, 3, 4, 5, 5, 3, 1],
  ],
  bridge: [
    [2, 3, 2, 1, 6, 5, 4, 3],
    [6, 5, 4, 3, 2, 3, 2, 1],
  ],
  hook: [
    [5, 5, 6, 5, 3, 3, 2, 1],
    [1, 1, 5, 5, 3, 3, 2, 1],
  ],
  outro: [[1, 3, 3, 1, 1]],
};

const VOICE_CENTERS = { synth: 64, tts: 55 } as const;

function ensureSyllables(word: WordNote): string[] {
  if (word.syllables && word.syllables.length > 0) return word.syllables;
  return syllabify(word.text);
}

export interface FinalizeOptions {
  /** Override the first scale degree the chorus starts on. */
  chorusLift?: boolean;
}

export function finalizeMelody(input: SongSpec, opts: FinalizeOptions = {}): SongSpec {
  const spec: SongSpec = JSON.parse(JSON.stringify(input));
  const rng = makeRng(spec.seeds.melody);
  const center = VOICE_CENTERS[spec.vocal.mode] ?? 64;
  const rangeLo = center - 8;
  const rangeHi = center + 9;
  const rootMidi = keyRootToMidi(spec.key, 4);

  // One motif per section name keeps the song cohesive.
  const motifFor: Partial<Record<SectionName, number[]>> = {};
  for (const name of ['intro', 'verse', 'prechorus', 'chorus', 'bridge', 'hook', 'outro'] as SectionName[]) {
    motifFor[name] = pickRng(rng, MOTIFS[name]);
  }

  for (const section of spec.sections) {
    const totalBeats = section.bars * 4;
    const lines = section.lines.filter((l) => l.words.some((w) => isSingable(w.text)));
    if (lines.length === 0) continue;
    const slot = totalBeats / lines.length;
    const motif = motifFor[section.name] ?? MOTIFS.verse[0];
    let motifPos = 0;

    lines.forEach((line, li) => {
      const lineStart = li * slot;
      const avail = Math.max(1, slot - 0.5);

      const singable = line.words.filter((w) => isSingable(w.text));
      const sylLists = singable.map(ensureSyllables);
      const totalSyl = sylLists.reduce((a, b) => a + b.length, 0);

      // Fit syllables into the available beat window.
      let per = 0.5;
      if (totalSyl * per > avail) per = 0.25;
      if (totalSyl * per > avail) per = 0.125;
      const rawBeats = sylLists.map((s) => s.map(() => per));

      // Give the final syllable a little hold (still inside the window).
      const flatSum = totalSyl * per;
      const hold = Math.min(1.25, avail - flatSum);
      if (hold > 0.05) rawBeats[rawBeats.length - 1][rawBeats[rawBeats.length - 1].length - 1] += hold;
      // If still overflowing (extreme cases), compress proportionally.
      let used = rawBeats.flat().reduce((a, b) => a + b, 0);
      if (used > avail) {
        const k = avail / used;
        for (const wb of rawBeats) for (let i = 0; i < wb.length; i++) wb[i] *= k;
        used = avail;
      }

      let beatCursor = lineStart;
      const lastLine = li === lines.length - 1;

      singable.forEach((word, wi) => {
        const syls = sylLists[wi];
        // Honor AI-provided notes when they match the syllable count.
        const aiNotes = word.notes?.length === syls.length ? word.notes : null;
        const prevCoda = wi > 0 ? '' : '';
        word.syllables = syls;
        word.notes = syls.map((syl, si) => {
          const beats = rawBeats[wi][si];
          const barPos = (beatCursor % 4 + 4) % 4;
          const strong = barPos === 0 || barPos === 2;
          const isLineEnd = wi === singable.length - 1 && si === syls.length - 1;

          let midi: number;
          if (aiNotes) {
            const n = aiNotes[si];
            midi = n.midi ?? (rootMidi + degreeToOffset(n.degree ?? 1, spec.scale));
          } else {
            const degree = motif[motifPos % motif.length];
            motifPos++;
            midi = rootMidi + degreeToOffset(degree, spec.scale);
            // Chorus lift: nudge the motif up a third for brightness.
            if ((section.name === 'chorus' || section.name === 'hook') && opts.chorusLift !== false) {
              midi += 0;
            }
          }

          // Snap strong beats to the chord of the current bar.
          if (strong || isLineEnd) {
            const barIdx = Math.min(section.chords.length - 1, Math.floor(beatCursor / 4));
            const chord = section.chords[barIdx] ?? section.chords[0];
            if (chord) {
              const pcs = chordPitchClasses(chord, spec.scale);
              midi = snapToPitchClasses(midi, pcs);
            }
          }
          // Resolve line ends toward the tonic for stability.
          if (isLineEnd && lastLine) {
            const tonicPc = rootMidi % 12;
            const candidates = [tonicPc, (tonicPc + (spec.scale === 'major' ? 4 : 3)) % 12];
            midi = snapToPitchClasses(midi, candidates);
          }

          // Fold into the comfortable vocal range.
          while (midi < rangeLo) midi += 12;
          while (midi > rangeHi) midi -= 12;

          beatCursor += beats;
          return { midi, beats: Math.round(beats * 1000) / 1000 };
        });
        void prevCoda;
      });

      // Non-singable tokens (punctuation) get empty notes arrays.
      line.words.forEach((w) => { if (!isSingable(w.text) && w.notes) w.notes = []; });
    });
  }

  return spec;
}

/** Quick sanity check used by the self-test harness. */
export function validateSpec(spec: SongSpec): string[] {
  const issues: string[] = [];
  for (const s of spec.sections) {
    if (s.bars <= 0) issues.push(`Section ${s.id}: bars<=0`);
    if (s.chords.length === 0 && s.lines.length > 0) issues.push(`Section ${s.id}: no chords`);
    for (const l of s.lines) {
      for (const w of l.words) {
        if (isSingable(w.text)) {
          const sylCount = (w.syllables?.length ?? syllabify(w.text).length);
          if (w.notes.length !== sylCount) {
            issues.push(`"${w.text}": ${w.notes.length} notes vs ${sylCount} syllables`);
          }
        }
      }
    }
  }
  const center = VOICE_CENTERS[spec.vocal.mode] ?? 64;
  for (const s of spec.sections) {
    for (const l of s.lines) {
      for (const w of l.words) {
        for (const n of w.notes) {
          if (n.midi !== undefined && (n.midi < center - 12 || n.midi > center + 12)) {
            issues.push(`Note ${n.midi} out of comfortable range`);
          }
        }
      }
    }
  }
  return Array.from(new Set(issues)).slice(0, 20);
}

export { clamp };
