import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/require-admin-api';
import { createAdminClient } from '@/lib/supabase-admin';

export const runtime = 'nodejs';

export async function GET() {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;
  const db = createAdminClient();
  const { data, error } = await db.from('content_assets')
    .select('id, title, body, metadata, status, created_at, updated_at, media_files(*)')
    .eq('asset_type', 'music_song')
    .order('updated_at', { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data || [] });
}

export async function POST(request) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const title = typeof body.title === 'string' ? body.title.trim().slice(0, 160) : '';
  const topic = typeof body.topic === 'string' ? body.topic.trim().slice(0, 240) : '';
  if (!title || !topic || !body.spec || typeof body.spec !== 'object') {
    return NextResponse.json({ error: 'title, topic and song spec are required' }, { status: 400 });
  }
  const db = createAdminClient();
  const row = {
    knowledge_asset_id: null,
    asset_type: 'music_song',
    platform: null,
    format: 'music_video',
    title,
    body: typeof body.lyrics === 'string' ? body.lyrics.slice(0, 30000) : '',
    metadata: {
      studio: 'musical_learning_studio',
      topic,
      spec: body.spec,
      settings: body.settings || {},
      caption: typeof body.caption === 'string' ? body.caption.slice(0, 5000) : '',
    },
    status: 'draft',
    generated_by: 'music_studio',
    updated_at: new Date().toISOString(),
  };
  let query = db.from('content_assets').upsert(
    body.id ? { ...row, id: body.id } : row,
    body.id ? { onConflict: 'id' } : undefined
  ).select('id, title, body, metadata, status, created_at, updated_at').single();
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, project: data });
}

export async function DELETE(request) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;
  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
  const db = createAdminClient();
  const { data: asset, error: fetchError } = await db.from('content_assets')
    .select('id, asset_type').eq('id', id).single();
  if (fetchError || !asset || asset.asset_type !== 'music_song') {
    return NextResponse.json({ error: 'Music project not found' }, { status: 404 });
  }
  const { data: media } = await db.from('media_files').select('storage_path')
    .eq('content_asset_id', id).not('storage_path', 'is', null);
  const paths = (media || []).map((m) => m.storage_path).filter(Boolean);
  if (paths.length) await db.storage.from('music-studio-media').remove(paths);
  const { error } = await db.from('content_assets').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
