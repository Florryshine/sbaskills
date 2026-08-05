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

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { generateAllMetadata, applyPlatformMetadata } from '@/lib/metadata-engine';
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

  // Everything below is best-effort enrichment (cross-platform metadata +
  // auto-queued publish jobs) — none of it should block the save from
  // completing or risk the whole request timing out.
  runInBackground(async () => {
    let updatedMetadata = contentAsset.metadata || {};
    if (!updatedMetadata.youtube && !updatedMetadata.tiktok) {
      try {
        const { data: knowledgeAsset } = await supabase
          .from('knowledge_assets')
          .select('*')
          .eq('id', contentAsset.knowledge_asset_id)
          .single();

        if (knowledgeAsset) {
          const allMetadata = await generateAllMetadata(knowledgeAsset);

          const platforms = ['youtube', 'tiktok', 'instagram', 'facebook', 'linkedin', 'telegram'];
          for (const platform of platforms) {
            if (allMetadata[platform]) {
              const platformAssetType = platform === 'youtube' ? 'youtube_short' :
                                        platform === 'tiktok' ? 'tiktok_video' :
                                        platform === 'instagram' ? 'instagram_carousel' :
                                        platform === 'facebook' ? 'facebook_post' :
                                        platform === 'linkedin' ? 'linkedin_post' : 'telegram_post';

              const { data: existingPlatformAsset } = await supabase
                .from('content_assets')
                .select('id, metadata')
                .eq('knowledge_asset_id', contentAsset.knowledge_asset_id)
                .eq('platform', platform)
                .eq('format', 'video')
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

              const enrichedMetadata = applyPlatformMetadata({}, allMetadata, platform);

              if (existingPlatformAsset) {
                await supabase
                  .from('content_assets')
                  .update({ metadata: enrichedMetadata })
                  .eq('id', existingPlatformAsset.id);
              } else {
                await supabase.from('content_assets').insert({
                  knowledge_asset_id: contentAsset.knowledge_asset_id,
                  asset_type: platformAssetType,
                  platform: platform,
                  format: 'video',
                  title: allMetadata[platform].title || contentAsset.title,
                  body: allMetadata[platform].caption || allMetadata[platform].description || contentAsset.body,
                  metadata: enrichedMetadata,
                  status: 'draft',
                  generated_by: 'metadata-engine-auto',
                });
              }
            }
          }

          updatedMetadata = { ...contentAsset.metadata, cross_platform_metadata: allMetadata };
          await supabase
            .from('content_assets')
            .update({ metadata: updatedMetadata })
            .eq('id', contentAssetId);
        }
      } catch (metaErr) {
        console.warn('Metadata generation failed, continuing without:', metaErr.message);
      }
    }

    if (autoPublish) {
      try {
        const { data: channels } = await supabase
          .from('social_channels_v2')
          .select('id, platform')
          .eq('is_active', true)
          .in('platform', ['youtube', 'tiktok', 'instagram', 'facebook', 'linkedin', 'telegram']);

        if (channels && channels.length > 0) {
          const jobsToCreate = [];
          const videoPlatforms = ['youtube', 'tiktok', 'instagram', 'facebook'];

          for (const channel of channels) {
            if (videoPlatforms.includes(channel.platform)) {
              const { data: platformAsset } = await supabase
                .from('content_assets')
                .select('id')
                .eq('knowledge_asset_id', contentAsset.knowledge_asset_id)
                .eq('platform', channel.platform)
                .eq('format', 'video')
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

              const targetAssetId = platformAsset?.id || contentAssetId;

              jobsToCreate.push({
                content_asset_id: targetAssetId,
                channel_id: channel.id,
                status: 'queued',
                created_by: 'quote-loop-auto-publish',
              });
            }
          }

          if (jobsToCreate.length > 0) {
            await supabase.from('publish_jobs').insert(jobsToCreate);
          }
        }
      } catch (jobErr) {
        console.warn('Auto-publish job creation failed:', jobErr.message);
      }
    }
  });

  return response;
}
