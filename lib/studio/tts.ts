/**
 * TTS-Map vocal source — a second, more intelligible singing mode.
 *
 * Each syllable is spoken by the configured SBA voice engine or Gemini TTS through the
 * /api/admin/music-studio/tts endpoint, then transformed into a sung
 * note: F0 is detected, the fragment is pitch-shifted to its melody pitch
 * and time-stretched to the exact note duration.
 *
 * This reuses the existing Gemini API key when no dedicated SBA TTS endpoint is configured, and
 * the result is genuinely melodic singing (pitch + rhythm from the score),
 * not narration over music.
 */
import type { Timeline } from './types';
import { midiToFreq } from './theory';
import {
  base64ToArrayBuffer, decodeMonoWav, detectF0, normalize, pitchShift, trimSilence,
} from './dsp';

export interface TtsProvider {
  /** Returns base64 wav per requested syllable text. */
  synthesize(items: string[]): Promise<Record<string, string>>;
}

interface DecodedSyl { data: Float32Array; rate: number; f0: number }

const cache = new Map<string, DecodedSyl>();

export async function fetchSyllables(
  items: string[],
  provider: TtsProvider,
  onProgress?: (done: number, total: number) => void,
): Promise<Map<string, DecodedSyl>> {
  // Array.from avoids Set-iterator downlevel errors with this repo's ES5 TS target.
  const unique = Array.from(new Set(items.map((i) => i.toLowerCase()))).filter((i) => i.trim().length > 0);
  const map = new Map<string, DecodedSyl>();
  const CHUNK = 48;
  let done = 0;
  for (let c = 0; c < unique.length; c += CHUNK) {
    const chunk = unique.slice(c, c + CHUNK);
    let audio: Record<string, string>;
    try {
      audio = await provider.synthesize(chunk);
    } catch {
      // Do not fan out dozens of single-syllable retries after a failed batch.
      // The caller will use the complete built-in synth fallback instead.
      audio = {};
    }
    for (const [k, b64] of Object.entries(audio)) {
      const { data, rate } = decodeMonoWav(base64ToArrayBuffer(b64));
      const trimmed = trimSilence(data);
      const f0 = detectF0(trimmed, rate);
      if (trimmed.length > 64) {
        map.set(k, { data: trimmed, rate, f0 });
      }
    }
    done += chunk.length;
    onProgress?.(done, unique.length);
  }
  return map;
}

export const apiTtsProvider = (): TtsProvider => ({
  async synthesize(items: string[]) {
    const res = await fetch('/api/admin/music-studio/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    });
    if (!res.ok) throw new Error(`TTS endpoint unavailable (${res.status})`);
    const json = await res.json() as { audio: Record<string, string> };
    return json.audio;
  },
});

export const remoteTtsProvider = (url: string): TtsProvider => ({
  async synthesize(items: string[]) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    });
    if (!res.ok) throw new Error(`Remote TTS failed (${res.status})`);
    const json = await res.json() as { audio: Record<string, string> };
    return json.audio;
  },
});

/** Render sung vocals for the whole timeline using TTS fragments. */
export async function singViaTts(
  ctx: BaseAudioContext,
  dest: AudioNode,
  timeline: Timeline,
  provider: TtsProvider,
  onProgress?: (msg: string, percent: number) => void,
): Promise<boolean> {
  const items: string[] = [];
  for (const s of timeline.sections) {
    for (const l of s.lines) {
      for (const w of l.words) {
        for (const syl of w.syllables) items.push(syl.text);
      }
    }
  }
  if (!items.length) return false;
  onProgress?.('Synthesizing syllables…', 5);
  const bank = await fetchSyllables(items, provider, (done, total) => {
    onProgress?.(`Synthesizing syllables… ${done}/${total}`, 5 + Math.round((done / total) * 40));
  });
  const expectedSyllables = Array.from(new Set(items.map((item) => item.toLowerCase()))).length;
  if (bank.size === 0 || bank.size < expectedSyllables) return false;

  onProgress?.('Pitch-mapping vocals…', 50);
  for (const s of timeline.sections) {
    for (const l of s.lines) {
      for (const w of l.words) {
        for (const syl of w.syllables) {
          const frag = bank.get(syl.text.toLowerCase());
          if (!frag) continue;
          const dur = Math.max(0.09, syl.endSec - syl.startSec);
          const targetF0 = midiToFreq(syl.midi);
          // Shift detected F0 to the note; fall back to a gentle +7 semitones
          // when the fragment is unvoiced so consonant fragments stay audible.
          const ratio = frag.f0 > 0 ? targetF0 / frag.f0 : Math.pow(2, 7 / 12);
          const clamped = Math.max(0.4, Math.min(2.6, ratio));
          let data = pitchShift(frag.data, clamped, frag.rate);
          // Time-stretch to the exact note duration.
          const curDur = data.length / frag.rate;
          if (curDur > 0.03) {
            data = stretchTo(data, dur, frag.rate);
          }
          const out = normalize(data, 0.85);
          // Resample to context rate if needed.
          const buf = ctx.createBuffer(1, out.length, frag.rate);
          buf.copyToChannel(new Float32Array(out), 0);
          const src = ctx.createBufferSource();
          src.buffer = buf;
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.0001, syl.startSec);
          g.gain.exponentialRampToValueAtTime(0.9, syl.startSec + 0.02);
          g.gain.setValueAtTime(0.9, Math.max(syl.startSec + 0.03, syl.endSec - 0.03));
          g.gain.exponentialRampToValueAtTime(0.0001, syl.endSec + 0.02);
          src.connect(g).connect(dest);
          src.start(syl.startSec);
        }
      }
    }
  }
  onProgress?.('Vocals mapped to melody.', 60);
  return true;
}

function stretchTo(data: Float32Array, targetSec: number, rate: number): Float32Array {
  const targetLen = Math.max(64, Math.round(targetSec * rate));
  const curLen = data.length;
  if (Math.abs(curLen - targetLen) < rate * 0.015) return data;
  const r = targetLen / curLen;
  if (r >= 0.8 && r <= 1.25) {
    // small stretch: linear resample is fine (tiny pitch drift acceptable)
    const out = new Float32Array(targetLen);
    for (let i = 0; i < targetLen; i++) {
      const pos = i / r;
      const i0 = Math.min(curLen - 1, Math.floor(pos));
      const frac = pos - i0;
      const a = data[i0];
      const b = data[Math.min(curLen - 1, i0 + 1)];
      out[i] = a + (b - a) * frac;
    }
    return out;
  }
  // larger stretch: granular (pitch-preserving)
  const { timeStretchGranular } = granularHelpers(rate);
  return timeStretchGranular(data, r);
}

function granularHelpers(rate: number) {
  const L = Math.max(256, Math.round(rate * 0.05));
  const win = new Float32Array(L);
  for (let i = 0; i < L; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / L);
  return {
    timeStretchGranular(data: Float32Array, r: number): Float32Array {
      const hopOut = Math.floor(L / 2);
      const hopIn = Math.max(1, Math.floor(hopOut / r));
      const outLen = Math.max(L, Math.round(data.length * r));
      const out = new Float32Array(outLen + L);
      for (let k = 0; ; k++) {
        const inStart = k * hopIn;
        const outStart = k * hopOut;
        if (outStart >= outLen || inStart >= data.length) break;
        for (let i = 0; i < L; i++) {
          const src = Math.min(data.length - 1, inStart + i);
          if (outStart + i < out.length) out[outStart + i] += data[src] * win[i];
        }
      }
      return out.slice(0, outLen);
    },
  };
}
