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

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { contentAssetId, videoUrl, durationSeconds } = body || {};
  if (!contentAssetId || !videoUrl) {
    return NextResponse.json({ error: 'contentAssetId and videoUrl are required' }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: contentAsset, error: fetchError } = await supabase
    .from('content_assets')
    .select('id, title, asset_type')
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

  await supabase.from('content_assets').update({ status: 'approved' }).eq('id', contentAssetId);

  return NextResponse.json({ success: true, videoUrl });
}
