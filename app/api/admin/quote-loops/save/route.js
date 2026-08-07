// app/api/admin/quote-loops/save/route.js
//
// QuoteLoopRecorder (client-side canvas + Web Audio + MediaRecorder,
// same technique as AudiogramRecorder) uploads the finished clip straight
// to Supabase storage itself. This route only handles the write RLS
// doesn't let the browser client do directly: inserting the media_files
// row against the already-existing content_assets draft (created earlier
// by /api/admin/quote-loops/generate), so it shows up with real media in
// the social-engine review dashboard, exactly like every other
// content-factory-generated asset.
//
// UPDATED: cross-platform metadata generation + auto-publish job creation
// now run via runInBackground() instead of being awaited inline. The
// earlier inline version chained one AI call (which can loop through up
// to 9 fallback models) plus ~14 sequential Supabase round-trips before
// ever sending a response — on Vercel that risked hitting the function's
// time limit and dying before the final `status: 'approved'` update ran,
// which is what made saved videos silently never show up as approved.
// Saving the media file and marking the asset approved now happens first
// and is returned to the client immediately; metadata + publish jobs are
// best-effort follow-up work. Same fix pattern already used in
// app/api/admin/books/from-text/route.js.
//
// REMOVED (this update): the generateAllMetadata() cross-platform
// regeneration step and its "find-or-create a shared youtube_short/
// tiktok_video/... content_asset per knowledge_asset_id" logic. Two real
// bugs came from that: (1) it silently overwrote the unique per-line
// title/description/tags/hashtags that quote-loops/generate now writes
// with a generic topic-level title regenerated from the knowledge asset —
// same title for every line again. (2) worse, it looked up an existing
// platform asset by knowledge_asset_id alone, so every video generated
// from the same knowledge asset after the first one got routed to the
// SAME shared content_asset row — which never had its own media_files,
// since the actual recording is attached to the original per-line asset.
// Publish jobs now target contentAssetId directly: that row already has
// the correct unique metadata (from generate/route.js) and its own
// media_files, so no extra step is needed before queuing it.

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { runInBackground } from '@/lib/backgroundTask';

// Matches the reference maxDuration used for the other background-task
// routes in this repo — the background work itself isn't bounded by this
// once the response has been sent, but runInBackground's lifetime
// extension on Vercel is capped by whatever this route declares.
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
    .eq('asset_type', 'quote_loop')
    .single();
  if (fetchError || !contentAsset) {
    return NextResponse.json({ error: 'Quote-loop content asset not found' }, { status: 404 });
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

  // The part that actually needs to happen before the client can see the
  // video as "done" — do this synchronously and respond right away.
  await supabase.from('content_assets').update({ status: 'approved' }).eq('id', contentAssetId);

  const response = NextResponse.json({ success: true, videoUrl });

  // Best-effort: auto-queue publish jobs against THIS video's own
  // content_asset (contentAssetId) — it already carries the unique
  // title/description/tags/hashtags written by quote-loops/generate and
  // its own media_files row from above, so no extra metadata step or
  // shared-asset lookup is needed before queuing it.
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
            created_by: 'quote-loop-auto-publish',
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
