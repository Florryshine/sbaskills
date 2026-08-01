// app/api/admin/podcasts/[id]/audiogram/route.js
//
// The AudiogramRecorder component (client-side canvas + Web Audio +
// MediaRecorder) uploads the finished video straight to Supabase storage
// itself — that's allowed under the existing authenticated-upload policy
// on the lesson-videos bucket. This route only handles the two writes RLS
// doesn't let the browser client do directly: updating podcast_episodes,
// and (if the episode has a knowledge_asset_id) mirroring the video into
// content_assets + media_files so it shows up in the social-engine review
// dashboard (app/admin/social-engine/page.js) ready to publish, exactly
// like every other content-factory-generated asset.
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';

export async function POST(request, { params }) {
  const { id } = params;
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { videoUrl } = body || {};
  if (!videoUrl) {
    return NextResponse.json({ error: 'videoUrl is required' }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: episode, error: fetchError } = await supabase
    .from('podcast_episodes')
    .select('id, title, knowledge_asset_id, total_duration_seconds, audiogram_content_asset_id')
    .eq('id', id)
    .single();
  if (fetchError || !episode) {
    return NextResponse.json({ error: 'Episode not found' }, { status: 404 });
  }

  await supabase
    .from('podcast_episodes')
    .update({ audiogram_url: videoUrl, audiogram_status: 'ready' })
    .eq('id', id);

  // No source knowledge asset (e.g. a blog-post-sourced episode) — nothing
  // to mirror into content_assets, which requires a non-null
  // knowledge_asset_id. The video is still saved on the episode itself.
  if (!episode.knowledge_asset_id) {
    return NextResponse.json({ success: true, videoUrl, contentAssetId: null });
  }

  let contentAssetId = episode.audiogram_content_asset_id;

  if (contentAssetId) {
    // Re-recorded — update the existing mirrored media_files row instead of
    // creating a duplicate content_assets row.
    const { error: updateMediaError } = await supabase
      .from('media_files')
      .update({ url: videoUrl, duration_seconds: episode.total_duration_seconds || null })
      .eq('content_asset_id', contentAssetId)
      .eq('media_type', 'video')
      .eq('role', 'primary');
    if (updateMediaError) {
      return NextResponse.json({ error: updateMediaError.message }, { status: 500 });
    }
  } else {
    const { data: insertedAsset, error: insertAssetError } = await supabase
      .from('content_assets')
      .insert({
        knowledge_asset_id: episode.knowledge_asset_id,
        asset_type: 'podcast_audiogram',
        platform: null, // format-agnostic — same video can be published to any platform's queue
        format: 'video',
        title: episode.title,
        status: 'draft',
        generated_by: 'audiogram-recorder-client',
      })
      .select()
      .single();
    if (insertAssetError) {
      return NextResponse.json({ error: insertAssetError.message }, { status: 500 });
    }

    const { error: insertMediaError } = await supabase.from('media_files').insert({
      content_asset_id: insertedAsset.id,
      media_type: 'video',
      role: 'primary',
      position: 0,
      url: videoUrl,
      duration_seconds: episode.total_duration_seconds || null,
      source: 'render',
      alt_text: episode.title,
    });
    if (insertMediaError) {
      return NextResponse.json({ error: insertMediaError.message }, { status: 500 });
    }

    contentAssetId = insertedAsset.id;
    await supabase
      .from('podcast_episodes')
      .update({ audiogram_content_asset_id: contentAssetId })
      .eq('id', id);
  }

  return NextResponse.json({ success: true, videoUrl, contentAssetId });
}
