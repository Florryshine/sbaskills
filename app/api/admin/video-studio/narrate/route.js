import { NextResponse } from 'next/server';
import { synthesizeLine, estimateDurationSeconds } from '@/lib/podcastTTS';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request) {
  try {
    const body = await request.json();
    if (!Array.isArray(body.scenes) || body.scenes.length < 1 || body.scenes.length > 12) {
      return NextResponse.json({ error: 'Provide between 1 and 12 scenes.' }, { status: 400 });
    }
    const scenes = body.scenes.map((scene, index) => {
      const text = String(scene?.text || '').trim().slice(0, 700);
      if (!text) throw new Error('Scene ' + (index + 1) + ' has no narration text.');
      return text;
    });
    const audio = await Promise.all(scenes.map(async (text) => {
      const buffer = await synthesizeLine(text, 'host_a', 'neutral');
      return {
        audioSrc: 'data:audio/mpeg;base64,' + buffer.toString('base64'),
        durationSeconds: Math.max(3, estimateDurationSeconds(text) + 1)
      };
    }));
    return NextResponse.json({ success: true, audio });
  } catch (error) {
    console.error('Video Studio narration failed:', error);
    return NextResponse.json({ error: error.message || 'Could not generate narration.' }, { status: 500 });
  }
}