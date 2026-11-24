// src/narration/providers.ts — Gemini-first narration chain with measured word timings.
//
// Order (first available wins; Gemini uses the configured SBA API key):
//   gemini  — shared Gemini TTS implementation (primary narrator).
//   edge    — edge-tts-universal (free Microsoft Edge voices). Real
//             word-boundary timestamps. Works from residential IPs; cloud
//             IPs are usually blocked (as whiteboard-engine documents).
//   proxy   — the platform's public edge-tts proxy (TTS_ENDPOINT, OpenAI-
//             compatible /v1/audio/speech). Cloud-safe, no timestamps →
//             proportional alignment from measured duration.
//   zai     — sandbox/dev TTS via the z-ai CLI (in-house tool).
//   silent  — optional timed silence for explicit previews/tests only.
//
// All clips are stored as mp3 (edge/proxy) or wav (zai/silent) and measured
// with ffprobe so the timeline is always built from real durations.

import type { NarrationProviderName, WordTiming } from '../types';
import { synthesizeGeminiLine, getAudioExtension } from '../../../lib/podcastTTS.js';
import { proportionalWords } from './align';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const VOICE_PRESETS: Record<string, { label: string; edge: string; proxy: string; zai?: string }> = {
  warm_male: { label: 'Warm male narrator', edge: 'en-US-ChristopherNeural', proxy: 'onyx' },
  bright_female: { label: 'Bright female narrator', edge: 'en-US-JennyNeural', proxy: 'shimmer' },
  calm_male: { label: 'Calm documentary male', edge: 'en-US-GuyNeural', proxy: 'echo' },
  friendly_female: { label: 'Friendly female (NG)', edge: 'en-NG-EzinneNeural', proxy: 'nova' },
  nigerian_male: { label: 'Nigerian male (NG)', edge: 'en-NG-AbeoNeural', proxy: 'onyx' },
  uk_male: { label: 'British male', edge: 'en-GB-RyanNeural', proxy: 'onyx' },
};

const F = (n: number) => Math.round(n * 1000) / 1000;

export function probeDurationSeconds(file: string): number | null {
  const res = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], {
    encoding: 'utf8',
    timeout: 20000,
  });
  if (res.error || res.status !== 0) {\n    console.warn(`[visual-learning] ffprobe failed for ${file}:`, res.error?.message || res.stderr?.trim() || `exit ${res.status}`);\n    return null;\n  }
  const v = parseFloat(res.stdout.trim());
  return isFinite(v) && v > 0 ? v : null;
}

async function writeFileTemp(buffer: Buffer, ext: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'vl-narr-'));
  const path = join(dir, `clip.${ext}`);
  await writeFile(path, buffer);
  return path;
}

export interface NarrationResult {
  file: string;
  ext: 'wav' | 'mp3';
  duration: number;
  words: WordTiming[];
  provider: NarrationProviderName;
  voice: string;
}

export interface NarrationRequest {
  text: string;
  preset: string;
  /** edge-tts rate, e.g. "+0%" or "-5%" */
  rate?: string;
  preferred?: NarrationProviderName;
}

function splitSentences(text: string): string[] {
  const parts = text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : [text.trim()];
}

/** Gemini TTS — primary provider, using the shared SBA Gemini speech implementation. */
async function synthesizeGemini(req: NarrationRequest): Promise<NarrationResult | null> {
  try {
    const malePresets = new Set(['warm_male', 'calm_male', 'nigerian_male', 'uk_male']);
    const speaker = malePresets.has(req.preset) ? 'host_b' : 'host_a';
    const audio = await synthesizeGeminiLine(req.text, speaker, 'neutral');
    const ext = getAudioExtension(audio) as 'wav' | 'mp3';
    const file = await writeFileTemp(Buffer.from(audio), ext);
    const duration = probeDurationSeconds(file);
    if (!duration || duration <= 0 || audio.length < 512) return null;
    const voice = speaker === 'host_b' ? 'Charon' : 'Kore';
    return { file, ext, duration, words: proportionalWords(req.text, duration), provider: 'gemini', voice };
  } catch (error) {
    console.warn('[visual-learning] Gemini TTS failed; trying fallback provider:', error instanceof Error ? error.message : String(error));
    return null;
  }
}

/** Edge provider — real word boundaries. */
async function synthesizeEdge(req: NarrationRequest): Promise<NarrationResult | null> {
  const preset = VOICE_PRESETS[req.preset] ?? VOICE_PRESETS.warm_male;
  const { EdgeTTS } = await import('edge-tts-universal');
  try {
    const tts = new EdgeTTS(req.text, preset.edge, { rate: req.rate || '+0%', volume: '+0%', pitch: '+0Hz' });
    const result = await Promise.race([
      tts.synthesize(),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error('edge-tts timeout')), 45000)),
    ]);
    const audio = Buffer.from(await (result as { audio: Blob }).audio.arrayBuffer());
    if (audio.length < 500) return null;
    const subtitle = (result as { subtitle?: { offset: number; duration: number; text?: string; Word?: string }[] }).subtitle || [];
    const TICKS = 10_000_000;
    const words: WordTiming[] = subtitle
      .map((entry) => ({
        word: (entry.text ?? entry.Word ?? '').trim(),
        start: F(entry.offset / TICKS),
        end: F((entry.offset + entry.duration) / TICKS),
      }))
      .filter((w) => w.word.length > 0);
    const file = await writeFileTemp(audio, 'mp3');
    let duration = words.length > 0 ? words[words.length - 1].end : 0;
    if (!duration || duration <= 0) duration = probeDurationSeconds(file) ?? 0;
    if (duration <= 0) return null;
    return {
      file,
      ext: 'mp3',
      duration,
      words: words.length > 0 ? words : proportionalWords(req.text, duration),
      provider: 'edge',
      voice: preset.edge,
    };
  } catch {
    return null; // blocked (datacenter IP) or transient failure → next provider
  }
}

/** Proxy provider — the free public edge-tts proxy, OpenAI-compatible. */
async function synthesizeProxy(req: NarrationRequest, endpoint: string): Promise<NarrationResult | null> {
  const preset = VOICE_PRESETS[req.preset] ?? VOICE_PRESETS.warm_male;
  const r = await Promise.race([
    fetch(`${endpoint.replace(/\/$/, '')}/v1/audio/speech`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'tts-1', voice: preset.proxy, input: req.text, response_format: 'mp3' }),
    }),
    new Promise<never>((_, rej) => setTimeout(() => rej(new Error('proxy timeout')), 120000)),
  ]).catch(() => null);
  if (!r || !(r as Response).ok) return null;
  const buf = Buffer.from(await (r as Response).arrayBuffer());
  if (buf.length < 500) return null;
  const file = await writeFileTemp(buf, 'mp3');
  const duration = probeDurationSeconds(file);
  if (!duration) return null;
  return {
    file,
    ext: 'mp3',
    duration,
    words: proportionalWords(req.text, duration),
    provider: 'proxy',
    voice: preset.proxy,
  };
}

/** z-ai sandbox provider (dev environments with the z-ai CLI). */
async function synthesizeZai(req: NarrationRequest): Promise<NarrationResult | null> {
  const outPath = join(tmpdir(), `vl-zai-${Date.now()}-${Math.random().toString(36).slice(2)}.wav`);
  const res = spawnSync('z-ai', ['tts', '-i', req.text.slice(0, 1000), '-o', outPath, '--format', 'wav'], {
    encoding: 'utf8',
    timeout: 180000,
  });
  try {
    const duration = probeDurationSeconds(outPath);
    if (res.status !== 0 || !duration) return null;
    const audio = await readFile(outPath);
    const file = await writeFileTemp(audio, 'wav');
    return { file, ext: 'wav', duration, words: proportionalWords(req.text, duration), provider: 'zai', voice: 'zai-default' };
  } catch {
    return null;
  }
}

/** Silent provider — timed silence so a mute video still renders. */
async function synthesizeSilent(req: NarrationRequest): Promise<NarrationResult> {
  const words = req.text.trim().split(/\s+/).filter(Boolean).length;
  const duration = Math.max(2.5, (words / 150) * 60);
  const file = await writeFileTemp(Buffer.alloc(0), 'txt');
  // write a marker file; the timeline builder pads with silence via generated silence
  await writeFile(file.replace(/\.txt$/, '.json'), JSON.stringify({ silent: true, duration }));
  return {
    file: file.replace(/\.txt$/, '.json'),
    ext: 'wav',
    duration,
    words: proportionalWords(req.text, duration),
    provider: 'silent',
    voice: 'none',
  };
}

/**
 * Synthesize one narration clip trying providers in order. `preferred` is
 * tried first, then the standard chain. Returns null only if every provider
 * failed and silent mode is disabled.
 */
export async function synthesizeNarration(req: NarrationRequest, opts: { proxyEndpoint?: string; allowSilent?: boolean } = {}): Promise<NarrationResult | null> {
  const proxyEndpoint = opts.proxyEndpoint || process.env.TTS_ENDPOINT || 'https://openai-edge-tts-aqq1.onrender.com';
  // Gemini is always first. A requested provider is treated as an additional
  // fallback, never as a way to bypass the primary Gemini voice.
  const chain: NarrationProviderName[] = ['gemini'];
  chain.push('edge', 'proxy', 'zai');
  if (req.preferred && req.preferred !== 'gemini' && req.preferred !== 'silent') chain.push(req.preferred);
  if (opts.allowSilent === true) chain.push('silent');

  for (const provider of [...new Set(chain)]) {
    if (provider === 'gemini') {\n      const r = await synthesizeGemini(req);\n      if (r) return r;\n    } else if (provider === 'edge') {
      const r = await synthesizeEdge(req);
      if (r) return r;
    } else if (provider === 'proxy') {
      const r = await synthesizeProxy(req, proxyEndpoint);
      if (r) return r;
    } else if (provider === 'zai') {
      const r = await synthesizeZai(req);
      if (r) return r;
    } else if (provider === 'silent') {
      return synthesizeSilent(req);
    }
  }
  return null;
}

/**
 * Long narration (one clip per scene, no chunking needed below ~1200 chars
 * which the validator enforces).
 */
export async function synthesizeSceneNarration(req: NarrationRequest, opts: { proxyEndpoint?: string; allowSilent?: boolean } = {}): Promise<NarrationResult | null> {
  if (req.text.length <= 1100) return synthesizeNarration(req, opts);
  const sentences = splitSentences(req.text);
  const chunkResults: NarrationResult[] = [];
  let buffer = '';
  for (const sentence of sentences) {
    if ((buffer + ' ' + sentence).length > 1000 && buffer) {
      chunkResults.push((await synthesizeNarration({ ...req, text: buffer }, opts))!);
      buffer = sentence;
    } else {
      buffer = buffer ? `${buffer} ${sentence}` : sentence;
    }
  }
  if (buffer.trim()) chunkResults.push((await synthesizeNarration({ ...req, text: buffer }, opts))!);
  if (chunkResults.some((r) => r === null)) return null;
  if (chunkResults.length === 1) return chunkResults[0];
  // Concatenate with ffmpeg into one file, shifting word timings.
  const dir = await mkdtemp(join(tmpdir(), 'vl-concat-'));
  const listFile = join(dir, 'list.txt');
  const files = chunkResults.map((r) => r.file);
  await writeFile(listFile, files.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join('\n'));
  const outPath = join(dir, 'joined.mp3');
  await new Promise<void>((resolve, reject) => {
    const p = spawn('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', outPath], { stdio: 'ignore' });
    p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error('ffmpeg concat failed'))));
    p.on('error', reject);
  });
  const duration = probeDurationSeconds(outPath) ?? chunkResults.reduce((a, r) => a + r.duration, 0);
  const words: WordTiming[] = [];
  let offset = 0;
  for (const r of chunkResults) {
    for (const w of r.words) words.push({ word: w.word, start: F(w.start + offset), end: F(w.end + offset) });
    offset += r.duration;
  }
  return {
    file: outPath,
    ext: chunkResults[0].ext,
    duration,
    words,
    provider: chunkResults[0].provider,
    voice: chunkResults[0].voice,
  };
}
