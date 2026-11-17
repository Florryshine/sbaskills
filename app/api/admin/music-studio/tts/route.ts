import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/require-admin-api';

export const maxDuration = 60;

function configuredEndpoint() {
  const value = process.env.SBA_TTS_URL;
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && process.env.NODE_ENV === 'production') return null;
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    return url.toString();
  } catch {
    return null;
  }
}

function pcm16ToWavBase64(pcm: Buffer, sampleRate = 24000): string {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]).toString('base64');
}

async function synthesizeWithGemini(item: string, apiKey: string, voiceName: string): Promise<string> {
  const model = process.env.GEMINI_TTS_MODEL || 'gemini-3.8-flash-tts';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Pronounce only this English syllable clearly and naturally: ${item}. No introduction or extra words.`,
            }],
          }],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName },
              },
            },
          },
        }),
        signal: controller.signal,
        cache: 'no-store',
      },
    );

    const payload = await response.json().catch(() => null) as {
      error?: { message?: string };
      candidates?: Array<{
        content?: {
          parts?: Array<{
            inlineData?: { data?: string; mimeType?: string };
          }>;
        };
      }>;
    } | null;

    if (!response.ok) {
      throw new Error(payload?.error?.message || `Gemini TTS returned HTTP ${response.status}`);
    }

    const audioPart = payload?.candidates?.[0]?.content?.parts?.find((part) => part.inlineData?.data)?.inlineData;
    if (!audioPart?.data) throw new Error('Gemini TTS returned no audio data.');

    const bytes = Buffer.from(audioPart.data, 'base64');
    // Gemini TTS may return a WAV container or raw 24 kHz, mono, 16-bit PCM.
    if (bytes.length >= 44 && bytes.toString('ascii', 0, 4) === 'RIFF') {
      return bytes.toString('base64');
    }
    return pcm16ToWavBase64(bytes, 24000);
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET() {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;
  const endpoint = configuredEndpoint();
  const geminiAvailable = Boolean(process.env.GEMINI_API_KEY);
  return NextResponse.json({
    available: Boolean(endpoint || geminiAvailable),
    provider: endpoint ? 'sba-voice-engine' : geminiAvailable ? 'gemini-tts' : 'unavailable',
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  let body: { items?: unknown; voice?: unknown; speed?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!Array.isArray(body.items)) {
    return NextResponse.json({ error: 'items must be an array of text fragments' }, { status: 400 });
  }
  const items = Array.from(new Set(
    body.items
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 80).toLowerCase())
      .filter(Boolean)
  )).slice(0, 48);
  if (!items.length) return NextResponse.json({ error: 'No valid syllables supplied' }, { status: 400 });

  const endpoint = configuredEndpoint();
  if (endpoint) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 50000);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, voice: body.voice, speed: body.speed }),
        signal: controller.signal,
        cache: 'no-store',
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        return NextResponse.json({ error: 'The SBA voice engine request failed', available: false }, { status: 502 });
      }
      if (!payload || typeof payload.audio !== 'object' || Array.isArray(payload.audio)) {
        return NextResponse.json({ error: 'The SBA voice engine returned an invalid audio response' }, { status: 502 });
      }
      return NextResponse.json({ audio: payload.audio, available: true, provider: 'sba-voice-engine' });
    } catch {
      return NextResponse.json({ error: 'The SBA voice engine could not be reached', available: false }, { status: 502 });
    } finally {
      clearTimeout(timeout);
    }
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      available: false,
      error: 'No voice engine is configured. Add GEMINI_API_KEY or SBA_TTS_URL in the Vercel environment.',
    }, { status: 503 });
  }

  const requestedVoice = typeof body.voice === 'string' ? body.voice : 'Kore';
  const allowedVoices = ['Kore', 'Puck', 'Charon', 'Fenrir', 'Leda', 'Aoede', 'Zephyr', 'Orus'];
  const voiceName = allowedVoices.includes(requestedVoice) ? requestedVoice : 'Kore';
  const audio: Record<string, string> = {};
  const errors: string[] = [];
  let next = 0;

  // Small bounded concurrency avoids burst rate-limit errors and keeps the
  // serverless request within its 60-second execution budget.
  const workers = Array.from({ length: Math.min(4, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      const item = items[index];
      try {
        audio[item] = await synthesizeWithGemini(item, apiKey, voiceName);
      } catch (error) {
        errors.push(error instanceof Error ? error.message : 'Gemini TTS failed.');
      }
    }
  });

  await Promise.all(workers);
  if (Object.keys(audio).length === 0) {
    return NextResponse.json({
      available: false,
      error: errors[0] || 'Gemini TTS did not return usable audio.',
    }, { status: 502 });
  }

  return NextResponse.json({
    audio,
    available: true,
    provider: 'gemini-tts',
    missing: errors.length,
  });
}
