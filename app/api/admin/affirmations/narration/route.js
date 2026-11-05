import { NextResponse } from 'next/server';
import { synthesizeLine } from '@/lib/podcastTTS';

export const maxDuration = 45;

export async function POST(request) {
  try {
    const body = await request.json();
    const text = String(body.text || '').trim().slice(0, 5000);
    if (!text) return NextResponse.json({ error: 'Narration text is required.' }, { status: 400 });
    const speaker = body.voice === 'host_b' ? 'host_b' : 'host_a';
    const emotion = ['neutral', 'serious', 'calm'].includes(body.emotion) ? body.emotion : 'calm';
    const speed = Math.max(0.6, Math.min(1, Number(body.speed) || 0.8));
    const audio = await synthesizeLine(text, speaker, emotion, speed);
    return NextResponse.json({ audioBase64: audio.toString('base64'), mimeType: 'audio/mpeg' });
  } catch (error) {
    console.error('Affirmation narration failed:', error);
    return NextResponse.json({ error: error.message || 'Narration generation failed.' }, { status: 502 });
  }
}