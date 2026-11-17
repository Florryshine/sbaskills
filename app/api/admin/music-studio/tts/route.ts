import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/require-admin-api';

export const maxDuration = 60;

function configuredBatchEndpoint() {
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

async function synthesizeWithEdge(item: string): Promise<string> {
  const endpoint = (process.env.TTS_ENDPOINT || 'https://openai-edge-tts-aqq1.onrender.com').replace(/\\/+$/, '');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(`${endpoint}/v1/audio/speech`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'tts-1',
        input: item,
        voice: 'en-NG-EzinneNeural',
        speed: 1,
        response_format: 'wav',
      }),
      signal: controller.signal,
      cache: 'no-store',
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`SBA Edge TTS returned HTTP ${response.status}: ${detail.slice(0, 180)}`);
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length < 512 || bytes.toString('ascii', 0, 4) !== 'RIFF') {
      throw new Error('SBA Edge TTS did not return a valid WAV audio file.');
    }
    return bytes.toString('base64');
  } finally {
    clearTimeout(timeout);
  }
}

async function synthesizeWithGemini(item: string, apiKeys: string[], voiceName: string): Promise<string> {
  const model = process.env.GEMINI_TTS_MODEL || 'gemini-3.8-flash-tts';
  let lastError = 'Gemini TTS returned no audio.';
  for (const apiKey of apiKeys) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          model,
          input: [{
            type: 'user_input',
            content: [{
              type: 'text',
              text: `Pronounce only this English syllable clearly and naturally: ${item}. No introduction or extra words.`,
              annotations: [{
                type: 'speech_metadata',
                style: 'Clear, warm, upbeat Nigerian English pronunciation. Say only the supplied syllable, with a steady sustained vowel.',
              }],
            }],
          }],
          response_format: {
            type: 'audio',
            mime_type: 'audio/wav',
            sample_rate: 24000,
          },
          generation_config: {
            speech_config: [{ voice: voiceName }],
          },
        }),
        signal: controller.signal,
        cache: 'no-store',
      });

      const payload = await response.json().catch(() => null) as {
        error?: { message?: string };
        output_audio?: { data?: string; mime_type?: string };
      } | null;

      if (!response.ok) {
        lastError = payload?.error?.message || `Gemini TTS returned HTTP ${response.status}`;
        if ([401, 403, 429].includes(response.status) || /quota|rate.?limit/i.test(lastError)) continue;
        throw new Error(lastError);
      }

      const audioData = payload?.output_audio?.data;
      if (!audioData) throw new Error('Gemini TTS returned no audio data.');

      const bytes = Buffer.from(audioData, 'base64');
      // audio/wav is requested; wrap raw 24 kHz mono PCM if the provider omits its WAV header.
      if (bytes.length >= 44 && bytes.toString('ascii', 0, 4) === 'RIFF') {
        return bytes.toString('base64');
      }
      return pcm16ToWavBase64(bytes, 24000);
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Gemini TTS failed.';
      if (!/429|quota|rate.?limit/i.test(lastError)) throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error(lastError);
}

export async function GET() {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;
  const endpoint = configuredBatchEndpoint();
  const edgeAvailable = Boolean(process.env.TTS_ENDPOINT || 'https://openai-edge-tts-aqq1.onrender.com');
  const geminiAvailable = Boolean(process.env.GEMINI_API_KEY_1 || process.env.GEMINI_API_KEY_2 || process.env.GEMINI_API_KEY_3 || process.env.GEMINI_API_KEY);
  return NextResponse.json({
    available: Boolean(endpoint || edgeAvailable || geminiAvailable),
    provider: endpoint ? 'sba-voice-engine' : edgeAvailable ? 'edge-tts' : geminiAvailable ? 'gemini-tts' : 'unavailable',
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

  const endpoint = configuredBatchEndpoint();
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

  const apiKeys = Array.from(new Set([
    process.env.GEMINI_API_KEY_1,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
    process.env.GEMINI_API_KEY,
  ].filter((value): value is string => Boolean(value && value.trim()))));
  const edgeEndpoint = process.env.TTS_ENDPOINT || 'https://openai-edge-tts-aqq1.onrender.com';
  if (!apiKeys.length && !edgeEndpoint) {
    return NextResponse.json({
      available: false,
      error: 'No voice engine is configured. Add TTS_ENDPOINT, GEMINI_API_KEY_1, or GEMINI_API_KEY_2.',
    }, { status: 503 });
  }

  const requestedVoice = typeof body.voice === 'string' ? body.voice : 'Kore';
  const allowedVoices = ['Kore', 'Puck', 'Charon', 'Fenrir', 'Leda', 'Aoede', 'Zephyr', 'Orus'];
  const voiceName = allowedVoices.includes(requestedVoice) ? requestedVoice : 'Kore';
  const audio: Record<string, string> = {};
  const errors: string[] = [];
  let edgeCount = 0;
  let geminiCount = 0;
  let next = 0;

  // Prefer the existing Nigerian Edge TTS service (no additional Gemini
  // calls); fall back to Gemini 3.8 Flash TTS if the Edge service is down.
  const workers = Array.from({ length: Math.min(4, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      const item = items[index];
      try {
        audio[item] = await synthesizeWithEdge(item);
        edgeCount++;
      } catch (edgeError) {
        if (!apiKeys.length) {
          errors.push(edgeError instanceof Error ? edgeError.message : 'SBA Edge TTS failed.');
          continue;
        }
        try {
          audio[item] = await synthesizeWithGemini(item, apiKeys, voiceName);
          geminiCount++;
        } catch (geminiError) {
          errors.push(geminiError instanceof Error ? geminiError.message : 'Gemini TTS failed.');
        }
      }
    }
  });

  await Promise.all(workers);
  if (Object.keys(audio).length === 0) {
    return NextResponse.json({
      available: false,
      error: errors[0] || 'No configured voice engine returned usable audio.',
    }, { status: 502 });
  }

  return NextResponse.json({
    audio,
    available: true,
    provider: edgeCount && geminiCount ? 'edge-tts+gemini-tts' : edgeCount ? 'edge-tts' : 'gemini-tts',
    missing: errors.length,
  });
}
