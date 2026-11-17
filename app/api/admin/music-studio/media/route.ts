import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/require-admin-api';
import { createAdminClient } from '@/lib/supabase-admin';

export const runtime = 'nodejs';

const MIME = new Set(['video/mp4', 'video/webm', 'audio/wav', 'audio/x-wav', 'audio/mpeg', 'audio/mp3', 'audio/webm', 'audio/ogg']);

export async function POST(request: NextRequest) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const db = createAdminClient();
  const { data: project, error: projectError } = await db.from('content_assets')
    .select('id, asset_type, title').eq('id', body.projectId).single();
  if (projectError || !project || project.asset_type !== 'music_song') {
    return NextResponse.json({ error: 'Saved music script not found. Save the script first.' }, { status: 404 });
  }

  if (body.action === 'sign') {
    const mime = String(body.mimeType || '');
    const kind = body.kind === 'video' ? 'video' : 'audio';
    if (!MIME.has(mime)) return NextResponse.json({ error: 'Unsupported media type' }, { status: 400 });
    const ext = kind === 'video' ? (mime === 'video/webm' ? 'webm' : 'mp4') : (mime.includes('mpeg') || mime === 'audio/mp3' ? 'mp3' : mime.includes('ogg') ? 'ogg' : mime.includes('webm') ? 'webm' : 'wav');
    const path = `${project.id}/${kind}-${Date.now()}.${ext}`;
    const { data, error } = await db.storage.from('music-studio-media').createSignedUploadUrl(path);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ path, token: data.token, kind, mime });
  }

  if (body.action === 'finalize') {
    const { path, kind, mimeType, durationSeconds, fileSizeBytes } = body;
    if (typeof path !== 'string' || !path.startsWith(`${project.id}/`) || !['audio', 'video'].includes(kind)) {
      return NextResponse.json({ error: 'Invalid uploaded media reference' }, { status: 400 });
    }
    const { data: publicData } = db.storage.from('music-studio-media').getPublicUrl(path);
    const { data, error } = await db.from('media_files').insert({
      content_asset_id: project.id,
      media_type: kind,
      role: kind === 'video' ? 'primary' : 'audio_track',
      position: kind === 'video' ? 0 : 1,
      url: publicData.publicUrl,
      storage_path: path,
      mime_type: mimeType,
      file_size_bytes: Number(fileSizeBytes) || null,
      duration_seconds: Number(durationSeconds) || null,
      source: 'music_studio',
      alt_text: project.title,
    }).select().single();
    if (error) {
      await db.storage.from('music-studio-media').remove([path]);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, media: data });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;
  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'media id is required' }, { status: 400 });
  const db = createAdminClient();
  const { data: media, error: fetchError } = await db.from('media_files')
    .select('id, content_asset_id, storage_path, source')
    .eq('id', id).eq('source', 'music_studio').single();
  if (fetchError || !media) return NextResponse.json({ error: 'Music media not found' }, { status: 404 });
  if (media.storage_path) {
    const { error } = await db.storage.from('music-studio-media').remove([media.storage_path]);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const { error } = await db.from('media_files').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, projectId: media.content_asset_id });
}
