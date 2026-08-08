// app/api/admin/lesson-loops/save/route.js
//
// Same shape as quote-loops/save (create/update the primary media_files
// row, mark approved, queue publish_jobs in the background) with one
// difference: lesson-loops/generate already produced real per-platform
// metadata (youtube title+description+tags, facebook caption, tiktok
// caption+hashtags) grounded in the actual script — so this creates the
// platform-specific content_assets rows directly from that instead of
// calling the generic metadata-engine fallback quote-loops/meme-loops
// use. lib/publishers/youtube.js (and the other publishers) just read
// metadata.title/description/hashtags off whatever row is linked to the
// publish_jobs entry — they don't branch on asset_type, so
// 'youtube_video' here (vs 'youtube_short' elsewhere) is purely an
// internal label for our own tracking, not something YouTube's Shorts
// detection reads; that's driven entirely by the video's own
// landscape dimensions/duration.

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { runInBackground } from '@/lib/backgroundTask';

export const maxDuration = 60;

const PLATFORM_ASSET_TYPE = {
  youtube: 'youtube_video',
  facebook: 'facebook_post',
  tiktok: 'tiktok_video',
};

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
    .eq('asset_type', 'lesson_loop')
    .single();
  if (fetchError || !contentAsset) {
    return NextResponse.json({ error: 'Lesson-loop content asset not found' }, { status: 404 });
  }

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

  runInBackground(async () => {
    const meta = contentAsset.metadata || {};

    const platformPayload = {
      youtube: meta.youtube && {
        title: meta.youtube.title,
        body: meta.youtube.description,
        metadata: { title: meta.youtube.title, description: meta.youtube.description, hashtags: (meta.youtube.tags || []).map((t) => `#${t.replace(/\s+/g, '')}`) },
      },
      facebook: meta.facebook && {
        title: contentAsset.title,
        body: meta.facebook.caption,
        metadata: { title: contentAsset.title, description: meta.facebook.caption },
      },
      tiktok: meta.tiktok && {
        title: contentAsset.title,
        body: meta.tiktok.caption,
        metadata: { title: contentAsset.title, description: meta.tiktok.caption, hashtags: meta.tiktok.hashtags || [] },
      },
    };

    for (const [platform, payload] of Object.entries(platformPayload)) {
      if (!payload) continue;
      try {
        const { data: existingPlatformAsset } = await supabase
          .from('content_assets')
          .select('id')
          .eq('knowledge_asset_id', contentAsset.knowledge_asset_id)
          .eq('platform', platform)
          .eq('format', 'video')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (existingPlatformAsset) {
          await supabase
            .from('content_assets')
            .update({ title: payload.title, body: payload.body, metadata: payload.metadata })
            .eq('id', existingPlatformAsset.id);
        } else {
          await supabase.from('content_assets').insert({
            knowledge_asset_id: contentAsset.knowledge_asset_id,
            asset_type: PLATFORM_ASSET_TYPE[platform],
            platform,
            format: 'video',
            title: payload.title,
            body: payload.body,
            metadata: payload.metadata,
            status: 'draft',
            generated_by: 'lesson-loop-auto-publish',
          });
        }
      } catch (err) {
        console.warn(`Platform metadata row failed for ${platform}:`, err.message);
      }
    }

    if (autoPublish) {
      try {
        const { data: channels } = await supabase
          .from('social_channels_v2')
          .select('id, platform')
          .eq('is_active', true)
          .in('platform', ['youtube', 'tiktok', 'facebook']);

        if (channels && channels.length > 0) {
          const jobsToCreate = [];
          for (const channel of channels) {
            const { data: platformAsset } = await supabase
              .from('content_assets')
              .select('id')
              .eq('knowledge_asset_id', contentAsset.knowledge_asset_id)
              .eq('platform', channel.platform)
              .eq('format', 'video')
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            jobsToCreate.push({
              content_asset_id: platformAsset?.id || contentAssetId,
              channel_id: channel.id,
              status: 'queued',
              created_by: 'lesson-loop-auto-publish',
            });
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
