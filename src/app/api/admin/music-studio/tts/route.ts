/**
 * /api/tts — built-in syllable TTS endpoint (espeak-ng, local binary).
 *
 * Used by the studio's TTS-Map singing mode. In production on Vercel this
 * binary is not available, so the client is configured with SBA_TTS_URL
 * pointing at your EXISTING voice-over engine instead — the studio reuses
 * it rather than duplicating it.
 *
 * POST { items: string[], voice?: string } -> { audio: Record<item, base64wav> }
 * GET -> { available: boolean, voice?: string }
 */
import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdtemp, readFile, rm } from 'fs/promises';
import { randomUUID } from 'crypto';

export const maxDuration = 60;

const VOICES: Record<string, string> = {
  bright: 'en-us+f3',
  warm: 'en-us+f2',
  choir: 'en+f4',
};

function sanitizeItem(item: string): string {
  return item.replace(/[^a-zA-Z' \-]/g, '').trim().slice(0, 24);
}

export async function GET() {
  const available = await probeEspeak();
  return NextResponse.json({ available, voices: Object.values(VOICES) });
}

async function probeEspeak(): Promise<boolean> {
  if ((globalThis as unknown as { __espeakProbed?: boolean }).__espeakProbed) {
    return !!(globalThis as unknown as { __espeakPath?: string | null }).__espeakPath;
  }
  (globalThis as unknown as { __espeakProbed?: boolean }).__espeakProbed = true;
  return new Promise((resolve) => {
    execFile('espeak-ng', ['--version'], { timeout: 4000 }, (err) => {
      const g = globalThis as unknown as { __espeakPath?: string | null };
      g.__espeakPath = err ? null : 'espeak-ng';
      resolve(!err);
    });
  });
}

export async function POST(req: NextRequest) {
  const available = await probeEspeak();
  if (!available) {
    return NextResponse.json(
      { error: 'espeak-ng is not installed on this host. Configure SBA_TTS_URL to your voice-over engine instead.', available: false },
      { status: 501 },
    );
  }
  let body: { items?: string[]; voice?: string; speed?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const items = (body.items ?? [])
    .map((i) => sanitizeItem(String(i)))
    .filter((i) => i.length > 0)
    .slice(0, 200);
  if (!items.length) return NextResponse.json({ error: 'No items' }, { status: 400 });

  const voice = VOICES[body.voice ?? 'bright'] ?? VOICES.bright;
  const speed = Math.max(110, Math.min(190, Number(body.speed) || 145));

  const dir = await mkdtemp(join(tmpdir(), 'sba-tts-'));
  const audio: Record<string, string> = {};
  try {
    for (const item of [...new Set(items)]) {
      const outFile = join(dir, `${randomUUID()}.wav`);
      await new Promise<void>((resolve) => {
        execFile(
          'espeak-ng',
          ['-v', voice, '-s', String(speed), '-p', '55', '-a', '170', '--punct="",', item, '-w', outFile],
          { timeout: 8000 },
          (err) => { void err; resolve(); },
        );
      });
      try {
        const wav = await readFile(outFile);
        audio[item.toLowerCase()] = wav.toString('base64');
      } catch {
        // skip fragment that failed
      }
    }
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
  return NextResponse.json({ audio, available: true });
}
