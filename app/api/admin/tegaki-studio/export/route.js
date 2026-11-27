import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { requireAdminApi } from '@/lib/require-admin-api';
import { createAdminClient } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const maxDuration = 60;
const BUCKET = 'tegaki-assets';
const RATIOS = new Set(['9:16','16:9','1:1']);
const STYLES = new Set(['classic-notebook','premium-notes','exam-revision','colourful-classroom','dark-chalkboard','digital-study-pad']);
const AUDIO_MIMES = new Set(['audio/mpeg','audio/wav','audio/x-wav','audio/mp4','audio/ogg']);

function trustedStorageUrl(value, baseUrl) {
  try {
    const url = new URL(value);
    const base = new URL(baseUrl);
    return url.protocol === 'https:' && url.origin === base.origin && url.pathname.includes('/storage/v1/object/public/');
  } catch { return false; }
}

async function persistAudioSource(supabase, source, jobId, index, baseUrl) {
  if (typeof source !== 'string' || !source) throw new Error('Every scene needs narration audio before export.');
  if (source.startsWith('data:')) {
    const match = source.match(/^data:(audio\/[a-z0-9.+-]+);base64,([a-z0-9+/=]+)$/i);
    if (!match || !AUDIO_MIMES.has(match[1].toLowerCase())) throw new Error('Scene ' + (index+1) + ' has an unsupported audio data format.');
    const buffer = Buffer.from(match[2], 'base64');
    if (!buffer.length || buffer.length > 15 * 1024 * 1024) throw new Error('Scene ' + (index+1) + ' audio must be under 15 MB.');
    const extension = match[1].includes('mpeg') ? 'mp3' : match[1].includes('wav') ? 'wav' : match[1].includes('ogg') ? 'ogg' : 'm4a';
    const storagePath = 'exports/' + jobId + '/scene-' + (index+1) + '.' + extension;
    const { error } = await supabase.storage.from(BUCKET).upload(storagePath, buffer, { contentType: match[1], upsert: true });
    if (error) throw new Error('Could not store scene audio: ' + error.message);
    return supabase.storage.from(BUCKET).getPublicUrl(storagePath).data.publicUrl;
  }
  if (!trustedStorageUrl(source, baseUrl)) throw new Error('Scene ' + (index+1) + ' audio must be a trusted SBA Supabase storage URL.');
  return source;
}

export async function GET() {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;
  const supabase = createAdminClient();
  const { data, error } = await supabase.from('tegaki_jobs')
    .select('id,title,subject,status,stage,stage_message,video_url,duration_seconds,aspect_ratio,error_message,content_asset_id,created_at')
    .order('created_at', { ascending: false }).limit(20);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ jobs: data || [] });
}

export async function POST(request) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;
  try {
    const body = await request.json();
    const scenes = Array.isArray(body.scenes) ? body.scenes : [];
    if (scenes.length < 1 || scenes.length > 6) return NextResponse.json({ error: 'Export requires 1–6 composed scenes.' }, { status: 400 });
    if (!body.knowledgeAssetId) return NextResponse.json({ error: 'Choose a Knowledge Asset before exporting so the video can be saved as a linked Social Engine draft.' }, { status: 400 });
    const ratio = RATIOS.has(body.aspectRatio) ? body.aspectRatio : '9:16';
    const styleId = STYLES.has(body.styleId) ? body.styleId : 'classic-notebook';
    const cleanScenes = scenes.map((scene, index) => {
      const heading = String(scene?.heading || '').trim().slice(0, 180);
      const text = String(scene?.text || '').trim().slice(0, 5000);
      const narration = String(scene?.narration || '').trim().slice(0, 2400);
      if (!heading || !text || !narration) throw new Error('Scene ' + (index+1) + ' is missing its heading, lesson text or narration.');
      return { ...scene, heading, text, narration, durationSeconds: Math.max(4, Math.min(240, Number.isFinite(Number(scene.durationSeconds)) ? Number(scene.durationSeconds) : 8)) };
    });
    const supabase = createAdminClient();
    const { data: asset, error: assetError } = await supabase.from('knowledge_assets').select('id,keyword,subject').eq('id', body.knowledgeAssetId).single();
    if (assetError || !asset) return NextResponse.json({ error: 'The selected Knowledge Asset no longer exists.' }, { status: 404 });
    const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!baseUrl) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not configured.');
    const jobId = randomUUID();
    for (let i=0;i<cleanScenes.length;i++) {
      cleanScenes[i].audioSrc = await persistAudioSource(supabase, cleanScenes[i].audioSrc, jobId, i, baseUrl);
    }
    let musicSrc = null;
    if (body.musicSrc) {
      if (!trustedStorageUrl(body.musicSrc, baseUrl) || !body.musicSrc.includes('/tegaki-assets/')) {
        return NextResponse.json({ error: 'Background music must be uploaded through the Tegaki music uploader.' }, { status: 400 });
      }
      musicSrc = body.musicSrc;
    }
    const durationSeconds = cleanScenes.reduce((sum, scene) => sum + scene.durationSeconds, 0);
    const title = String(body.title || asset.keyword || 'Tegaki Lesson').trim().slice(0, 200);
    const { data: job, error } = await supabase.from('tegaki_jobs').insert({
      id: jobId, title, subject: asset.subject || 'general', knowledge_asset_id: asset.id,
      scenes: cleanScenes, aspect_ratio: ratio, style_id: styleId,
      brand: String(body.brand || 'SHINEY BRAIN ACADEMY').trim().slice(0, 80),
      narration_volume: Math.max(0, Math.min(1, Number(body.narrationVolume) || 0)),
      music_src: musicSrc, music_volume: Math.max(0, Math.min(1, Number(body.musicVolume) || 0)),
      duration_seconds: durationSeconds, status: 'queued', stage: 'queued',
      stage_message: 'Waiting for the Tegaki renderer', created_by: auth.user?.id || null,
    }).select('id,title,status,stage,duration_seconds,aspect_ratio,created_at').single();
    if (error) throw new Error('Could not queue Tegaki export: ' + error.message);
    return NextResponse.json({ success: true, job }, { status: 202 });
  } catch (error) {
    console.error('Tegaki export queue failed:', error);
    return NextResponse.json({ error: error.message || 'Could not queue Tegaki export.' }, { status: 400 });
  }
}

export async function PATCH(request) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;
  try {
    const { id, action } = await request.json();
    if (!id || action !== 'retry') return NextResponse.json({ error: 'Provide { id, action: "retry" }.' }, { status: 400 });
    const supabase = createAdminClient();
    const { data, error } = await supabase.from('tegaki_jobs').update({
      status: 'queued', stage: 'queued', stage_message: 'Re-queued by admin',
      error_message: null, claim_token: null, worker_id: null, heartbeat_at: null, attempt_count: 0,
      updated_at: new Date().toISOString(),
    }).eq('id', id).eq('status', 'failed').select('id,status').maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'Only failed Tegaki exports can be retried.' }, { status: 409 });
    return NextResponse.json({ success: true, job: data });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Could not retry export.' }, { status: 400 });
  }
}
