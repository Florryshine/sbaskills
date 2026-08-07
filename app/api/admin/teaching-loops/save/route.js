// app/api/admin/teaching-loops/save/route.js
//
// TeachingLoopRecorder (client-side canvas + Web Audio + MediaRecorder,
// same technique as QuoteLoopRecorder) uploads the finished ~2 minute clip
// straight to Supabase storage itself. This route only handles the write
// RLS doesn't let the browser client do directly: inserting the
// media_files row against the already-existing content_assets draft
// (created earlier by /api/admin/teaching-loops/generate), then marking it
// approved and auto-queuing publish jobs — same pattern as
// quote-loops/save/route.js, including running the publish-job step in the
// background so this response comes back fast.

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { runInBackground } from '@/lib/backgroundTask';

export const maxDuration = 60;

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { contentAssetId, videoUrl, durationSeconds, autoPublish = true } = body || {};
  if (!contentAssetId || !videoUrl) {
    return NextResponse.json({ error: 'contentAssetId and videoUrl are required' }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: contentAsset, error: fetchError } = await supabase
    .from('content_assets')
    .select('id, title, asset_type, knowledge_asset_id, metadata')
    .eq('id', contentAssetId)
    .eq('asset_type', 'teaching_loop')
    .single();
  if (fetchError || !contentAsset) {
    return NextResponse.json({ error: 'Teaching-loop content asset not found' }, { status: 404 });
  }

  // Re-recorded — update the existing media_files row instead of creating
  // a duplicate, same "primary" role/position=0 convention as the rest of
  // the content-factory pipeline.
  const { data: existingMedia } = await supabase
    .from('media_files')
    .select('id')
    .eq('content_asset_id', contentAssetId)
    .eq('media_type', 'video')
    .eq('role', 'primary')
    .maybeSingle();

  if (existingMedia) {
    const { error: updateError } = await supabase
      .from('media_files')
      .update({ url: videoUrl, duration_seconds: durationSeconds || null })
      .eq('id', existingMedia.id);
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
  } else {
    const { error: insertError } = await supabase.from('media_files').insert({
      content_asset_id: contentAssetId,
      media_type: 'video',
      role: 'primary',
      position: 0,
      url: videoUrl,
      duration_seconds: durationSeconds || null,
      source: 'render',
      alt_text: contentAsset.title,
    });
    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
  }

  await supabase.from('content_assets').update({ status: 'approved' }).eq('id', contentAssetId);

  const response = NextResponse.json({ success: true, videoUrl });

  if (autoPublish) {
    runInBackground(async () => {
      try {
        const { data: channels } = await supabase
          .from('social_channels_v2')
          .select('id, platform')
          .eq('is_active', true)
          .in('platform', ['youtube', 'tiktok', 'instagram', 'facebook', 'linkedin', 'telegram']);

        const videoPlatforms = ['youtube', 'tiktok', 'instagram', 'facebook'];
        const jobsToCreate = (channels || [])
          .filter((channel) => videoPlatforms.includes(channel.platform))
          .map((channel) => ({
            content_asset_id: contentAssetId,
            channel_id: channel.id,
            status: 'queued',
            created_by: 'teaching-loop-auto-publish',
          }));

        if (jobsToCreate.length > 0) {
          await supabase.from('publish_jobs').insert(jobsToCreate);
        }
      } catch (jobErr) {
        console.warn('Auto-publish job creation failed:', jobErr.message);
      }
    });
  }

  return response;
}
