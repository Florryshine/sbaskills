// src/narration/index.ts — narration provider abstraction.
//
// The engine renders visuals from word timings; providers differ only in how
// they produce (audio, duration, word timestamps):
//
//  edge — edge-tts-universal with REAL word-boundary timestamps (100ns ticks).
//         Works from home/laptop connections; cloud IPs are usually blocked.
//  zai  — sandbox/demo provider (z-ai CLI), proportional word alignment.
//  wav  — pre-recorded audio files (user supplies WAV/MP3 + optional .json
//         word timings), measured via ffprobe.

import type { WordTiming } from '../types';
import { proportionalWords } from './align';

export interface NarrationResult {
  audio: Buffer;
  ext: 'wav' | 'mp3';
  /** Measured (not estimated) audio duration in seconds. */
  duration: number;
  words: WordTiming[];
}

export interface NarrationProvider {
  name: string;
  synthesize(text: string, voice: string): Promise<NarrationResult>;
}

// ---------------------------------------------------------------------------
// ffprobe duration measurement
// ---------------------------------------------------------------------------

import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export function probeDurationSeconds(file: string): number | null {
  const res = spawnSync(
    'ffprobe',
    ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file],
    { encoding: 'utf8', timeout: 20000 },
  );
  if (res.status !== 0) return null;
  const v = parseFloat(res.stdout.trim());
  return isFinite(v) && v > 0 ? v : null;
}

async function writeFileTemp(buffer: Buffer, ext: string): Promise<string> {
  const path = join(tmpdir(), `sba-narr-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`);
  await Bun.write(path, buffer);
  return path;
}

// ---------------------------------------------------------------------------
// Edge TTS provider (production — real word boundaries)
// ---------------------------------------------------------------------------

export class EdgeTTSProvider implements NarrationProvider {
  name = 'edge';

  async synthesize(text: string, voice: string): Promise<NarrationResult> {
    const { EdgeTTS } = await import('edge-tts-universal');
    const tts = new EdgeTTS(text, voice || 'en-NG-EzinneNeural', {
      rate: '+0%',
      volume: '+0%',
      pitch: '+0Hz',
    });
    const result = await tts.synthesize();
    const audio = Buffer.from(await result.audio.arrayBuffer());
    const subtitle = result.subtitle || [];
    const TICKS = 10_000_000;

    const words: WordTiming[] = subtitle
      .map((entry: { offset: number; duration: number; text?: string; Word?: string }) => ({
        word: (entry.text ?? entry.Word ?? '').trim(),
        start: Math.round((entry.offset / TICKS) * 1000) / 1000,
        end: Math.round(((entry.offset + entry.duration) / TICKS) * 1000) / 1000,
      }))
      .filter((w: WordTiming) => w.word.length > 0);

    let duration = words.length > 0 ? words[words.length - 1].end : 0;
    if (!duration || duration <= 0) {
      const file = await writeFileTemp(audio, 'mp3');
      duration = probeDurationSeconds(file) ?? proportionalWords(text, 60).at(-1)?.end ?? 5;
    }
    if (words.length === 0) {
      return { audio, ext: 'mp3', duration, words: proportionalWords(text, duration) };
    }
    return { audio, ext: 'mp3', duration, words };
  }
}

// ---------------------------------------------------------------------------
// z-ai provider (sandbox demos) — proportional alignment from measured WAV
// ---------------------------------------------------------------------------

export class ZaiTTSProvider implements NarrationProvider {
  name = 'zai';

  async synthesize(text: string, voice: string): Promise<NarrationResult> {
    const v = voice || 'jam';
    const outPath = join(tmpdir(), `sba-zai-${Date.now()}-${Math.random().toString(36).slice(2)}.wav`);
    const trimmed = text.length > 1000 ? text.slice(0, 1000) : text;

    // The sandbox TTS endpoint rate-limits bursts; retry with backoff.
    let lastError = '';
    for (let attempt = 0; attempt < 5; attempt++) {
      if (attempt > 0) {
        const delay = attempt * 20000; // 20s, 40s, 60s, 80s
        console.log(`  [tts] retry ${attempt}/4 after ${delay / 1000}s (${lastError})`);
        await new Promise((r) => setTimeout(r, delay));
      }
      const res = spawnSync('z-ai', ['tts', '-i', trimmed, '-o', outPath, '--voice', v, '--format', 'wav'], {
        encoding: 'utf8',
        timeout: 120000,
      });
      const exists = await Bun.file(outPath).exists();
      if (res.status === 0 && exists && (await Bun.file(outPath)).size > 1000) {
        const duration = probeDurationSeconds(outPath) ?? 5;
        return {
          audio: Buffer.from(await Bun.file(outPath).arrayBuffer()),
          ext: 'wav',
          duration,
          words: proportionalWords(trimmed, duration),
        };
      }
      lastError = (res.stderr || res.stdout || 'no audio produced').trim().slice(-160);
    }
    throw new Error(`z-ai tts failed after retries: ${lastError}`);
  }
}

// ---------------------------------------------------------------------------
// Pre-recorded WAV provider
// ---------------------------------------------------------------------------

export class PreRecordedProvider implements NarrationProvider {
  name = 'wav';
  constructor(private dir: string) {}

  async synthesize(text: string, _voice: string): Promise<NarrationResult> {
    const { readdir } = await import('node:fs/promises');
    const files = await readdir(this.dir);
    // Consume files in name order: 01.wav, 02.wav, ...
    if (!this.queue) {
      this.queue = files
        .filter((f) => /\.(wav|mp3)$/i.test(f))
        .sort()
        .map((f) => join(this.dir, f));
    }
    const file = this.queue.shift();
    if (!file) throw new Error('PreRecordedProvider: no more audio files available');
    const audio = Buffer.from(await Bun.file(file).arrayBuffer());
    const ext = file.toLowerCase().endsWith('.mp3') ? 'mp3' : 'wav';
    const duration = probeDurationSeconds(file) ?? 5;

    // Optional sidecar word timings: <name>.words.json
    const sidecar = file.replace(/\.(wav|mp3)$/i, '.words.json');
    let words: WordTiming[] | null = null;
    try {
      const sidecarFile = Bun.file(sidecar);
      if (await sidecarFile.exists()) {
        const parsed = JSON.parse(await sidecarFile.text()) as WordTiming[];
        if (Array.isArray(parsed) && parsed.length > 0) words = parsed;
      }
    } catch {
      // ignore malformed sidecars
    }
    return { audio, ext, duration, words: words ?? proportionalWords(text, duration) };
  }

  private queue?: string[];
}

export function getProvider(name: string): NarrationProvider {
  switch (name) {
    case 'edge':
      return new EdgeTTSProvider();
    case 'zai':
      return new ZaiTTSProvider();
    case 'wav':
      throw new Error('wav provider must be constructed with a directory (use new PreRecordedProvider(dir))');
    default:
      throw new Error(`Unknown narration provider "${name}" (use edge | zai | wav)`);
  }
}

export { proportionalWords };
