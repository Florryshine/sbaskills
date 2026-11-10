import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/require-admin-api';
import { synthesizeLine } from '@/lib/podcastTTS';
import { getKnowledgeAsset, getOrCreateNarration } from '@/lib/ka-package/video-adapters';

export const maxDuration = 45;

export async function POST(request) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;
  try {
    const body = await request.json();
    const text = String(body.text || '').trim().slice(0, 5000);
    if (!text) return NextResponse.json({ error: 'Narration text is required.' }, { status: 400 });
    const speaker = body.voice === 'host_b' ? 'host_b' : 'host_a';
    const emotion = ['neutral','excited','curious','serious','calm','playful','dramatic'].includes(body.emotion) ? body.emotion : 'neutral';
    if (body.knowledgeAssetId) {
      const asset = await getKnowledgeAsset(body.knowledgeAssetId);
      const cached = await getOrCreateNarration(asset, text, { voice: speaker, emotion });
      return NextResponse.json({
        audioBase64: cached.audioBase64,
        mimeType: 'audio/mpeg',
        reused: cached.reused,
        componentId: cached.componentId,
      });
    }
    const audio = await synthesizeLine(text, speaker, emotion);
    return NextResponse.json({ audioBase64: audio.toString('base64'), mimeType: 'audio/mpeg' });
  } catch (error) {
    console.error('Bold video narration failed:', error);
    return NextResponse.json({ error: error.message || 'Narration generation failed.' }, { status: 502 });
  }
}
