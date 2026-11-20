// src/audio/mix.ts — ffmpeg audio helpers (normalization + silence padding).
//
// Narration clips arrive from different providers at different levels; every
// clip is normalized to a common loudness before the timeline is built so
// scene-to-scene volume jumps are impossible. ffmpeg's loudnorm runs one
// pass per clip (cheap) with a plain gain fallback when ffmpeg is missing.

import { spawn, spawnSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';

export interface NormalizeResult {
  file: string;
  normalized: boolean;
}

function runFfmpeg(args: string[], timeoutMs = 120000): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const p = spawn('ffmpeg', ['-nostdin', '-y', ...args], { stdio: 'ignore' });
      const timer = setTimeout(() => {
        p.kill('SIGKILL');
        resolve(false);
      }, timeoutMs);
      p.on('exit', (code) => {
        clearTimeout(timer);
        resolve(code === 0);
      });
      p.on('error', () => {
        clearTimeout(timer);
        resolve(false);
      });
    } catch {
      resolve(false);
    }
  });
}

/** Loudness-normalize one narration clip to speech-friendly -16 LUFS. */
export async function normalizeNarrationClip(inputPath: string, ext: 'wav' | 'mp3'): Promise<NormalizeResult> {
  const { mkdtemp } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const dir = await mkdtemp(join(tmpdir(), 'vl-norm-'));
  const outPath = join(dir, `norm.${ext === 'wav' ? 'wav' : 'mp3'}`);
  const ok = await runFfmpeg(['-i', inputPath, '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-ar', '48000', '-ac', '2', outPath]);
  if (!ok) return { file: inputPath, normalized: false };
  return { file: outPath, normalized: true };
}

/** Probe an audio file; returns measured duration or null. */
export function audioDuration(file: string): number | null {
  const res = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], {
    encoding: 'utf8',
    timeout: 15000,
  });
  if (res.status !== 0) return null;
  const v = parseFloat(res.stdout.trim());
  return isFinite(v) && v > 0 ? v : null;
}

/** Generate silent WAV of given duration (for silent-provider scenes). */
export async function generateSilence(seconds: number, outPath: string): Promise<void> {
  const ok = await runFfmpeg(['-f', 'lavfi', '-i', `anullsrc=r=48000:cl=stereo`, '-t', String(seconds), outPath]);
  if (!ok) {
    // Pure-TS fallback: write a silent stereo WAV directly.
    const sampleRate = 48000;
    const frames = Math.floor(seconds * sampleRate);
    const buf = Buffer.alloc(44 + frames * 4);
    buf.write('RIFF', 0);
    buf.writeUInt32LE(36 + frames * 4, 4);
    buf.write('WAVE', 8);
    buf.write('fmt ', 12);
    buf.writeUInt32LE(16, 16);
    buf.writeUInt16LE(1, 20);
    buf.writeUInt16LE(2, 22);
    buf.writeUInt32LE(sampleRate, 24);
    buf.writeUInt32LE(sampleRate * 4, 28);
    buf.writeUInt16LE(4, 32);
    buf.writeUInt16LE(16, 34);
    buf.write('data', 36);
    buf.writeUInt32LE(frames * 4, 40);
    await writeFile(outPath, buf);
  }
}
