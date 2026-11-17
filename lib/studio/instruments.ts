/**
 * Instrument synthesizer voices for the Web Audio API.
 *
 * Every voice schedules nodes into an (offline or live) AudioContext at an
 * absolute time — the whole instrumental is synthesized, not sampled, so the
 * studio ships zero audio assets and generates original music every time.
 */
import type { InstrumentEvent } from './types';
import { midiToFreq } from './theory';

type Ctx = BaseAudioContext;

const noiseBufferCache = new WeakMap<Ctx, AudioBuffer>();

function noiseBuffer(ctx: Ctx): AudioBuffer {
  let buf = noiseBufferCache.get(ctx);
  if (!buf) {
    buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 2), ctx.sampleRate);
    const data = buf.getChannelData(0);
    let seed = 1234567;
    for (let i = 0; i < data.length; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      data[i] = (seed / 0x3fffffff) - 1;
    }
    noiseBufferCache.set(ctx, buf);
  }
  return buf;
}

function adsr(gain: GainNode, t: number, a: number, d: number, s: number, r: number, peak: number, sustainLevel: number, dur: number) {
  const p = gain.gain;
  p.setValueAtTime(0.0001, t);
  p.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + a);
  p.exponentialRampToValueAtTime(Math.max(peak * sustainLevel, 0.0002), t + a + d);
  p.setValueAtTime(Math.max(peak * sustainLevel, 0.0002), t + Math.max(a + d, dur));
  p.exponentialRampToValueAtTime(0.0001, t + Math.max(a + d, dur) + r);
}

function noiseSource(ctx: Ctx, t: number, dur: number): AudioBufferSourceNode {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  src.loop = true;
  src.start(t, Math.random() * 1.5, dur + 0.1);
  return src;
}

/* ---------------- Drums ---------------- */

function kick(ctx: Ctx, dest: AudioNode, t: number, vel: number) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(150, t);
  osc.frequency.exponentialRampToValueAtTime(45, t + 0.11);
  g.gain.setValueAtTime(vel * 1.1, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
  osc.connect(g).connect(dest);
  osc.start(t); osc.stop(t + 0.3);
  // click
  const click = noiseSource(ctx, t, 0.02);
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass'; hp.frequency.value = 2000;
  const cg = ctx.createGain();
  cg.gain.setValueAtTime(vel * 0.25, t);
  cg.gain.exponentialRampToValueAtTime(0.001, t + 0.02);
  click.connect(hp).connect(cg).connect(dest);
  click.stop(t + 0.03);
}

function snare(ctx: Ctx, dest: AudioNode, t: number, vel: number) {
  const n = noiseSource(ctx, t, 0.2);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass'; bp.frequency.value = 2200; bp.Q.value = 0.8;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vel * 0.8, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
  n.connect(bp).connect(g).connect(dest);
  n.stop(t + 0.2);
  const tone = ctx.createOscillator();
  tone.type = 'triangle'; tone.frequency.setValueAtTime(190, t);
  const tg = ctx.createGain();
  tg.gain.setValueAtTime(vel * 0.4, t);
  tg.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
  tone.connect(tg).connect(dest);
  tone.start(t); tone.stop(t + 0.1);
}

function clap(ctx: Ctx, dest: AudioNode, t: number, vel: number) {
  for (let i = 0; i < 3; i++) {
    const tt = t + i * 0.012;
    const n = noiseSource(ctx, tt, 0.08);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 1600; bp.Q.value = 1.6;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vel * (i === 2 ? 0.7 : 0.35), tt);
    g.gain.exponentialRampToValueAtTime(0.001, tt + (i === 2 ? 0.12 : 0.03));
    n.connect(bp).connect(g).connect(dest);
    n.stop(tt + 0.14);
  }
}

function hat(ctx: Ctx, dest: AudioNode, t: number, vel: number, open = false) {
  const n = noiseSource(ctx, t, open ? 0.3 : 0.05);
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass'; hp.frequency.value = 7500;
  const g = ctx.createGain();
  const dur = open ? 0.22 : 0.045;
  g.gain.setValueAtTime(vel * 0.35, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  n.connect(hp).connect(g).connect(dest);
  n.stop(t + dur + 0.02);
}

function shaker(ctx: Ctx, dest: AudioNode, t: number, vel: number) {
  const n = noiseSource(ctx, t, 0.06);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass'; bp.frequency.value = 9000; bp.Q.value = 2;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.001, t);
  g.gain.exponentialRampToValueAtTime(vel * 0.22, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
  n.connect(bp).connect(g).connect(dest);
  n.stop(t + 0.08);
}

function rim(ctx: Ctx, dest: AudioNode, t: number, vel: number) {
  const n = noiseSource(ctx, t, 0.03);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass'; bp.frequency.value = 3600; bp.Q.value = 3;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vel * 0.5, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
  n.connect(bp).connect(g).connect(dest);
  n.stop(t + 0.05);
}

function tom(ctx: Ctx, dest: AudioNode, t: number, vel: number, midi = 55) {
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  const f = midiToFreq(midi);
  osc.frequency.setValueAtTime(f * 1.5, t);
  osc.frequency.exponentialRampToValueAtTime(f, t + 0.12);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vel * 0.9, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
  osc.connect(g).connect(dest);
  osc.start(t); osc.stop(t + 0.25);
}

function tamb(ctx: Ctx, dest: AudioNode, t: number, vel: number) {
  const n = noiseSource(ctx, t, 0.05);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass'; bp.frequency.value = 10500; bp.Q.value = 1.5;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vel * 0.3, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
  n.connect(bp).connect(g).connect(dest);
  n.stop(t + 0.07);
}

function logdrum(ctx: Ctx, dest: AudioNode, t: number, vel: number, midi: number) {
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  const f = midiToFreq(midi);
  osc.frequency.setValueAtTime(f * 2.2, t);
  osc.frequency.exponentialRampToValueAtTime(f, t + 0.07);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vel * 1.0, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = 900;
  osc.connect(g).connect(lp).connect(dest);
  osc.start(t); osc.stop(t + 0.35);
  // woody click
  const n = noiseSource(ctx, t, 0.02);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass'; bp.frequency.value = 1200; bp.Q.value = 4;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(vel * 0.2, t);
  ng.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
  n.connect(bp).connect(ng).connect(dest);
  n.stop(t + 0.04);
}

/* ---------------- Melodic voices ---------------- */

function synthVoice(
  ctx: Ctx, dest: AudioNode, t: number, dur: number, midi: number, vel: number,
  opts: { wave?: OscillatorType; attack?: number; release?: number; cutoff?: number; detune?: number; sub?: boolean; filterEnv?: number },
) {
  const { wave = 'sawtooth', attack = 0.005, release = 0.15, cutoff = 2200, detune = 0, sub = false, filterEnv = 0 } = opts;
  const freq = midiToFreq(midi);
  const g = ctx.createGain();
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(cutoff, t);
  if (filterEnv > 0) {
    lp.frequency.setValueAtTime(Math.min(12000, cutoff + filterEnv), t);
    lp.frequency.exponentialRampToValueAtTime(Math.max(120, cutoff), t + Math.min(0.3, dur));
  }
  lp.Q.value = 0.7;
  g.connect(lp).connect(dest);
  adsr(g, t, attack, 0.05, 0.7, release, vel, 0.65, dur);

  const oscs: OscillatorNode[] = [];
  for (const dt of [0, detune]) {
    const o = ctx.createOscillator();
    o.type = wave;
    o.frequency.value = freq;
    o.detune.value = dt;
    const og = ctx.createGain();
    og.gain.value = dt === 0 ? 0.6 : 0.4;
    o.connect(og).connect(g);
    o.start(t); o.stop(t + dur + release + 0.05);
    oscs.push(o);
  }
  if (sub) {
    const s = ctx.createOscillator();
    s.type = 'sine';
    s.frequency.value = freq / 2;
    const sg = ctx.createGain();
    sg.gain.value = 0.35;
    s.connect(sg).connect(g);
    s.start(t); s.stop(t + dur + release + 0.05);
    oscs.push(s);
  }
  return oscs;
}

function padVoice(ctx: Ctx, dest: AudioNode, t: number, dur: number, midi: number, vel: number) {
  synthVoice(ctx, dest, t, dur, midi, vel * 0.8, {
    wave: 'sawtooth', attack: 0.4, release: 0.8, cutoff: 1400, detune: 8,
  });
}

function organVoice(ctx: Ctx, dest: AudioNode, t: number, dur: number, midi: number, vel: number) {
  const freq = midiToFreq(midi);
  const g = ctx.createGain();
  g.connect(dest);
  adsr(g, t, 0.01, 0.03, 0.9, 0.08, vel, 0.9, dur);
  [1, 2, 3, 4].forEach((mult, i) => {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = freq * mult;
    const og = ctx.createGain();
    og.gain.value = [0.5, 0.3, 0.18, 0.08][i];
    o.connect(og).connect(g);
    o.start(t); o.stop(t + dur + 0.15);
  });
}

function bellVoice(ctx: Ctx, dest: AudioNode, t: number, dur: number, midi: number, vel: number) {
  const freq = midiToFreq(midi);
  const carrier = ctx.createOscillator();
  carrier.type = 'sine';
  carrier.frequency.value = freq;
  const mod = ctx.createOscillator();
  mod.type = 'sine';
  mod.frequency.value = freq * 2.01;
  const modGain = ctx.createGain();
  modGain.gain.setValueAtTime(freq * 1.4, t);
  modGain.gain.exponentialRampToValueAtTime(1, t + 0.5);
  mod.connect(modGain).connect(carrier.frequency);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vel * 0.5, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + Math.min(dur + 0.8, 1.8));
  carrier.connect(g).connect(dest);
  carrier.start(t); carrier.stop(t + dur + 1);
  mod.start(t); mod.stop(t + dur + 1);
}

function pluckVoice(ctx: Ctx, dest: AudioNode, t: number, dur: number, midi: number, vel: number) {
  synthVoice(ctx, dest, t, Math.min(dur, 0.35), midi, vel, {
    wave: 'triangle', attack: 0.002, release: 0.2, cutoff: 3200, filterEnv: 2600, sub: false,
  });
}

function stabVoice(ctx: Ctx, dest: AudioNode, t: number, dur: number, midi: number, vel: number) {
  synthVoice(ctx, dest, t, Math.min(dur, 0.3), midi, vel, {
    wave: 'sawtooth', attack: 0.004, release: 0.12, cutoff: 1800, detune: 14,
  });
}

function leadVoice(ctx: Ctx, dest: AudioNode, t: number, dur: number, midi: number, vel: number) {
  synthVoice(ctx, dest, t, dur, midi, vel, {
    wave: 'square', attack: 0.006, release: 0.2, cutoff: 2600, detune: 6, sub: true,
  });
}

function bassVoice(ctx: Ctx, dest: AudioNode, t: number, dur: number, midi: number, vel: number) {
  synthVoice(ctx, dest, t, dur, midi, vel, {
    wave: 'sawtooth', attack: 0.004, release: 0.1, cutoff: 700, detune: 0, sub: true,
  });
}

/* ---------------- FX ---------------- */

function riser(ctx: Ctx, dest: AudioNode, t: number, dur: number, vel: number) {
  const n = noiseSource(ctx, t, dur);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.setValueAtTime(400, t);
  bp.frequency.exponentialRampToValueAtTime(6000, t + dur);
  bp.Q.value = 1.2;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.001, t);
  g.gain.exponentialRampToValueAtTime(vel * 0.5, t + dur * 0.9);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur + 0.05);
  n.connect(bp).connect(g).connect(dest);
  n.stop(t + dur + 0.1);
}

function impact(ctx: Ctx, dest: AudioNode, t: number, vel: number) {
  kick(ctx, dest, t, vel);
  const n = noiseSource(ctx, t, 0.6);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.setValueAtTime(3000, t);
  lp.frequency.exponentialRampToValueAtTime(200, t + 0.6);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vel * 0.4, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
  n.connect(lp).connect(g).connect(dest);
  n.stop(t + 0.65);
}

/* ---------------- Dispatcher ---------------- */

export function playInstrumentEvent(ctx: Ctx, dest: AudioNode, ev: InstrumentEvent) {
  const { inst, tSec: t, durSec: dur, midi = 60, vel } = ev;
  switch (inst) {
    case 'kick': return kick(ctx, dest, t, vel);
    case 'snare': return snare(ctx, dest, t, vel);
    case 'clap': return clap(ctx, dest, t, vel);
    case 'hat': return hat(ctx, dest, t, vel, false);
    case 'hatOpen': return hat(ctx, dest, t, vel, true);
    case 'shaker': return shaker(ctx, dest, t, vel);
    case 'rim': return rim(ctx, dest, t, vel);
    case 'tom': return tom(ctx, dest, t, vel, midi);
    case 'tamb': return tamb(ctx, dest, t, vel);
    case 'logdrum': return logdrum(ctx, dest, t, vel, midi);
    case 'bass': return bassVoice(ctx, dest, t, dur, midi, vel);
    case 'pluck': return pluckVoice(ctx, dest, t, dur, midi, vel);
    case 'stab': return stabVoice(ctx, dest, t, dur, midi, vel);
    case 'pad': return padVoice(ctx, dest, t, dur, midi, vel);
    case 'organ': return organVoice(ctx, dest, t, dur, midi, vel);
    case 'lead': return leadVoice(ctx, dest, t, dur, midi, vel);
    case 'bell': return bellVoice(ctx, dest, t, dur, midi, vel);
    case 'riser': return riser(ctx, dest, t, dur, vel);
    case 'impact': return impact(ctx, dest, t, vel);
    default: return;
  }
}
