/**
 * Arranger — turns a finalized SongSpec into:
 *  1. A Timeline: exact beat/second positions of every section, line, word
 *     and syllable (consumed by BOTH the audio mix and the typography engine,
 *     which is how perfect audio-visual sync is achieved).
 *  2. An arrangement of InstrumentEvents (drums, bass, chords, leads, fills)
 *     for the instrument synthesizer.
 */
import type {
  Density, InstrumentEvent, SongSpec, SectionTiming, Timeline, WordTiming, LineTiming,
} from './types';
import { getGenre, parsePattern, type BassStyle, type ChordStyle, type LeadStyle } from './genres';
import { chordPitchClasses, makeRng } from './theory';

export function buildTimeline(spec: SongSpec): Timeline {
  const secPerBeat = 60 / spec.tempoBpm;
  let beat = 0;
  const sections: SectionTiming[] = [];

  for (const s of spec.sections) {
    const startBeat = beat;
    const totalBeats = s.bars * 4;
    const lines: LineTiming[] = [];
    const singableLines = s.lines;
    const slot = singableLines.length ? totalBeats / singableLines.length : totalBeats;

    singableLines.forEach((line, li) => {
      const lineStartBeat = startBeat + li * slot;
      let cursor = lineStartBeat;
      const words: WordTiming[] = [];
      for (const w of line.words) {
        const beats = w.notes.reduce((a, n) => a + (n.beats || 0), 0);
        const wTiming: WordTiming = {
          text: w.text,
          factWord: Boolean(line.fact && w.text.length > 2 && line.fact.length > 0),
          startBeat: cursor,
          endBeat: cursor + beats,
          startSec: cursor * secPerBeat,
          endSec: (cursor + beats) * secPerBeat,
          syllables: [],
        };
        let sylCursor = cursor;
        // Split the word's beat window evenly across syllables.
        const sylTexts = w.syllables?.length ? w.syllables : [w.text];
        const per = beats / Math.max(1, sylTexts.length);
        sylTexts.forEach((syl, si) => {
          const n = w.notes[Math.min(si, (w.notes.length || 1) - 1)];
          wTiming.syllables.push({
            text: syl,
            midi: n?.midi ?? 64,
            startSec: sylCursor * secPerBeat,
            endSec: (sylCursor + per) * secPerBeat,
            vowel: '',
            onset: '',
            coda: '',
          });
          sylCursor += per;
        });
        words.push(wTiming);
        cursor += beats;
      }
      lines.push({
        text: line.text,
        fact: line.fact,
        sectionId: s.id,
        startBeat: lineStartBeat,
        endBeat: lineStartBeat + slot,
        startSec: lineStartBeat * secPerBeat,
        endSec: (lineStartBeat + slot) * secPerBeat,
        words,
      });
    });

    sections.push({
      id: s.id,
      name: s.name,
      label: s.label,
      startBeat,
      endBeat: startBeat + totalBeats,
      startSec: startBeat * secPerBeat,
      endSec: (startBeat + totalBeats) * secPerBeat,
      chords: s.chords,
      density: s.density,
      lines,
    });
    beat += totalBeats;
  }

  const totalBeats = beat;
  const durationSec = totalBeats * secPerBeat;
  const beatTimes: number[] = [];
  for (let b = 0; b < totalBeats; b++) beatTimes.push(b * secPerBeat);

  return {
    spec,
    bpm: spec.tempoBpm,
    secPerBeat,
    totalBeats,
    durationSec,
    sections,
    beatTimes,
  };
}

/* ------------------------------------------------------------------ */
/* Instrument arrangement                                               */
/* ------------------------------------------------------------------ */

function densityAllowed(density: Density): { drums: boolean; bass: boolean; chords: boolean; lead: boolean } {
  switch (density) {
    case 'silence': return { drums: false, bass: false, chords: false, lead: false };
    case 'low': return { drums: false, bass: false, chords: true, lead: false };
    case 'mid': return { drums: true, bass: true, chords: true, lead: false };
    case 'full': return { drums: true, bass: true, chords: true, lead: true };
    case 'drop': return { drums: true, bass: true, chords: true, lead: true };
  }
}

const OCTROOT = 36; // low range for bass instruments

export function buildArrangement(spec: SongSpec, timeline: Timeline, intensity: number): InstrumentEvent[] {
  const genre = getGenre(spec.genre);
  const spb = timeline.secPerBeat;
  const sixteenth = spb / 4;
  const events: InstrumentEvent[] = [];
  const swing = genre.swing * sixteenth;
  // Arrangement seed drives variations (arp direction, fills, octaves) so
  // "regenerate instrumental" produces a genuinely different groove.
  const rng = makeRng(spec.seeds.arrangement);
  const arpDirection = rng() < 0.5 ? 1 : -1;
  const arpMode = Math.floor(rng() * 3);
  const leadOctave = rng() < 0.35 ? 12 : 0;

  timeline.sections.forEach((st, sIdx) => {
    const allowed = densityAllowed(st.density);
    const bars = st.chords.length;
    const isLast = sIdx === timeline.sections.length - 1;

    // Intro build-up: hold drums until the first mid+ section after a low intro.
    const drumsOn = allowed.drums && !(genre.introBuild && sIdx === 0);

    for (let bar = 0; bar < bars; bar++) {
      const barStartBeat = st.startBeat + bar * 4;
      const barStartSec = barStartBeat * spb;
      const chordSym = st.chords[bar % st.chords.length];
      const pcs = chordPitchClasses(chordSym, spec.scale);

      /* ---- Drums ---- */
      if (drumsOn) {
        const D = genre.drums;
        const drumSets: Array<[string, string | undefined]> = [
          ['kick', D.kick], ['snare', D.snare], ['clap', D.clap], ['rim', D.rim],
          ['hat', D.hat], ['hatOpen', D.hatOpen], ['shaker', D.shaker],
          ['tom', D.tom], ['tamb', D.tamb],
        ];
        for (const [inst, pattern] of drumSets) {
          for (const [step, vel] of parsePattern(pattern)) {
            const t = barStartSec + step * sixteenth + (step % 2 === 1 ? swing : 0);
            events.push({ inst, tSec: t, durSec: sixteenth, vel: vel * (0.55 + 0.45 * intensity) });
          }
        }
      }

      /* ---- Bass ---- */
      if (allowed.bass) {
        const root = pcs[0];
        const rootLow = OCTROOT + (((root - OCTROOT) % 12) + 12) % 12;
        const bassEvents = bassPattern(genre.bassStyle);
        for (const [step, dur, vel] of bassEvents) {
          const midi = bassMidi(genre.bassStyle, rootLow, step);
          events.push({
            inst: genre.bassStyle === 'logdrum' ? 'logdrum' : 'bass',
            tSec: barStartSec + step * sixteenth + (step % 2 === 1 ? swing : 0),
            durSec: dur * sixteenth,
            midi,
            vel: vel * (0.5 + 0.5 * intensity),
          });
        }
      }

      /* ---- Chords ---- */
      if (allowed.chords) {
        const voiced = pcs.map((pc) => 60 + (((pc - 60) % 12) + 12) % 12).sort((a, b) => a - b);
        const chordEvents = chordPattern(genre.chordStyle);
        for (const [step, dur, vel] of chordEvents) {
          for (let vi = 0; vi < voiced.length; vi++) {
            events.push({
              inst: chordInstrument(genre.chordStyle),
              tSec: barStartSec + step * sixteenth + (step % 2 === 1 ? swing : 0),
              durSec: dur * sixteenth,
              midi: voiced[vi],
              vel: vel * (0.35 + 0.5 * intensity) * (vi === 0 ? 1 : 0.8),
            });
          }
        }
      }

      /* ---- Lead / arpeggio (chorus, hook, drop) ---- */
      if (allowed.lead && (st.density === 'full' || st.density === 'drop')) {
        const voiced = pcs.map((pc) => 72 + leadOctave + (((pc - 72) % 12) + 12) % 12).sort((a, b) => a - b);
        const idxOrder = arpMode === 0 ? [0, 1, 2, 1, 0, 1, 2, 3]
          : arpMode === 1 ? [2, 1, 0, 1, 3, 2, 1, 0]
          : [0, 2, 1, 3, 2, 0, 1, 2];
        if (arpDirection === -1) idxOrder.reverse();
        const order = idxOrder.map((i) => voiced[i % voiced.length]);
        for (let step = 0; step < 8; step++) {
          events.push({
            inst: leadInstrument(genre.leadStyle),
            tSec: barStartSec + step * 2 * sixteenth,
            durSec: 1.6 * sixteenth,
            midi: order[step],
            vel: 0.42 * (0.5 + 0.5 * intensity),
          });
        }
      }

      /* ---- Percussion / signature hits ---- */
      if (genre.id === 'jingle' && allowed.drums) {
        // bright bell accents on the downbeat of every other bar
        if (bar % 2 === 0) {
          events.push({ inst: 'bell', tSec: barStartSec, durSec: spb * 2, midi: 84, vel: 0.5 });
        }
      }
      if (genre.id === 'amapiano' && allowed.drums && bar % 2 === 1) {
        events.push({ inst: 'shaker', tSec: barStartSec + 8 * sixteenth, durSec: sixteenth, vel: 0.5 });
      }
    }

    /* ---- Fill / riser into the next section ---- */
    if (genre.fillAtSectionEnd && allowed.drums && !isLast && rng() < 0.85) {
      const fillSteps = [8, 10, 12, 14, 15];
      fillSteps.forEach((step, i) => {
        events.push({
          inst: i % 2 === 0 ? 'tom' : 'snare',
          tSec: (st.endBeat - (16 - step) / 4) * spb,
          durSec: sixteenth,
          vel: 0.5 + i * 0.1,
        });
      });
    }
    if (sIdx > 0 && (st.density === 'full' || st.density === 'drop')) {
      events.push({ inst: 'impact', tSec: st.startSec, durSec: 1.2, vel: 0.9 });
    }
    if (st.density === 'drop' && st.lines.length > 0) {
      events.push({ inst: 'riser', tSec: Math.max(0, st.startSec - 1.2), durSec: 1.2, vel: 0.6 });
    }
  });

  return events.sort((a, b) => a.tSec - b.tSec);
}

type StepTriple = [number, number, number]; // [step(16ths), duration(16ths), velocity]

function bassPattern(style: BassStyle): StepTriple[] {
  switch (style) {
    case 'sub8': return [[0, 3.5, 1], [8, 3.5, 0.9]];
    case 'offbeat': return [[2, 2, 0.9], [6, 2, 0.8], [10, 2, 0.9], [14, 2, 0.8]];
    case 'walking': return [[0, 1.5, 1], [4, 1.5, 0.8], [8, 1.5, 1], [12, 1.5, 0.85]];
    case 'logdrum': return [[0, 1.4, 1], [2, 1.4, 0.85], [6, 1.4, 1], [8, 1.4, 0.85], [11, 1.4, 0.9], [14, 1.4, 0.8]];
    case 'boombap': return [[0, 2.5, 1], [6, 1.5, 0.85], [10, 2, 0.9]];
    case 'reggae': return [[0, 1.2, 1], [7, 1.2, 0.9], [10, 1.2, 0.8]];
    case 'drive': return [[0, 1, 1], [2, 1, 0.8], [4, 1, 0.9], [6, 1, 0.8], [8, 1, 1], [10, 1, 0.8], [12, 1, 0.9], [14, 1, 0.8]];
    case 'soft': return [[0, 6, 0.9], [8, 6, 0.75]];
  }
}

function bassMidi(style: BassStyle, rootLow: number, step: number): number {
  switch (style) {
    case 'walking': return step % 8 === 4 ? rootLow + 7 : rootLow;
    case 'reggae': return step === 7 ? rootLow + 5 : rootLow;
    case 'logdrum': return step >= 11 ? rootLow + 3 : rootLow;
    default: return rootLow;
  }
}

function chordPattern(style: ChordStyle): StepTriple[] {
  switch (style) {
    case 'pad': return [[0, 15.5, 0.9]];
    case 'stab': return [[2, 1.5, 0.9], [6, 1.5, 0.7], [10, 1.5, 0.9], [14, 1.5, 0.7]];
    case 'pluck8': return [[0, 1.8, 0.9], [4, 1.8, 0.7], [8, 1.8, 0.9], [12, 1.8, 0.7]];
    case 'skank': return [[2, 1.2, 1], [6, 1.2, 0.8], [10, 1.2, 1], [14, 1.2, 0.8]];
    case 'swell': return [[0, 15.5, 0.8]];
    case 'strum': return [[0, 3.2, 0.9], [4, 3.2, 0.7], [8, 3.2, 0.85], [12, 3.2, 0.65]];
  }
}

function chordInstrument(style: ChordStyle): string {
  switch (style) {
    case 'pad': return 'pad';
    case 'stab': return 'stab';
    case 'pluck8': return 'pluck';
    case 'skank': return 'organ';
    case 'swell': return 'pad';
    case 'strum': return 'pluck';
  }
}

function leadInstrument(style: LeadStyle): string {
  switch (style) {
    case 'arp': return 'lead';
    case 'counter': return 'lead';
    case 'bell': return 'bell';
    default: return 'pluck';
  }
}
