// app/api/admin/teaching-loops/generate/route.js
//
// Turns one knowledge_assets row into ONE "teaching_loop" content_assets
// draft: a punchy ~2 minute script of short text cards (see
// lib/content-factory/generators/teaching-loop.js) + one background
// candidate (real stock video preferred, falls back to a photo — same
// searchPexelsVideoMulti/searchPixabayVideoMulti/...Multi helpers
// quote-loops/generate/route.js already uses). That's it — nothing is
// rendered here. An admin opens /admin/teaching-loops, picks this draft,
// and records it with TeachingLoopRecorder (canvas + Web Audio +
// MediaRecorder, entirely in the browser, same technique as
// QuoteLoopRecorder/PastQuestionLoopRecorder — no Remotion, no laptop
// worker, no video_scripts row).

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { generateTeachingScript, estimateSegmentTimings } from '@/lib/content-factory/generators/teaching-loop';
import {
  searchPexelsVideoMulti,
  searchPixabayVideoMulti,
  searchPexelsMulti,
  searchPixabayMulti,
} from '@/lib/image-search';

// Single background for the whole clip (unlike quote-loops, which picks one
// per short line) — same fallback order: real footage first, photo second.
async function findBackgroundCandidate(query) {
  for (const search of [searchPexelsVideoMulti, searchPixabayVideoMulti]) {
    try {
      const hits = await search(query, 5);
      if (hits.length > 0) {
        const pick = hits[Math.floor(Math.random() * hits.length)];
        return { type: 'video', url: pick.url, source: pick.source, sourceUrl: pick.sourceUrl };
      }
    } catch (err) {
      console.warn(`Background video search failed (${search.name}):`, err.message);
    }
  }
  for (const search of [searchPexelsMulti, searchPixabayMulti]) {
    try {
      const hits = await search(query, 5);
      if (hits.length > 0) {
        const pick = hits[Math.floor(Math.random() * hits.length)];
        return { type: 'photo', url: pick.url, source: pick.source, sourceUrl: pick.sourceUrl };
      }
    } catch (err) {
      console.warn(`Background photo search failed (${search.name}):`, err.message);
    }
  }
  return null;
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { knowledgeAssetId } = body || {};
  if (!knowledgeAssetId) {
    return NextResponse.json({ error: 'knowledgeAssetId is required' }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: asset, error: assetError } = await supabase
    .from('knowledge_assets')
    .select('*')
    .eq('id', knowledgeAssetId)
    .single();
  if (assetError || !asset) {
    return NextResponse.json({ error: 'Knowledge asset not found' }, { status: 404 });
  }

  let script;
  try {
    script = await generateTeachingScript(asset);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }

  const background = await findBackgroundCandidate(script.visualQuery);
  const timings = estimateSegmentTimings(script.segments);
  const segmentsWithTiming = script.segments.map((seg, i) => ({ ...seg, holdSeconds: timings[i] }));
  const estimatedSeconds = Math.round(timings.reduce((a, b) => a + b, 0));

  const { data: inserted, error: insertError } = await supabase
    .from('content_assets')
    .insert({
      knowledge_asset_id: knowledgeAssetId,
      asset_type: 'teaching_loop',
      platform: null, // format-agnostic, same as quote_loop — publishable to any platform's queue once recorded
      format: 'video',
      title: script.title,
      body: script.segments.map((s) => s.text).join(' '),
      status: 'draft',
      generated_by: 'teaching-loop-generator',
      metadata: {
        description: script.description,
        tags: script.tags,
        hashtags: script.hashtags,
        segments: segmentsWithTiming,
        background,
        backgroundQuery: script.visualQuery,
        estimated_seconds: estimatedSeconds,
      },
    })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    contentAsset: inserted,
    warnings: background ? [] : ['No background candidate found — you can still record it on a canvas-only gradient background.'],
  });
}
