// Procedural SFX for the Motion Graphics Engine.
// Every sound is synthesized (no binary assets), deterministic per seed and
// intentionally minimal — sound design stays sparse by design.

import { Rng } from '../random.js';
import {
  SAMPLE_RATE, osc, noise, expDecayGain, sweepGain, fadeEdges,
  filter, normalize, encodeWav,
} from './synth.js';

function wav(mono) {
  return encodeWav(fadeEdges(normalize(mono, 0.9), { fadeIn: 0.002, fadeOut: 0.01 }), { channels: 1 });
}

function impactSound({ rng }) {
  const samples = Math.round(SAMPLE_RATE * 0.9);
  const out = new Float32Array(samples);
  let ph = 0;
  for (let i = 0; i < samples; i++) {
    const x = i / samples;
    const f = 46 + 120 * Math.pow(1 - x, 4);
    ph += (2 * Math.PI * f) / SAMPLE_RATE;
    out[i] = Math.sin(ph) * Math.exp(-x * 7);
  }
  const crash = filter(noise({ samples, rng }), { type: 'highpass', freq: 2800 });
  const env = expDecayGain(samples, { decay: 0.35, attack: 0.001 });
  for (let i = 0; i < samples; i++) out[i] += crash[i] * env[i] * 0.55;
  return { buffer: wav(out), durationSeconds: 0.9 };
}

function whooshSound({ rng }) {
  const dur = 0.55 + rng.float(0, 0.2);
  const samples = Math.round(SAMPLE_RATE * dur);
  let n = noise({ samples, rng, color: 'pink' });
  n = filter(n, { type: 'bandpass', freq: 320, freqEnd: 4200, q: 1.6 });
  const env = sweepGain(samples, { from: 0.02, to: 1, power: 2.2 }).map((v, i) => v * Math.exp(-Math.pow((i / samples - 0.75) * 6, 2)));
  return { buffer: wav(n.map((v, i) => v * env[i])), durationSeconds: dur };
}

function riserSound({ rng }) {
  const dur = 0.8;
  const samples = Math.round(SAMPLE_RATE * dur);
  let n = noise({ samples, rng });
  n = filter(n, { type: 'bandpass', freq: 250, freqEnd: 5200, q: 2.4 });
  let ph = 0;
  const tone = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    const x = i / samples;
    ph += (2 * Math.PI * (160 + 900 * Math.pow(x, 2))) / SAMPLE_RATE;
    tone[i] = Math.sin(ph) * 0.3;
  }
  const env = sweepGain(samples, { from: 0.04, to: 1, power: 1.7 });
  return { buffer: wav(n.map((v, i) => (v * 0.7 + tone[i]) * env[i])), durationSeconds: dur };
}

function tickSound({ rng }) {
  const samples = Math.round(SAMPLE_RATE * 0.07);
  let n = noise({ samples, rng });
  n = filter(n, { type: 'highpass', freq: 5200 });
  const env = expDecayGain(samples, { decay: 0.02, attack: 0.0004 });
  const blip = osc({ samples, freq: 2100, wave: 'sine' });
  return { buffer: wav(n.map((v, i) => (v * 0.6 + blip[i] * 0.4) * env[i])), durationSeconds: 0.07 };
}

function shimmerSound({ rng }) {
  const dur = 0.7;
  const samples = Math.round(SAMPLE_RATE * dur);
  const base = 1320 + rng.float(-120, 240);
  const v1 = osc({ samples, freq: base, wave: 'sine' });
  const v2 = osc({ samples, freq: base * 1.5, wave: 'sine' });
  const v3 = osc({ samples, freq: base * 2.02, wave: 'sine' });
  const env = expDecayGain(samples, { decay: 0.3, attack: 0.004 });
  return { buffer: wav(v1.map((v, i) => (v + v2[i] * 0.4 + v3[i] * 0.22) * env[i])), durationSeconds: dur };
}

function popSound({ rng }) {
  const samples = Math.round(SAMPLE_RATE * 0.14);
  const out = new Float32Array(samples);
  let ph = 0;
  for (let i = 0; i < samples; i++) {
    const x = i / samples;
    ph += (2 * Math.PI * (620 - 320 * x)) / SAMPLE_RATE;
    out[i] = Math.sin(ph) * Math.exp(-x * 12);
  }
  return { buffer: wav(out), durationSeconds: 0.14 };
}

function glitchSound({ rng }) {
  const dur = 0.28;
  const samples = Math.round(SAMPLE_RATE * dur);
  let n = noise({ samples, rng });
  n = filter(n, { type: 'bandpass', freq: 900, freqEnd: 2600, q: 3 });
  const gate = new Float32Array(samples);
  let gateOn = true;
  for (let i = 0; i < samples; i++) {
    if (i % 1400 === 0) gateOn = rng.chance(0.62);
    gate[i] = gateOn ? 1 : 0;
  }
  const env = sweepGain(samples, { from: 1, to: 0.25, power: 1 });
  return { buffer: wav(n.map((v, i) => v * gate[i] * env[i])), durationSeconds: dur };
}

function alarmSound({ rng }) {
  const dur = 0.5;
  const samples = Math.round(SAMPLE_RATE * dur);
  const out = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    const t = i / SAMPLE_RATE;
    const f = (Math.floor(t * 6) % 2 === 0) ? 880 : 660;
    const ph = (2 * Math.PI * f * t) % (2 * Math.PI);
    out[i] = Math.sin(ph) * 0.5 * (0.6 + 0.4 * Math.sin(2 * Math.PI * 6 * t));
  }
  return { buffer: wav(out), durationSeconds: dur };
}

const GENERATORS = {
  impact: impactSound,
  whoosh: whooshSound,
  riser: riserSound,
  tick: tickSound,
  shimmer: shimmerSound,
  pop: popSound,
  glitch: glitchSound,
  alarm: alarmSound,
};

/** Build a SFX kit: map of type -> {buffer, durationSeconds, storagePath?}. */
export function buildSfxKit(kinds, seed = 11) {
  const rng = new Rng(seed >>> 0);
  const kit = {};
  for (const kind of kinds || ['impact', 'whoosh', 'riser', 'tick', 'shimmer', 'pop']) {
    const gen = GENERATORS[kind];
    if (gen) kit[kind] = gen({ rng: rng.fork(kind) });
  }
  return kit;
}
