import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase-admin';
import { requireAdminApi } from '@/lib/require-admin-api';
import { getKnowledgeAsset, getOrCreateNarration } from '@/lib/ka-package/video-adapters';
import { synthesizeLine, estimateDurationSeconds, getAudioMimeType } from '@/lib/podcastTTS';


export const runtime = 'nodejs';
export const maxDuration = 180;

const VOICES = new Set(['host_a', 'host_b']);
const EMOTIONS = new Set(['neutral', 'excited', 'curious', 'serious', 'calm', 'playful', 'dramatic', 'emphatic']);

export async function POST(request) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  try {
    const body = await request.json();
    if (!Array.isArray(body.scenes) || body.scenes.length < 1 || body.scenes.length > 6) {
      return NextResponse.json({ error: 'Provide between 1 and 6 lesson scenes.' }, { status: 400 });
    }
    const voice = VOICES.has(body.voice) ? body.voice : 'host_a';
    const emotion = EMOTIONS.has(body.emotion) ? body.emotion : 'neutral';
    const knowledgeAssetId = typeof body.knowledgeAssetId === 'string' ? body.knowledgeAssetId.slice(0, 100) : '';
    let asset = null;
    if (knowledgeAssetId) {
      try { asset = await getKnowledgeAsset(knowledgeAssetId); }
      catch { return NextResponse.json({ error: 'Knowledge Asset not found for narration caching.' }, { status: 404 }); }
    }

    const audio = [];
    // Deliberately sequential: the shared Edge TTS endpoint is rate-sensitive.
    for (const [index, scene] of body.scenes.entries()) {
      const narration = String(scene?.narration || scene?.text || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 2400);
      if (!narration) return NextResponse.json({ error: 'Scene ' + (index + 1) + ' has no narration.' }, { status: 400 });

      let audioSrc, reused = false, mimeType, audioBuffer;
      if (asset) {
        const cached = await getOrCreateNarration(asset, narration, { voice, emotion });
        audioBuffer = Buffer.from(cached.audioBase64, 'base64');
        reused = cached.reused;
        mimeType = cached.mimeType || 'audio/mpeg';
      } else {
        audioBuffer = await synthesizeLine(narration, voice, emotion);
        mimeType = getAudioMimeType(audioBuffer);
      }
      if (!audioBuffer?.length) throw new Error('Narration audio was empty for scene ' + (index + 1) + '.');
      const extension = mimeType === 'audio/wav' || mimeType === 'audio/x-wav' ? 'wav' : mimeType === 'audio/ogg' ? 'ogg' : mimeType === 'audio/mp4' ? 'm4a' : 'mp3';
      const storagePath = 'narration/' + (knowledgeAssetId || 'manual') + '/' + randomUUID() + '.' + extension;
      const supabase = createAdminClient();
      const { error: uploadError } = await supabase.storage.from('tegaki-assets').upload(storagePath, audioBuffer, { contentType: mimeType, upsert: false });
      if (uploadError) throw new Error('Could not store narration audio: ' + uploadError.message);
      audioSrc = supabase.storage.from('tegaki-assets').getPublicUrl(storagePath).data.publicUrl;

      const estimatedSpeechSeconds = Math.max(2, estimateDurationSeconds(narration));
      audio.push({
        sceneId: String(scene?.id || 'tegaki-' + (index + 1)),
        audioSrc,
        mimeType: mimeType || 'audio/mpeg',
        speechDurationSeconds: estimatedSpeechSeconds,
        // A short visual hold after speech prevents the next scene cutting off the final words.
        durationSeconds: Math.max(Number(scene?.durationSeconds) || 0, estimatedSpeechSeconds + 1.25, 4),
        reused,
      });
    }

    return NextResponse.json({
      success: true,
      audio,
      voice,
      emotion,
      reusedCount: audio.filter(item => item.reused).length,
      generatedCount: audio.filter(item => !item.reused).length,
    });
  } catch (error) {
    console.error('Tegaki narration generation failed:', error);
    const message = error?.message === 'NARRATION_GENERATION_IN_PROGRESS'
      ? 'Narration for this lesson is already being generated. Please wait a moment and try again.'
      : (error?.message || 'Could not generate Tegaki narration.');
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
