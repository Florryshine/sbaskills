// app/api/admin/countdown-loops/generate/route.js
//
// Countdown Loop, step 1 — same shape as quote-loops/generate and
// past-question-loops/generate: turn one knowledge_assets row into several
// "3 things costing you marks in X" countdown drafts (via the shared LLM
// fallback chain), pick ONE background candidate per draft (the whole
// countdown plays as a single continuous clip, unlike quote-loops where
// each headline+followUp is its own row), and save each as a draft
// content_assets row with asset_type = 'countdown_loop'. Reuses
// content_assets/media_files — no new tables — so this rides the same
// Social Engine review/approval/publish_jobs pipeline the other loops do.
//
// Nothing is recorded yet — an admin opens /admin/countdown-loops, picks a
// draft, and records it with CountdownLoopRecorder (mirrors the
// quote-loop/past-question-loop flow: generate the "script" first, record
// after).

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

async function generateCountdowns(asset, count) {
  const keyConcepts = (asset.key_concepts || []).slice(0, 5).join(', ') || 'none listed';
  const facts = (asset.facts || []).slice(0, 5).join('; ') || 'none listed';

  const prompt = `You are writing "3 things costing you marks" countdown scripts for Shiney Brain Academy, a Nigerian exam-prep brand (JAMB/WAEC/NECO/Post-UTME). Each one gets rendered as a short countdown-reveal video: rank #3 appears first, then #2, then #1 (biggest, gets extra time on screen) — the countdown format itself is the hook, since a viewer who sees "3 things" can't leave before seeing #1.

Each countdown needs:
- A "title" — under 10 words, states the countdown's premise (e.g. "3 things costing you marks in [topic]"). This is the card that opens the video.
- Exactly 3 "items", ranked 3, 2, 1. Rank 1 MUST be the single highest-stakes, most damaging habit — the one that genuinely costs the most marks or causes the most repeat mistakes. Escalate real stakes from rank 3 to rank 1; don't just reorder equally-important points, since a countdown that doesn't escalate kills the format.
- Each item has a "point" (a short punchy name for the habit/mistake, under 8 words) and a "detail" (1-2 sentences, roughly 20-35 words) that opens with the COST (marks lost, time wasted, how often it trips students up) before explaining the fix — trap/stakes-first, same as an explanation should never just flatly state the answer first.
- A "cta" — one short closing line (under 12 words) that lands on the #1 item specifically, e.g. "Fix #1 first — it's the one that really hurts".
- A "visualHint" on the #1 item only — 3-6 words describing a specific, concrete, filmable scene for the whole video's background (e.g. "student staring at exam clock", "red pen marking wrong answer").

Topic: "${asset.keyword}"
Subject: ${asset.subject || 'General'}
Summary: ${asset.summary || 'No summary available.'}
Key concepts: ${keyConcepts}
Facts: ${facts}

Write ${count} different countdown sets grounded in this topic. Rules:
- No hashtags, no emoji, no quotation marks around any part.
- Every item must be a real, specific habit or mistake tied to this topic — no generic "study harder" filler that could apply to any subject.
- Each countdown in the batch should take a different angle (e.g. one about calculation mistakes, one about misreading the question, one about timing/pacing) so a batch of ${count} doesn't repeat the same 3 points reworded.
- Rank 1's detail should feel like the "real" reveal — the thing the viewer watched the whole video to find out.

Return ONLY JSON:
{ "countdowns": [{ "title": "...", "items": [{"rank":3,"point":"...","detail":"..."},{"rank":2,"point":"...","detail":"..."},{"rank":1,"point":"...","detail":"...","visualHint":"..."}], "cta": "..." }, ...] }`;

  const { result, errors } = await generateWithFallback(
    prompt,
    (text) => parseJsonFromText(text, 'object'),
    (parsed) =>
      parsed &&
      Array.isArray(parsed.countdowns) &&
      parsed.countdowns.length > 0 &&
      parsed.countdowns.every(
        (c) =>
          c &&
          c.title &&
          Array.isArray(c.items) &&
          c.items.length === 3 &&
          c.items.every((it) => it && it.rank && it.point && it.detail) &&
          c.cta
      ),
    2560
  );

  if (!result) {
    throw new Error(
      `Countdown generation failed across all providers.${errors?.length ? ' Errors: ' + errors.join('; ') : ''}`
    );
  }
  return result.countdowns.slice(0, count);
}

// Identical technique to quote-loops/generate and past-question-loops/generate's
// findBackgroundCandidate — kept as its own copy, matching how each loop
// generator in this codebase is a self-contained route file.
async function findBackgroundCandidate(query, usedUrls) {
  for (const search of [searchPexelsVideoMulti, searchPixabayVideoMulti]) {
    try {
      const hits = await search(query, 8);
      const fresh = hits.filter((h) => !usedUrls.has(h.url));
      const pool = fresh.length > 0 ? fresh : hits;
      if (pool.length > 0) {
        const pick = pool[Math.floor(Math.random() * pool.length)];
        usedUrls.add(pick.url);
        return { type: 'video', url: pick.url, source: pick.source, sourceUrl: pick.sourceUrl };
      }
    } catch (err) {
      console.warn(`Background video search failed (${search.name}):`, err.message);
    }
  }
  for (const search of [searchPexelsMulti, searchPixabayMulti]) {
    try {
      const hits = await search(query, 8);
      const fresh = hits.filter((h) => !usedUrls.has(h.url));
      const pool = fresh.length > 0 ? fresh : hits;
      if (pool.length > 0) {
        const pick = pool[Math.floor(Math.random() * pool.length)];
        usedUrls.add(pick.url);
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

  let countdowns;
  try {
    countdowns = await generateCountdowns(asset, Math.min(Math.max(count, 1), 20));
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }

  const fallbackQuery = [asset.subject, asset.keyword].filter(Boolean).join(' ');
  // One background per whole countdown (not per item) — the #1 item's
  // visualHint is the most specific/dramatic scene description, so it
  // drives the search; falls back to subject+keyword if the model omitted it.
  const backgroundQueries = countdowns.map((c) => {
    const rank1 = c.items.find((it) => it.rank === 1);
    return rank1?.visualHint || fallbackQuery;
  });

  const usedUrls = new Set();
  const backgrounds = await Promise.all(
    backgroundQueries.map((query) => findBackgroundCandidate(query, usedUrls))
  );

  const toInsert = countdowns.map((c, i) => ({
    knowledge_asset_id: knowledgeAssetId,
    asset_type: 'countdown_loop',
    platform: null, // format-agnostic, same as quote_loop/past_question_loop — publishable to any platform's queue
    format: 'video',
    title: asset.keyword,
    body: c.title,
    status: 'draft',
    generated_by: 'countdown-loop-generator',
    metadata: {
      items: c.items.sort((a, b) => b.rank - a.rank), // ensure 3,2,1 order regardless of model output order
      cta: c.cta,
      background: backgrounds[i],
      backgroundQuery: backgroundQueries[i],
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
      ? [`${missingBackground} of ${inserted.length} countdowns got no background candidate — you can still record them with a canvas-only gradient background.`]
      : [],
  });
}
