import { createHash } from 'crypto';
import { createAdminClient } from '@/lib/supabase-admin';
import { synthesizeLine, estimateDurationSeconds } from '@/lib/podcastTTS';
import { getOrGenerateComponentForAsset, getOrGenerateComponent } from './library';

const AUDIO_BUCKET = 'ka-component-audio';

export async function getKnowledgeAsset(assetId) {
  if (!assetId) return null;
  const supabase = createAdminClient();
  const { data, error } = await supabase.from('knowledge_assets').select('*').eq('id', assetId).single();
  if (error || !data) throw new Error('Knowledge Asset not found');
  return data;
}

export async function getMasterScript(asset) {
  return getOrGenerateComponentForAsset(asset, 'master_script');
}

export async function getShortScript(asset) {
  return getOrGenerateComponentForAsset(asset, 'short_script');
}

export async function getVisualInstructions(asset) {
  return getOrGenerateComponentForAsset(asset, 'visual_instructions');
}

export function masterScriptToVideoScenes(script) {
  const beats = Array.isArray(script?.beats) ? script.beats : [];
  if (!beats.length) throw new Error('The reusable master script has no teaching beats.');
  return beats.slice(0, 8).map((beat, index) => ({
    heading: String(beat.on_screen_text || beat.title || 'KEY IDEA').slice(0, 100),
    narration: String(beat.narration || '').trim(),
    text: String(beat.narration || '').trim(),
    visualQuery: String(beat.stock_search || beat.visual_intent || '').trim().slice(0, 140),
    visualType: 'educational_diagram',
    reveal: 'scribble',
    highlightTerms: [],
    durationSeconds: Math.max(5, Math.min(8, estimateDurationSeconds(String(beat.narration || '')) + 1)),
    image: null,
    audioSrc: null,
    beatId: beat.id || 'beat-' + (index + 1),
  })).filter(scene => scene.narration && scene.visualQuery);
}

export async function getOrCreateNarration(asset, text, options = {}) {
  const cleanText = String(text || '').trim().slice(0, 5000);
  if (!cleanText) throw new Error('Narration text is required.');
  const voice = options.voice === 'host_b' ? 'host_b' : 'host_a';
  const emotion = ['neutral','excited','curious','serious','calm','playful','dramatic','emphatic'].includes(options.emotion)
    ? options.emotion : 'neutral';
  const variant = createHash('sha256').update([cleanText, voice, emotion].join('|')).digest('hex');
  const supabase = createAdminClient();
  const promptVersion = '1';
  const sourceHash = createHash('sha256').update(JSON.stringify({
    assetId: asset.id, keyword: asset.keyword, subject: asset.subject,
    text: cleanText, voice, emotion,
  })).digest('hex');

  const { data: rows, error: claimError } = await supabase.rpc('claim_ka_component', {
    p_asset_id: asset.id,
    p_component_type: 'narration_audio',
    p_variant: variant,
    p_source_hash: sourceHash,
    p_prompt_version: promptVersion,
    p_created_by: options.createdBy || null,
    p_force: false,
  });
  if (claimError) throw new Error('Could not claim narration audio: ' + claimError.message);
  const claim = Array.isArray(rows) ? rows[0] : rows;
  if (!claim?.component_id) throw new Error('No narration audio claim returned.');

  if (!claim.should_generate) {
    if (claim.component_status !== 'ready' || !claim.component_storage_path) {
      throw new Error('NARRATION_GENERATION_IN_PROGRESS');
    }
    const { data: signed, error } = await supabase.storage.from(AUDIO_BUCKET)
      .createSignedUrl(claim.component_storage_path, 3600);
    if (error || !signed?.signedUrl) throw new Error('Could not create a playback URL for cached narration.');
    return { audioSrc: signed.signedUrl, reused: true, componentId: claim.component_id };
  }

  const leaseToken = claim.claim_token;
  const path = asset.id + '/' + variant + '.mp3';
  try {
    const buffer = await synthesizeLine(cleanText, voice, emotion);
    const { error: uploadError } = await supabase.storage.from(AUDIO_BUCKET).upload(path, buffer, {
      contentType: 'audio/mpeg', upsert: true, cacheControl: '31536000',
    });
    if (uploadError) throw uploadError;
    const { data: saved, error: saveError } = await supabase.from('ka_components').update({
      status: 'ready',
      body: { text: cleanText, voice, emotion },
      storage_path: path,
      mime_type: 'audio/mpeg',
      bytes: buffer.length,
      duration_ms: estimateDurationSeconds(cleanText) * 1000,
      generated_by: 'podcast-tts',
      locked_until: null,
      claim_token: null,
      last_error: null,
      updated_at: new Date().toISOString(),
    }).eq('id', claim.component_id).eq('status', 'generating').eq('claim_token', leaseToken)
      .select('id,storage_path').single();
    if (saveError || !saved) throw saveError || new Error('Narration lease expired before save.');
    const { data: signed, error: signedError } = await supabase.storage.from(AUDIO_BUCKET)
      .createSignedUrl(saved.storage_path, 3600);
    if (signedError || !signed?.signedUrl) throw signedError || new Error('Could not create narration playback URL.');
    return { audioSrc: signed.signedUrl, reused: false, componentId: saved.id };
  } catch (error) {
    await supabase.from('ka_components').update({
      status: 'failed', last_error: String(error?.message || error).slice(0, 2000),
      locked_until: null, claim_token: null, updated_at: new Date().toISOString(),
    }).eq('id', claim.component_id).eq('status', 'generating').eq('claim_token', leaseToken);
    throw error;
  }
}

export async function getOrGeneratePackageComponent(assetId, type) {
  return getOrGenerateComponent(assetId, type);
}
