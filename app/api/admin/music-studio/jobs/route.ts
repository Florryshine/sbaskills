import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/require-admin-api';
import { createAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

export async function GET() {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('music_render_jobs')
    .select('id,title,topic,status,stage,stage_message,progress,attempt_count,max_attempts,audio_url,video_url,error_message,created_at,updated_at,completed_at,content_asset_id')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ jobs: data ?? [] });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;
  let body: Record<string, unknown>;
  try {
    const parsed = await req.json();
    if (!isRecord(parsed)) throw new Error('Expected an object');
    body = parsed;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const spec = body.spec;
  const settings = body.settings;
  const contentAssetId = typeof body.contentAssetId === 'string' ? body.contentAssetId : '';
  const title = typeof body.title === 'string' ? body.title.trim().slice(0, 160) : '';
  const topic = typeof body.topic === 'string' ? body.topic.trim().slice(0, 240) : '';
  if (!isRecord(spec) || !isRecord(settings) || !contentAssetId || !title || !topic) {
    return NextResponse.json({ error: 'A saved script, SongSpec, Studio settings, title and topic are required.' }, { status: 400 });
  }
  if (!Array.isArray(spec.sections) || typeof spec.tempoBpm !== 'number' || !spec.sections.length) {
    return NextResponse.json({ error: 'SongSpec is incomplete or invalid.' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: asset, error: assetError } = await supabase
    .from('content_assets').select('id,asset_type').eq('id', contentAssetId).maybeSingle();
  if (assetError) return NextResponse.json({ error: assetError.message }, { status: 500 });
  if (!asset || asset.asset_type !== 'music_video') {
    return NextResponse.json({ error: 'Save this song script before starting background rendering.' }, { status: 404 });
  }

  const { data: activeJob, error: activeError } = await supabase.from('music_render_jobs')
    .select('id,title,status,stage,progress,created_at')
    .eq('content_asset_id', contentAssetId)
    .in('status', ['queued', 'processing'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (activeError) return NextResponse.json({ error: activeError.message }, { status: 500 });
  if (activeJob) return NextResponse.json({ success: true, existing: true, job: activeJob }, { status: 202 });

  const { data, error } = await supabase.from('music_render_jobs').insert({
    content_asset_id: contentAssetId,
    title,
    topic,
    payload: { spec, settings },
    status: 'queued',
    stage: 'queued',
    stage_message: 'Waiting for a background renderer',
    progress: 0,
    attempt_count: 0,
    max_attempts: 3,
  }).select('id,title,status,stage,progress,created_at').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, job: data }, { status: 202 });
}
