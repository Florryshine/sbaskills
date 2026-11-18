import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/require-admin-api';
import { createAdminClient } from '@/lib/supabase-admin';

/**
 * Music Studio → Social Post bridge.
 *
 * POST    — hands the browser a signed Storage upload URL for an exported
 *           video/audio file (same pattern as video-studio/save-video).
 * DELETE  — removes ONE media file (the video) from a music_video asset:
 *           storage object + media_files row. The script (content_assets
 *           metadata/body) and the mixed audio stay untouched, so the video
 *           can be regenerated from the script at any time. The asset goes
 *           back to 'draft' when its primary video is removed.
 */

export const runtime = 'nodejs';

const ASSET_TYPE = 'music_video';
const BUCKET = 'lesson-videos';

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'song';
}

/** POST { contentAssetId, kind: 'video'|'audio', ext: 'mp4'|'webm'|'wav' } */
export async function POST(req: NextRequest) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  let body: { contentAssetId?: unknown; kind?: unknown; ext?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const contentAssetId = typeof body.contentAssetId === 'string' ? body.contentAssetId : null;
  const kind = body.kind === 'audio' ? 'audio' : 'video';
  const ext = kind === 'audio' ? 'wav' : (body.ext === 'webm' ? 'webm' : 'mp4');
  if (!contentAssetId) return NextResponse.json({ error: 'contentAssetId is required' }, { status: 400 });

  const admin = createAdminClient();
  const { data: asset, error } = await admin
    .from('content_assets')
    .select('id, knowledge_asset_id, title, asset_type')
    .eq('id', contentAssetId)
    .eq('asset_type', ASSET_TYPE)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!asset) return NextResponse.json({ error: 'Save the song script before sending its video to Social Post.' }, { status: 404 });

  const path = `${asset.knowledge_asset_id}/music-studio/${Date.now()}-${slugify(asset.title || 'song')}.${ext}`;
  const { data, error: signError } = await admin.storage.from(BUCKET).createSignedUploadUrl(path, { upsert: false });
  if (signError || !data?.token) {
    return NextResponse.json({ error: signError?.message || 'Could not prepare the video upload.' }, { status: 500 });
  }
  return NextResponse.json({ success: true, bucket: BUCKET, path, token: data.token, kind, ext });
}
