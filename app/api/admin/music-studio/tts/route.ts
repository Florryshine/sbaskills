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

export async function GET() {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;
  return NextResponse.json({ available: Boolean(configuredEndpoint()), provider: 'sba-voice-engine' });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  const endpoint = configuredEndpoint();
  if (!endpoint) {
    return NextResponse.json({
      available: false,
      error: 'The existing SBA voice engine is not configured. Set SBA_TTS_URL in the Vercel environment.',
    }, { status: 503 });
  }

  let body: { items?: unknown; voice?: unknown; speed?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!Array.isArray(body.items)) {
    return NextResponse.json({ error: 'items must be an array of text fragments' }, { status: 400 });
  }
  const items = body.items
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 240))
    .filter(Boolean)
    .slice(0, 200);
  if (!items.length) return NextResponse.json({ error: 'No valid items supplied' }, { status: 400 });

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
    return NextResponse.json({ audio: payload.audio, available: true });
  } catch {
    return NextResponse.json({ error: 'The SBA voice engine could not be reached', available: false }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}
