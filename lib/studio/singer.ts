/**
 * SBA Formant Singing Synthesizer.
 *
 * This is a genuine singing synthesis engine built on the Web Audio API:
 * every syllable of every word is assigned a melody note and rendered with
 *   - a glottal source (sawtooth + pitch glide + vibrato LFO),
 *   - a formant filter bank (F1/F2/F3 per vowel) that shapes intelligibility,
 *   - consonant onsets/codas (plosive bursts, fricative noise, nasal hums),
 *   - an ADSR envelope per note.
 *
 * Pitch, rhythm and timing come from the same timeline that drives the
 * typography, so the sung vocals are perfectly synchronized with the
 * instrumental and the visuals.
 */
import type { Timeline, VocalStyle } from './types';
import { midiToFreq, vowelOf } from './theory';

const VOWEL_FORMANTS: Record<string, [number, number, number]> = {
  ah: [730, 1090, 2440],
  eh: [530, 1840, 2480],
  ih: [400, 1990, 2550],
  oh: [570, 840, 2410],
  oo: [300, 870, 2240],
  ee: [280, 2250, 2890],
  ay: [660, 1720, 2410],
  er: [490, 1350, 1690],
};

interface StyleConfig {
  vibratoHz: number;
  vibratoCents: number;
  sourceGain: number;
  formantQ: number;
  octaveLayer: number;
  detuneCents: number;
}

const STYLES: Record<VocalStyle, StyleConfig> = {
  bright: { vibratoHz: 5.6, vibratoCents: 24, sourceGain: 0.5, formantQ: 9, octaveLayer: 0, detuneCents: 0 },
  warm: { vibratoHz: 5.0, vibratoCents: 18, sourceGain: 0.55, formantQ: 6, octaveLayer: 0, detuneCents: 4 },
  choir: { vibratoHz: 4.8, vibratoCents: 14, sourceGain: 0.42, formantQ: 5, octaveLayer: 0.5, detuneCents: 9 },
};

function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * 1.5);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let seed = 42;
  for (let i = 0; i < len; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    d[i] = (seed / 0x3fffffff) - 1;
  }
  return buf;
}

type ConsonantKind = 'plosive' | 'fricativeHi' | 'fricativeLo' | 'nasal' | 'liquid' | 'none';

function consonantKind(c: string): ConsonantKind {
  if (!c) return 'none';
  const ch = c[0].toLowerCase();
  if ('ptkbdg'.includes(ch)) return 'plosive';
  if ('sz'.includes(ch)) return 'fricativeHi';
  if ('fvh'.includes(ch) || ch === 'c' || ch === 'j' || ch === 'x') return 'fricativeLo';
  if ('mn'.includes(ch)) return 'nasal';
  if ('lryw'.includes(ch)) return 'liquid';
  return 'none';
}

/** Sing the whole timeline into `dest`. */
export function singTimeline(ctx: BaseAudioContext, dest: AudioNode, timeline: Timeline, opts?: { vibratoScale?: number }) {
  const style = STYLES[timeline.spec.vocal.style] ?? STYLES.bright;
  const vibScale = opts?.vibratoScale ?? timeline.spec.vocal.vibrato;
  const nbuf = noiseBuffer(ctx);
  const center = timeline.spec.vocal.mode === 'tts' ? 55 : 64;

  for (const section of timeline.sections) {
    for (const line of section.lines) {
      for (const word of line.words) {
        for (const syl of word.syllables) {
          const dur = Math.max(0.08, syl.endSec - syl.startSec);
          // Voice onset sits slightly after the syllable start; consonants live there.
          const onsetKind = consonantKind(syl.onset || syl.text[0] || '');
          const onsetDur = onsetKind === 'plosive' ? 0.035
            : onsetKind === 'fricativeHi' ? 0.06
            : onsetKind === 'fricativeLo' ? 0.05
            : onsetKind === 'nasal' ? 0.045
            : 0.012;
          const t0 = syl.startSec;
          const voiceStart = t0 + onsetDur;
          const voiceDur = Math.max(0.07, syl.endSec - voiceStart - 0.012);
          const freq = midiToFreq(syl.midi);

          /* ---- consonant onset ---- */
          if (onsetKind !== 'none') {
            if (onsetKind === 'nasal') {
              const osc = ctx.createOscillator();
              osc.type = 'sawtooth';
              osc.frequency.value = freq * 0.94;
              const lp = ctx.createBiquadFilter();
              lp.type = 'lowpass'; lp.frequency.value = 700; lp.Q.value = 2;
              const g = ctx.createGain();
              g.gain.setValueAtTime(0.0001, t0);
              g.gain.exponentialRampToValueAtTime(0.16, t0 + 0.015);
              g.gain.exponentialRampToValueAtTime(0.0001, voiceStart + 0.01);
              osc.connect(lp).connect(g).connect(dest);
              osc.start(t0); osc.stop(voiceStart + 0.02);
            } else {
              const src = ctx.createBufferSource();
              src.buffer = nbuf; src.loop = true;
              const bp = ctx.createBiquadFilter();
              bp.type = 'bandpass';
              bp.frequency.value = onsetKind === 'fricativeHi' ? 6800
                : onsetKind === 'fricativeLo' ? 3200
                : onsetKind === 'plosive' ? 1800 : 1200;
              bp.Q.value = onsetKind === 'plosive' ? 1.2 : 2.5;
              const g = ctx.createGain();
              const peak = onsetKind === 'plosive' ? 0.3 : 0.2;
              if (onsetKind === 'plosive') {
                g.gain.setValueAtTime(0.0001, t0);
                g.gain.exponentialRampToValueAtTime(peak, t0 + 0.02);
                g.gain.exponentialRampToValueAtTime(0.0001, t0 + onsetDur + 0.01);
              } else {
                g.gain.setValueAtTime(0.0001, t0);
                g.gain.exponentialRampToValueAtTime(peak, t0 + 0.02);
                g.gain.exponentialRampToValueAtTime(0.0001, voiceStart + 0.008);
              }
              src.connect(bp).connect(g).connect(dest);
              src.start(t0, Math.random() * 1.2, onsetDur + 0.05);
              src.stop(voiceStart + 0.05);
            }
          }

          /* ---- coda consonant ---- */
          const codaKind = consonantKind(syl.coda || (syl.text.length > 1 ? syl.text[syl.text.length - 1] : ''));
          if (codaKind === 'fricativeHi' || codaKind === 'fricativeLo' || codaKind === 'plosive') {
            const ct = Math.max(voiceStart, syl.endSec - 0.05);
            const src = ctx.createBufferSource();
            src.buffer = nbuf; src.loop = true;
            const bp = ctx.createBiquadFilter();
            bp.type = 'bandpass';
            bp.frequency.value = codaKind === 'fricativeHi' ? 6200 : codaKind === 'fricativeLo' ? 2800 : 1500;
            bp.Q.value = 2;
            const g = ctx.createGain();
            g.gain.setValueAtTime(0.0001, ct);
            g.gain.exponentialRampToValueAtTime(0.18, ct + 0.015);
            g.gain.exponentialRampToValueAtTime(0.0001, syl.endSec + 0.02);
            src.connect(bp).connect(g).connect(dest);
            src.start(ct, Math.random() * 1.2, syl.endSec - ct + 0.05);
            src.stop(syl.endSec + 0.05);
          }

          /* ---- voiced nucleus with formant bank ---- */
          const vowel = VOWEL_FORMANTS[vowelOf(syl.text)] ?? VOWEL_FORMANTS.ah;
          const out = ctx.createGain();
          out.gain.value = 1;
          out.connect(dest);

          // glottal source: saw with vibrato + glide from previous pitch
          const osc = ctx.createOscillator();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(freq * 0.985, voiceStart);
          osc.frequency.exponentialRampToValueAtTime(freq, voiceStart + Math.min(0.05, voiceDur * 0.4));

          const vib = ctx.createOscillator();
          vib.type = 'sine';
          vib.frequency.value = style.vibratoHz;
          const vibGain = ctx.createGain();
          vibGain.gain.setValueAtTime(0, voiceStart);
          vibGain.gain.linearRampToValueAtTime(freq * (style.vibratoCents / 1200) * 3 * vibScale, voiceStart + Math.min(0.28, voiceDur * 0.7));
          vib.connect(vibGain).connect(osc.frequency);

          const srcGain = ctx.createGain();
          srcGain.gain.value = style.sourceGain;
          osc.connect(srcGain);

          const env = ctx.createGain();
          env.gain.setValueAtTime(0.0001, voiceStart);
          env.gain.exponentialRampToValueAtTime(0.9, voiceStart + Math.min(0.03, voiceDur * 0.3));
          env.gain.setValueAtTime(0.9, voiceStart + voiceDur * 0.75);
          env.gain.exponentialRampToValueAtTime(0.0001, voiceStart + voiceDur + 0.02);
          srcGain.connect(env);

          // parallel formant bandpass filters
          const formantGains = [1, 0.55, 0.22];
          vowel.forEach((f, fi) => {
            const bp = ctx.createBiquadFilter();
            bp.type = 'bandpass';
            bp.frequency.value = f;
            bp.Q.value = style.formantQ;
            const fg = ctx.createGain();
            fg.gain.value = formantGains[fi];
            env.connect(bp).connect(fg).connect(out);
          });
          // a little raw source for body
          const raw = ctx.createGain();
          raw.gain.value = 0.12;
          env.connect(raw).connect(out);

          osc.start(voiceStart);
          osc.stop(voiceStart + voiceDur + 0.05);
          vib.start(voiceStart);
          vib.stop(voiceStart + voiceDur + 0.05);

          /* ---- octave layer (choir style) ---- */
          if (style.octaveLayer > 0) {
            const osc2 = ctx.createOscillator();
            osc2.type = 'sawtooth';
            osc2.frequency.value = freq / 2;
            osc2.detune.value = style.detuneCents;
            const env2 = ctx.createGain();
            env2.gain.setValueAtTime(0.0001, voiceStart);
            env2.gain.exponentialRampToValueAtTime(style.octaveLayer * 0.8, voiceStart + 0.03);
            env2.gain.setValueAtTime(style.octaveLayer * 0.8, voiceStart + voiceDur * 0.75);
            env2.gain.exponentialRampToValueAtTime(0.0001, voiceStart + voiceDur + 0.02);
            osc2.connect(env2);
            const bp2 = ctx.createBiquadFilter();
            bp2.type = 'bandpass';
            bp2.frequency.value = vowel[0] * 1.1;
            bp2.Q.value = style.formantQ;
            const g2 = ctx.createGain();
            g2.gain.value = 0.8;
            env2.connect(bp2).connect(g2).connect(dest);
            osc2.start(voiceStart);
            osc2.stop(voiceStart + voiceDur + 0.05);
          }

          /* ---- breath ---- */
          const breath = ctx.createBufferSource();
          breath.buffer = nbuf; breath.loop = true;
          const bhp = ctx.createBiquadFilter();
          bhp.type = 'highpass'; bhp.frequency.value = 5000;
          const bg = ctx.createGain();
          bg.gain.setValueAtTime(0.0001, voiceStart);
          bg.gain.exponentialRampToValueAtTime(0.045, voiceStart + 0.02);
          bg.gain.exponentialRampToValueAtTime(0.0001, voiceStart + 0.08);
          breath.connect(bhp).connect(bg).connect(dest);
          breath.start(voiceStart, Math.random(), 0.1);
          breath.stop(voiceStart + 0.1);
          void center;
        }
      }
    }
  }
}
