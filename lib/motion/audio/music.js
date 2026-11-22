// Procedural background music for the Motion Graphics Engine.
// Deterministic per seed. Arrangement follows the scene plan: scene changes
// land on musical boundaries, a riser leads into each cut and an impact hits
// on the cut, and the whole bed ducks under narration windows.

import { Rng } from '../random.js';
import {
  SAMPLE_RATE, osc, noise, adsrGain, expDecayGain, sweepGain, fadeEdges,
  filter, makeStereo, mixStereo, normalize, applyDucking, hzFromSemitone, encodeWav,
} from './synth.js';

const KIT_PROFILES = {
  pulse: { kick: 0.95, hat: 0.7, clap: 0.5, bass: 0.55, pad: 0.3, arp: 0.5, arpRate: 8, brightness: 2400 },
  tech: { kick: 0.9, hat: 0.95, clap: 0.35, bass: 0.6, pad: 0.2, arp: 0.7, arpRate: 16, brightness: 3200 },
  cinematic: { kick: 0.25, hat: 0.05, clap: 0.05, bass: 0.4, pad: 0.85, arp: 0.2, arpRate: 4, brightness: 1500 },
  epic: { kick: 0.7, hat: 0.25, clap: 0.6, bass: 0.5, pad: 0.6, arp: 0.3, arpRate: 8, brightness: 2000 },
  chill: { kick: 0.4, hat: 0.3, clap: 0.25, bass: 0.4, pad: 0.7, arp: 0.4, arpRate: 8, brightness: 1300 },
  dark: { kick: 0.5, hat: 0.2, clap: 0.1, bass: 0.7, pad: 0.6, arp: 0.15, arpRate: 8, brightness: 900 },
  bright: { kick: 0.8, hat: 0.8, clap: 0.4, bass: 0.5, pad: 0.35, arp: 0.65, arpRate: 8, brightness: 3000 },
};

// One-shot instruments --------------------------------------------------------
function kick({ rng, gain = 1 }) {
  const samples = Math.round(SAMPLE_RATE * 0.42);
  const f0 = 150, f1 = 42;
  const out = new Float32Array(samples);
  let ph = 0;
  for (let i = 0; i < samples; i++) {
    const x = i / samples;
    const f = f1 + (f0 - f1) * Math.pow(1 - x, 3.2);
    ph += (2 * Math.PI * f) / SAMPLE_RATE;
    out[i] = Math.sin(ph) * Math.exp(-x * 9);
  }
  const click = noise({ samples: Math.round(SAMPLE_RATE * 0.012), rng });
  for (let i = 0; i < click.length; i++) out[i] += click[i] * 0.3 * (1 - i / click.length);
  return out.map((v) => v * gain);
}

function snareOrClap({ rng, gain = 1, tone = 1800 }) {
  const samples = Math.round(SAMPLE_RATE * 0.24);
  let n = noise({ samples, rng, color: 'white' });
  n = filter(n, { type: 'bandpass', freq: tone, q: 0.8 });
  const env = expDecayGain(samples, { decay: 0.09, attack: 0.001 });
  return n.map((v, i) => v * env[i] * gain * 1.4);
}

function hat({ rng, gain = 1, open = false }) {
  const samples = Math.round(SAMPLE_RATE * (open ? 0.18 : 0.05));
  let n = noise({ samples, rng, color: 'white' });
  n = filter(n, { type: 'highpass', freq: 7200 });
  const env = expDecayGain(samples, { decay: open ? 0.09 : 0.022, attack: 0.0005 });
  return n.map((v, i) => v * env[i] * gain);
}

function bassNote({ freq, dur, gain = 1, wave = 'saw' }) {
  const samples = Math.round(SAMPLE_RATE * dur);
  const fundamental = osc({ samples, freq, wave });
  const sub = osc({ samples, freq: freq / 2, wave: 'sine' });
  let out = filter(fundamental, { type: 'lowpass', freq: 420, q: 0.6 });
  const env = adsrGain(samples, { attack: 0.004, decay: 0.08, sustain: 0.65, release: Math.min(0.2, dur * 0.3) });
  return out.map((v, i) => (v * 0.6 + sub[i] * 0.55) * env[i] * gain);
}

function padChord({ freqs, dur, gain = 1, brightness = 1500, wave = 'saw' }) {
  const samples = Math.round(SAMPLE_RATE * dur);
  let acc = new Float32Array(samples);
  freqs.forEach((f, i) => {
    const detune = (i - (freqs.length - 1) / 2) * 3.5;
    const voice = osc({ samples, freq: f, wave, detune, vibratoHz: 0.16, vibratoDepth: 0.004 });
    acc = acc.map((v, j) => v + voice[j] / freqs.length);
  });
  acc = filter(acc, { type: 'lowpass', freq: brightness, q: 0.5 });
  const env = adsrGain(samples, { attack: Math.min(0.9, dur * 0.25), decay: 0.2, sustain: 0.8, release: Math.min(1.2, dur * 0.35), curve: 1.1 });
  return acc.map((v, i) => v * env[i] * gain);
}

function pluck({ freq, dur, gain = 1, brightness = 2400, wave = 'triangle' }) {
  const samples = Math.round(SAMPLE_RATE * Math.min(dur, 0.5));
  const voice = osc({ samples, freq, wave });
  const filtered = filter(voice, { type: 'lowpass', freq: brightness, q: 0.7 });
  const env = expDecayGain(samples, { decay: 0.16, attack: 0.001 });
  return filtered.map((v, i) => v * env[i] * gain);
}

function riser({ dur, gain = 1, rng }) {
  const samples = Math.round(SAMPLE_RATE * dur);
  let n = noise({ samples, rng, color: 'white' });
  n = filter(n, { type: 'bandpass', freq: 300, freqEnd: 6000, q: 2.2 });
  const env = sweepGain(samples, { from: 0.05, to: 1, power: 1.8 });
  // rising tone via per-sample phase acceleration
  const tone = new Float32Array(samples);
  let ph = 0;
  for (let i = 0; i < samples; i++) {
    const x = i / samples;
    const f = 180 + 720 * Math.pow(x, 2);
    ph += (2 * Math.PI * f) / SAMPLE_RATE;
    tone[i] = Math.sin(ph) * 0.35;
  }
  return n.map((v, i) => (v * 0.7 + tone[i]) * env[i] * gain);
}

function impact({ gain = 1, rng }) {
  const samples = Math.round(SAMPLE_RATE * 1.1);
  const boom = kick({ rng, gain });
  const crashNoise = filter(noise({ samples, rng }), { type: 'highpass', freq: 3200 });
  const env = expDecayGain(samples, { decay: 0.5, attack: 0.001 });
  const out = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    out[i] = (boom[i] || 0) * 1.1 + crashNoise[i] * env[i] * 0.5;
  }
  return out.map((v) => v * gain);
}

// Arrangement -----------------------------------------------------------------
/**
 * Render the music bed.
 * @returns {{ wav: Buffer, durationSeconds: number }}
 */
export function renderMusicBed({ musicPlan, totalDuration, narrationWindows = [], seed = 7 }) {
  const kit = KIT_PROFILES[musicPlan.style] || KIT_PROFILES.pulse;
  const beat = musicPlan.beatSeconds;
  const bar = beat * 4;
  const rng = new Rng((seed ^ (musicPlan.tempo * 7919)) >>> 0);
  const duration = totalDuration + 1.6;
  const samples = Math.round(SAMPLE_RATE * duration);
  const master = makeStereo(new Float32Array(samples));
  const scale = musicPlan.scale;
  const root = musicPlan.rootHz * 8; // bring into audible bass range
  const prog = musicPlan.progression;

  const events = [];
  let barIndex = 0;
  for (let t = 0; t < duration - 0.4; t += bar) {
    const intensity = intensityAt(musicPlan, t / Math.max(0.01, totalDuration));
    const chordRoot = hzFromSemitone(root, scale[prog[barIndex % prog.length]] + 12);
    const chord = [0, 3, 7, 10].map((s) => hzFromSemitone(chordRoot, s));
    const nearBoundary = musicPlan.sceneBoundaries.some((b) => b > t && b <= t + bar + 0.01);
    const isBoundary = musicPlan.sceneBoundaries.some((b) => Math.abs(b - t) < bar / 2);

    // Intro is sparser, ending is a slow decay.
    const sectionGain = t < bar ? 0.5 : t > totalDuration ? 0.4 : 0.75 + intensity * 0.45;

    // Drums
    if (kit.kick > 0.2 && (isBoundary || intensity > 0.35)) {
      for (let b = 0; b < 4; b++) {
        if (kit.kick > 0.6 || b === 0 || b === 2) {
          events.push({ at: t + b * beat, kind: 'kick', gain: kit.kick * sectionGain * (b === 0 ? 1.1 : 0.85) });
        }
      }
    }
    if (kit.hat > 0.1 && intensity > 0.3) {
      const rate = kit.arpRate >= 16 ? 0.25 : 0.5;
      for (let h = 0; h < 4 / rate - 0.001; h++) {
        if (rng.chance(kit.hat)) {
          events.push({ at: t + h * beat * rate + (musicPlan.swing ? rate * beat * musicPlan.swing : 0), kind: 'hat', gain: kit.hat * sectionGain * (h % 2 ? 0.7 : 1), open: h % 4 === 2 && rng.chance(0.4) });
        }
      }
    }
    if (kit.clap > 0.2 && intensity > 0.45) {
      events.push({ at: t + beat, kind: 'clap', gain: kit.clap * sectionGain * 0.8 });
      events.push({ at: t + beat * 3, kind: 'clap', gain: kit.clap * sectionGain * 0.8 });
    }

    // Bass
    events.push({ at: t, kind: 'bass', freq: chordRoot / 2, dur: beat * 2.1, gain: kit.bass * sectionGain });
    if (intensity > 0.5 && kit.bass > 0.4) {
      events.push({ at: t + beat * 2.5, kind: 'bass', freq: chordRoot / 2, dur: beat * 1.4, gain: kit.bass * sectionGain * 0.7 });
    }

    // Pad
    if (kit.pad > 0.15) {
      events.push({ at: t, kind: 'pad', freqs: chord.map((f) => f * 2), dur: bar * 1.02, gain: kit.pad * sectionGain * 0.8, brightness: kit.brightness * (0.8 + intensity * 0.5) });
    }

    // Arp / pluck melody
    if (kit.arp > 0.15 && intensity > 0.4) {
      const steps = kit.arpRate;
      for (let s = 0; s < steps; s++) {
        if (!rng.chance(0.72)) continue;
        const semi = scale[rng.int(0, scale.length - 1)] + (rng.chance(0.25) ? 12 : 0);
        events.push({ at: t + (s * bar) / steps, kind: 'pluck', freq: hzFromSemitone(chordRoot * 4, semi), dur: beat, gain: kit.arp * sectionGain * 0.5, brightness: kit.brightness });
      }
    }
    barIndex++;
  }

  // Riser + impact exactly at every scene boundary (cut-synced sound design).
  events.push({ at: 0, kind: 'impact', gain: 0.8, rng });
  for (const b of musicPlan.sceneBoundaries) {
    const riserDur = Math.min(1.1, Math.max(0.5, b * 0.12));
    if (b - riserDur > 0.2) events.push({ at: b - riserDur, kind: 'riser', dur: riserDur, gain: 0.42, rng });
    events.push({ at: b, kind: 'impact', gain: 0.72, rng });
  }

  // Render events
  for (const ev of events) {
    let part = null, pan = rng.float(-0.25, 0.25);
    switch (ev.kind) {
      case 'kick': part = kick({ rng, gain: ev.gain }); pan = 0; break;
      case 'clap': part = snareOrClap({ rng, gain: ev.gain, tone: 1500 }); break;
      case 'hat': part = hat({ rng, gain: ev.gain, open: ev.open }); pan = rng.float(-0.3, 0.3); break;
      case 'bass': part = bassNote({ freq: ev.freq, dur: ev.dur, gain: ev.gain }); pan = 0; break;
      case 'pad': part = padChord({ freqs: ev.freqs, dur: ev.dur, gain: ev.gain, brightness: ev.brightness }); pan = 0; break;
      case 'pluck': part = pluck({ freq: ev.freq, dur: ev.dur, gain: ev.gain, brightness: ev.brightness }); break;
      case 'riser': part = riser({ dur: ev.dur, gain: ev.gain, rng }); pan = 0; break;
      case 'impact': part = impact({ gain: ev.gain, rng }); pan = 0; break;
      default: break;
    }
    if (part) mixStereo(master, part, ev.at, 1, pan);
  }

  let mixed = new Float32Array(master.length);
  for (let i = 0; i < master.length; i++) mixed[i] = (master.left[i] + master.right[i]) / 2;
  mixed = applyDucking(mixed, narrationWindows, { duckGain: 0.3 });
  mixed = fadeEdges(normalize(mixed, 0.88), { fadeIn: 0.25, fadeOut: 1.4 });
  const stereoOut = new Float32Array(master.length * 2);
  for (let i = 0; i < master.length; i++) {
    stereoOut[i * 2] = mixed[i];
    stereoOut[i * 2 + 1] = mixed[i];
  }
  const wav = encodeWav(stereoOut, { channels: 2 });
  return { wav, durationSeconds: duration, events: events.length };
}

function intensityAt(musicPlan, x) {
  const curve = musicPlan.intensityCurve || [];
  if (!curve.length) return 0.6;
  const idx = Math.min(curve.length - 1, Math.floor(x * curve.length));
  return curve[idx];
}
