import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/require-admin-api';
import { createAdminClient } from '@/lib/supabase-admin';

/**
 * Music Studio → Social Post bridge, step 2.
 *
 * POST   — attaches an uploaded media file to the music_video content asset
 *          (media_files row + status), optionally queueing publish jobs for
 *          every active video channel, mirroring quote-loops/save.
 * DELETE — deletes ONE media file (the video) while keeping the script and
 *          the audio: the storage object goes, the media_files row goes, and
 *          the asset returns to 'draft' so the video can be re-exported from
 *          the still-intact script.
 */

export const runtime = 'nodejs';

const ASSET_TYPE = 'music_video';
const BUCKET = 'lesson-videos';
const VIDEO_PLATFORMS = ['youtube', 'tiktok', 'instagram', 'facebook'];

/** POST { contentAssetId, kind, path, durationSeconds?, fileSizeBytes?, autoPublish? } */
export async function POST(req: NextRequest) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  let body: {
    contentAssetId?: unknown; kind?: unknown; path?: unknown;
    durationSeconds?: unknown; fileSizeBytes?: unknown; autoPublish?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const contentAssetId = typeof body.contentAssetId === 'string' ? body.contentAssetId : null;
  const path = typeof body.path === 'string' ? body.path : null;
  const kind = body.kind === 'audio' ? 'audio' : 'video';
  if (!contentAssetId || !path) {
    return NextResponse.json({ error: 'contentAssetId and path are required' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: asset, error: assetError } = await admin
    .from('content_assets')
    .select('id, knowledge_asset_id, title, asset_type')
    .eq('id', contentAssetId)
    .eq('asset_type', ASSET_TYPE)
    .maybeSingle();
  if (assetError) return NextResponse.json({ error: assetError.message }, { status: 500 });
  if (!asset) return NextResponse.json({ error: 'Music video script not found.' }, { status: 404 });
  if (!path.startsWith(`${asset.knowledge_asset_id}/music-studio/`)) {
    return NextResponse.json({ error: 'Uploaded file path does not match this script.' }, { status: 400 });
  }

  const { data: urlData } = admin.storage.from(BUCKET).getPublicUrl(path);
  const url = urlData.publicUrl;
  const mime = kind === 'audio' ? 'audio/wav' : path.endsWith('.webm') ? 'video/webm' : 'video/mp4';

  // Replace the previous file of the same kind instead of accumulating rows.
  await admin
    .from('media_files')
    .delete()
    .eq('content_asset_id', contentAssetId)
    .eq('media_type', kind === 'audio' ? 'audio' : 'video')
    .eq('role', kind === 'audio' ? 'audio' : 'primary');

  const { data: media, error: mediaError } = await admin
    .from('media_files')
    .insert({
      content_asset_id: contentAssetId,
      media_type: kind,
      role: kind === 'audio' ? 'audio' : 'primary',
      position: 0,
      url,
      storage_path: path,
      mime_type: mime,
      file_size_bytes: Number(body.fileSizeBytes) || null,
      duration_seconds: Number(body.durationSeconds) || null,
      source: 'render',
      alt_text: asset.title,
    })
    .select('id, url')
    .single();
  if (mediaError) return NextResponse.json({ error: mediaError.message }, { status: 500 });

  if (kind === 'video') {
    const { error: statusError } = await admin
      .from('content_assets')
      .update({ status: 'approved', updated_at: new Date().toISOString() })
      .eq('id', contentAssetId);
    if (statusError) return NextResponse.json({ error: statusError.message }, { status: 500 });
  }

  // Best-effort: queue publish jobs to every active video-capable channel
  // (same shape as quote-loops auto-publish).
  let jobsQueued = 0;
  if (kind === 'video' && body.autoPublish === true) {
    try {
      const { data: channels } = await admin
        .from('social_channels_v2')
        .select('id, platform')
        .eq('is_active', true)
        .in('platform', VIDEO_PLATFORMS);
      const rows = (channels ?? []).map((channel) => ({
        content_asset_id: contentAssetId,
        channel_id: channel.id,
        status: 'queued',
        created_by: 'music-studio-auto-publish',
      }));
      if (rows.length) {
        const { error: jobsError } = await admin.from('publish_jobs').insert(rows);
        if (!jobsError) jobsQueued = rows.length;
      }
    } catch (jobErr) {
      console.warn('[music-studio] auto publish job creation failed:', jobErr);
    }
  }

  return NextResponse.json({ success: true, mediaFileId: media.id, url, jobsQueued });
}

/** DELETE ?mediaId=… — delete one video/audio file, keep the script + the rest. */
export async function DELETE(req: NextRequest) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;
  const mediaId = req.nextUrl.searchParams.get('mediaId');
  if (!mediaId) return NextResponse.json({ error: 'mediaId is required' }, { status: 400 });

  const admin = createAdminClient();
  const { data: media, error: fetchError } = await admin
    .from('media_files')
    .select('id, content_asset_id, media_type, role, storage_path')
    .eq('id', mediaId)
    .maybeSingle();
  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
  if (!media) return NextResponse.json({ error: 'Media file not found' }, { status: 404 });

  // Only music-studio assets are managed through this endpoint.
  const { data: asset, error: assetError } = await admin
    .from('content_assets')
    .select('id, asset_type')
    .eq('id', media.content_asset_id)
    .eq('asset_type', ASSET_TYPE)
    .maybeSingle();
  if (assetError) return NextResponse.json({ error: assetError.message }, { status: 500 });
  if (!asset) {
    return NextResponse.json({ error: 'This media file does not belong to a Music Studio script.' }, { status: 400 });
  }

  if (media.storage_path) {
    const { error: removeError } = await admin.storage.from(BUCKET).remove([media.storage_path]);
    if (removeError) {
      console.warn('[music-studio] storage remove failed (deleting row anyway):', removeError.message);
    }
  }
  const { error: deleteError } = await admin.from('media_files').delete().eq('id', mediaId);
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });

  // The video is gone; the script stays. Mark the asset draft so it is
  // obvious in Social Post that there is nothing to publish until a new
  // video is exported.
  if (media.media_type === 'video' && media.role === 'primary') {
    await admin
      .from('content_assets')
      .update({ status: 'draft', updated_at: new Date().toISOString() })
      .eq('id', media.content_asset_id);
  }

  return NextResponse.json({ success: true, keptScript: true });
}
