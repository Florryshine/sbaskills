import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/require-admin-api';
import { synthesizeLine, estimateDurationSeconds } from '@/lib/podcastTTS';
import { getKnowledgeAsset, getOrCreateNarration } from '@/lib/ka-package/video-adapters';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;
  try {
    const body = await request.json();
    if (!Array.isArray(body.scenes) || body.scenes.length < 1 || body.scenes.length > 12) {
      return NextResponse.json({ error: 'Provide between 1 and 12 scenes.' }, { status: 400 });
    }
    const scenes = body.scenes.map((scene, index) => {
      const text = String(scene?.text || '').trim().split(/\s+/).slice(0, 18).join(' ').slice(0, 240);
      if (!text) throw new Error('Scene ' + (index + 1) + ' has no narration text.');
      return text;
    });
    const asset = body.knowledgeAssetId ? await getKnowledgeAsset(body.knowledgeAssetId) : null;
    const audio = await Promise.all(scenes.map(async (text) => {
      if (asset) {
        const cached = await getOrCreateNarration(asset, text, {
          voice: body.voice || 'host_a',
          emotion: body.emotion || 'neutral',
        });
        return {
          audioSrc: cached.audioSrc,
          durationSeconds: Math.min(8, Math.max(5, estimateDurationSeconds(text) + 1)),
          reused: cached.reused,
        };
      }
      const buffer = await synthesizeLine(text, 'host_a', 'neutral');
      return {
        audioSrc: 'data:audio/mpeg;base64,' + buffer.toString('base64'),
        durationSeconds: Math.min(8, Math.max(5, estimateDurationSeconds(text) + 1)),
        reused: false,
      };
    }));
    return NextResponse.json({ success: true, audio, narrationCached: Boolean(asset) });
  } catch (error) {
    console.error('Video Studio narration failed:', error);
    return NextResponse.json({ error: error.message || 'Could not generate narration.' }, { status: 500 });
  }
}