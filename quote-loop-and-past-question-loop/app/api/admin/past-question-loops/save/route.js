// app/api/admin/past-question-loops/save/route.js
//
// Same shape as quote-loops/save/route.js on purpose: PastQuestionLoopRecorder
// uploads the finished clip straight to Supabase storage itself; this route
// only does the write RLS doesn't let the browser client do directly —
// insert/update the media_files row against the already-existing
// content_assets draft — then marks it approved so it shows up in the
// Social Engine review dashboard exactly like quote_loop.
//
// This whole route is a single fast round trip: no LLM call, no multi-step
// enrichment chain in the request path. That matters — a save route that
// awaits a slow AI call before writing status:'approved' is the classic way
// a save looks like it silently did nothing on a platform with a hard
// function time limit (Vercel Hobby). Keep it that way if this ever grows.

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
    .eq('asset_type', 'past_question_loop')
    .single();
  if (fetchError || !contentAsset) {
    return NextResponse.json({ error: 'Past-question-loop content asset not found' }, { status: 404 });
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

  return NextResponse.json({ success: true, videoUrl });
}
