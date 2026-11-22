// Tiny deterministic DSP toolkit for the Motion Graphics Engine.
// Pure JS (no native deps) — synthesizes the music bed and SFX as PCM and
// encodes 16-bit WAV buffers that Remotion muxes into the final MP4.

import { Rng } from '../random.js';

export const SAMPLE_RATE = 44100;

export function encodeWav(samples, { sampleRate = SAMPLE_RATE, channels = 1 } = {}) {
  const frames = channels === 2 ? Math.floor(samples.length / 2) : samples.length;
  const bytesPerSample = 2;
  const blockAlign = channels * bytesPerSample;
  const dataSize = frames * blockAlign;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write('RIFF', 0, 'latin1');
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8, 'latin1');
  buffer.write('fmt ', 12, 'latin1');
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);              // PCM
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * blockAlign, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36, 'latin1');
  buffer.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < channels; c++) {
      const v = channels === 2 ? samples[i * 2 + c] : samples[i];
      const clamped = Math.max(-1, Math.min(1, v));
      buffer.writeInt16LE(Math.round(clamped * 32767), 44 + (i * blockAlign) + c * bytesPerSample);
    }
  }
  return buffer;
}

export function secondsToSamples(seconds, sampleRate = SAMPLE_RATE) {
  return Math.max(1, Math.round(seconds * sampleRate));
}

// ----------------------------------------------------------------------------
// Oscillators — each returns a Float32Array of length `samples`.
export function osc({ samples, freq, wave = 'sine', detune = 0, phase = 0, vibratoHz = 0, vibratoDepth = 0 }) {
  const out = new Float32Array(samples);
  const twoPi = Math.PI * 2;
  let ph = phase;
  for (let i = 0; i < samples; i++) {
    const t = i / SAMPLE_RATE;
    const vib = vibratoHz ? 1 + Math.sin(twoPi * vibratoHz * t) * vibratoDepth : 1;
    const f = (freq + detune) * vib;
    ph += (twoPi * f) / SAMPLE_RATE;
    const p = ph % twoPi;
    let v;
    switch (wave) {
      case 'saw': v = 2 * (p / twoPi) - 1; break;
      case 'square': v = p < Math.PI ? 1 : -1; break;
      case 'triangle': v = 1 - 4 * Math.abs(Math.round(p / twoPi) - p / twoPi); break;
      default: v = Math.sin(p);
    }
    out[i] = v;
  }
  return out;
}

export function noise({ samples, rng, color = 'white' }) {
  const out = new Float32Array(samples);
  let last = 0;
  for (let i = 0; i < samples; i++) {
    const w = (rng ? rng.next() : Math.random()) * 2 - 1;
    if (color === 'pink') {
      last = 0.85 * last + 0.15 * w;
      out[i] = last * 1.6;
    } else if (color === 'brown') {
      last = (last + 0.02 * w) / 1.02;
      out[i] = last * 3.5;
    } else {
      out[i] = w;
    }
  }
  return out;
}

// ----------------------------------------------------------------------------
// Envelope helpers (per-sample gains)
export function adsrGain(samples, { attack = 0.01, hold = 0, decay = 0.1, sustain = 0.7, release = 0.1, curve = 1.6 } = {}) {
  const out = new Float32Array(samples);
  const a = secondsToSamples(attack), h = secondsToSamples(hold), d = secondsToSamples(decay), r = secondsToSamples(release);
  const susStart = Math.min(samples, a + h + d);
  const relStart = Math.max(susStart, samples - r);
  for (let i = 0; i < samples; i++) {
    let g;
    if (i < a) g = Math.pow(i / Math.max(1, a), curve);
    else if (i < a + h) g = 1;
    else if (i < susStart) g = 1 - (1 - sustain) * ((i - a - h) / Math.max(1, d));
    else if (i < relStart) g = sustain;
    else g = sustain * Math.pow(Math.max(0, 1 - (i - relStart) / Math.max(1, r)), 1.4);
    out[i] = g;
  }
  return out;
}

export function expDecayGain(samples, { decay = 0.2, attack = 0.002 } = {}) {
  const out = new Float32Array(samples);
  const a = secondsToSamples(attack);
  const k = 1 / Math.max(0.01, decay);
  for (let i = 0; i < samples; i++) {
    const t = Math.max(0, (i - a) / SAMPLE_RATE);
    out[i] = (i < a ? i / Math.max(1, a) : 1) * Math.exp(-k * t);
  }
  return out;
}

export function sweepGain(samples, { from = 0.2, to = 1, power = 1.5 } = {}) {
  const out = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    const x = i / Math.max(1, samples - 1);
    out[i] = from + (to - from) * Math.pow(x, power);
  }
  return out;
}

export function fadeEdges(samples, { fadeIn = 0.01, fadeOut = 0.02 } = {}) {
  const out = Float32Array.from(samples);
  const fi = secondsToSamples(fadeIn), fo = secondsToSamples(fadeOut);
  for (let i = 0; i < fi && i < out.length; i++) out[i] *= i / fi;
  for (let i = 0; i < fo && i < out.length; i++) out[out.length - 1 - i] *= i / fo;
  return out;
}

// ----------------------------------------------------------------------------
// Biquad filters (RBJ cookbook)
function biquadState() { return { x1: 0, x2: 0, y1: 0, y2: 0 }; }
function biquadCoef(type, freq, q = 0.707) {
  const w0 = (2 * Math.PI * Math.min(freq, SAMPLE_RATE / 2 - 100)) / SAMPLE_RATE;
  const alpha = Math.sin(w0) / (2 * q);
  const cosw = Math.cos(w0);
  let b0, b1, b2, a0, a1, a2;
  if (type === 'lowpass') {
    b0 = (1 - cosw) / 2; b1 = 1 - cosw; b2 = (1 - cosw) / 2; a0 = 1 + alpha; a1 = -2 * cosw; a2 = 1 - alpha;
  } else if (type === 'highpass') {
    b0 = (1 + cosw) / 2; b1 = -(1 + cosw); b2 = (1 + cosw) / 2; a0 = 1 + alpha; a1 = -2 * cosw; a2 = 1 - alpha;
  } else { // bandpass
    b0 = alpha; b1 = 0; b2 = -alpha; a0 = 1 + alpha; a1 = -2 * cosw; a2 = 1 - alpha;
  }
  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 };
}

export function filter(input, { type = 'lowpass', freq = 1000, q = 0.707, freqEnd = null, qEnd = null } = {}) {
  const out = new Float32Array(input.length);
  const state = biquadState();
  const sweep = freqEnd != null;
  const coefStep = sweep ? 32 : input.length + 1; // recompute only when sweeping
  let c = biquadCoef(type, freq, q);
  for (let i = 0; i < input.length; i++) {
    if (sweep && i % coefStep === 0) {
      const x = i / Math.max(1, input.length - 1);
      const f = freq + (freqEnd - freq) * x;
      const qq = qEnd ? q + (qEnd - q) * x : q;
      c = biquadCoef(type, f, qq);
    }
    const xn = input[i];
    const yn = c.b0 * xn + c.b1 * state.x1 + c.b2 * state.x2 - c.a1 * state.y1 - c.a2 * state.y2;
    state.x2 = state.x1; state.x1 = xn; state.y2 = state.y1; state.y1 = yn;
    out[i] = yn;
  }
  return out;
}

// ----------------------------------------------------------------------------
// Mixing utilities
export function mixInto(master, part, offsetSeconds, gain = 1, pan = 0) {
  const start = secondsToSamples(offsetSeconds);
  const end = Math.min(master.length, start + part.length);
  if (master.length && master.buffer && master.channels === 2) {
    // stereo master: `master.left/right` arrays expected via makeStereo()
    return;
  }
  for (let i = start; i < end; i++) {
    master[i] += part[i - start] * gain;
  }
}

export function makeStereo(samples) {
  return { length: samples.length, left: Float32Array.from(samples), right: Float32Array.from(samples), channels: 2 };
}

export function mixStereo(stereo, part, offsetSeconds, gain = 1, pan = 0) {
  const start = secondsToSamples(offsetSeconds);
  const end = Math.min(stereo.length, start + part.length);
  const gl = gain * Math.min(1, 1 - pan);
  const gr = gain * Math.min(1, 1 + pan);
  for (let i = start; i < end; i++) {
    const v = part[i - start];
    stereo.left[i] += v * gl;
    stereo.right[i] += v * gr;
  }
}

export function normalize(master, target = 0.92) {
  let peak = 0;
  for (let i = 0; i < master.length; i++) peak = Math.max(peak, Math.abs(master[i]));
  if (peak <= 0.00001) return master;
  const g = target / peak;
  const out = new Float32Array(master.length);
  for (let i = 0; i < master.length; i++) out[i] = Math.tanh(master[i] * g * 1.08) * 0.96;
  return out;
}

export function applyDucking(master, windows, { duckGain = 0.32, attackSec = 0.08, releaseSec = 0.45 } = {}) {
  if (!windows?.length) return master;
  const out = new Float32Array(master.length);
  let gain = 1;
  const attackPerSample = 1 / Math.max(1, secondsToSamples(attackSec));
  const releasePerSample = 1 / Math.max(1, secondsToSamples(releaseSec));
  let windowIndex = 0;
  for (let i = 0; i < master.length; i++) {
    const t = i / SAMPLE_RATE;
    const inside = windowIndex < windows.length && t >= windows[windowIndex].start && t <= windows[windowIndex].end;
    if (inside) {
      gain = Math.max(duckGain, gain - attackPerSample);
    } else {
      if (windowIndex < windows.length && t > windows[windowIndex].end) windowIndex++;
      gain = Math.min(1, gain + releasePerSample * 0.25);
    }
    out[i] = master[i] * gain;
  }
  return out;
}

export function rngFor(seed) {
  return new Rng((seed ^ 0xa17c) >>> 0);
}

// Music theory helpers -------------------------------------------------------
export function hzFromSemitone(rootHz, semitone) {
  return rootHz * Math.pow(2, semitone / 12);
}
