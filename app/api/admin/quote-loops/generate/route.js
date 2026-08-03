// app/api/admin/quote-loops/generate/route.js
//
// Step 1 of the quote-loop feature: turn one knowledge_assets row into
// several short, punchy, quote-loop-ready lines (via the shared LLM
// fallback chain — same pattern as every other content-factory generator),
// pick a background candidate for each (real stock video preferred, falls
// back to a photo — see lib/image-search.js's video/photo search funcs),
// and save each as a draft content_assets row.
//
// Nothing is recorded yet at this point — asset_type='quote_loop' rows sit
// in 'draft' with no media_files row until an admin opens
// /admin/quote-loops, picks one, and records it with QuoteLoopRecorder
// (mirrors the audiogram flow: generate the "script" first, record after).

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { generateWithFallback } from '@/lib/llmFallbackChain';
import { parseJsonFromText } from '@/lib/robustJsonParse';
import {
  searchPexelsVideoMulti,
  searchPixabayVideoMulti,
  searchPexelsMulti,
  searchPixabayMulti,
} from '@/lib/image-search';

async function generateQuoteLines(asset, count) {
  const keyConcepts = (asset.key_concepts || []).slice(0, 5).join(', ') || 'none listed';
  const facts = (asset.facts || []).slice(0, 5).join('; ') || 'none listed';

  const prompt = `You are writing short motivational/study-tip lines for Shiney Brain Academy, a Nigerian exam-prep brand (JAMB/WAEC/NECO/Post-UTME). These get overlaid on a short looping video (about 4 seconds, replaying continuously), so each one has TWO parts that reveal in sequence:
1. A "headline" — the hook, appears immediately, under 8 words, the kind of line that stops a scroll.
2. A "followUp" — one supporting sentence that completes the thought or delivers the payoff, appears a beat later. Slightly longer than the headline (roughly 8-14 words) is fine — the point is the viewer needs to watch the loop replay once or twice to catch both parts, which is good: it means they watch longer.

Topic: "${asset.keyword}"
Subject: ${asset.subject || 'General'}
Summary: ${asset.summary || 'No summary available.'}
Key concepts: ${keyConcepts}
Facts: ${facts}

Write ${count} different headline+followUp pairs grounded in this topic. Rules:
- No hashtags, no emoji, no quotation marks around either part.
- The followUp must genuinely complete or pay off the headline — not just repeat it in other words.
- Mix of styles across the set: a motivational push, a sharp study tip, a confidence line, a myth-buster, a "did you know" hook — don't make them all the same shape.
- Must actually connect to the topic above, not generic filler that could apply to anything.

Return ONLY JSON:
{ "lines": [{ "headline": "...", "followUp": "..." }, ...] }`;

  const { result, errors } = await generateWithFallback(
    prompt,
    (text) => parseJsonFromText(text, 'object'),
    (parsed) =>
      parsed &&
      Array.isArray(parsed.lines) &&
      parsed.lines.length > 0 &&
      parsed.lines.every((l) => l && l.headline && l.followUp),
    1536
  );

  if (!result) {
    throw new Error(
      `Quote generation failed across all providers.${errors?.length ? ' Errors: ' + errors.join('; ') : ''}`
    );
  }
  return result.lines.slice(0, count);
}

// Real footage first (Pexels then Pixabay video), photo as a fallback so a
// draft is never left with zero background candidates just because a topic
// has thin video stock coverage.
async function findBackgroundCandidate(query) {
  for (const search of [searchPexelsVideoMulti, searchPixabayVideoMulti]) {
    try {
      const hits = await search(query, 3);
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
      const hits = await search(query, 3);
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

  const { knowledgeAssetId, count = 5 } = body || {};
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

  let lines;
  try {
    lines = await generateQuoteLines(asset, Math.min(Math.max(count, 1), 20));
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }

  const backgroundQuery = [asset.subject, asset.keyword].filter(Boolean).join(' ');

  // Backgrounds are fetched in parallel — they're independent HTTP calls to
  // Pexels/Pixabay, no reason to wait on them one at a time.
  const backgrounds = await Promise.all(lines.map(() => findBackgroundCandidate(backgroundQuery)));

  const toInsert = lines.map((line, i) => ({
    knowledge_asset_id: knowledgeAssetId,
    asset_type: 'quote_loop',
    platform: null, // format-agnostic, same as podcast_audiogram — publishable to any platform's queue
    format: 'video',
    title: asset.keyword,
    body: line.headline,
    status: 'draft',
    generated_by: 'quote-loop-generator',
    metadata: {
      followUp: line.followUp,
      background: backgrounds[i], // { type: 'video'|'photo', url, source, sourceUrl } or null
      backgroundQuery,
    },
  }));

  const { data: inserted, error: insertError } = await supabase
    .from('content_assets')
    .insert(toInsert)
    .select();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  const missingBackground = inserted.filter((row) => !row.metadata?.background).length;

  return NextResponse.json({
    success: true,
    contentAssets: inserted,
    warnings: missingBackground > 0
      ? [`${missingBackground} of ${inserted.length} lines got no background candidate — you can still record them with a canvas-only gradient background.`]
      : [],
  });
}
