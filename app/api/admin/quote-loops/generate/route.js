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

  const prompt = `You are writing short motivational/study-tip lines for Shiney Brain Academy, a Nigerian exam-prep brand (JAMB/WAEC/NECO/Post-UTME). These get overlaid on a short looping 9:16 video (about 6 seconds, replaying continuously), so each one has TWO parts that reveal in sequence:
1. A "headline" — the hook, appears immediately, under 8 words, the kind of line that stops a scroll.
2. A "followUp" — a real supporting paragraph, NOT a single sentence. Aim for 4-5 lines of body copy (roughly 35-55 words) that fills the lower half of the screen: unpack the headline, add the "why" or "how", give a concrete detail or mini-example, and land on a payoff or call to action. Think of the text-heavy caption style used in Facebook Reels quote videos — it should read as a short, complete paragraph, not a caption fragment.

HOOK RULES for the headline — this is what makes people stop scrolling instead of swiping past. Every headline must do a pattern-interrupt: open with a number, a direct callout, or a warning — never a generic statement of fact. Pull from these formulas (vary which one across the batch, don't reuse the same formula twice):
- Stakes/number callout: "90% of JAMB students lose marks here" / "This costs you 10 marks"
- Score-based direct address: "If you're scoring below 200, stop"
- Mistake warning: "Stop. You're about to get this wrong"
- Curiosity gap: "Nobody tells you this about [topic]" — must be resolved in the followUp, not left hanging
- Myth-bust: "This 'fact' about [topic] is wrong"
- Confrontation/challenge: "Think you know [topic]? Prove it"
The headline creates the gap; it must NOT give away the payoff — that's the followUp's job. Keep every hook grounded in something real about the topic (an actual common mistake, an actual mark-losing habit) — earn the attention without sacrificing credibility. No fake stats, no manufactured urgency that isn't true.

The followUp must reward the click fast: its first sentence should deliver the actual payoff (the answer, the mistake, the "why") within the first few words — don't make the reader wait through throat-clearing to get the substance.

Also write a "visualHint" — 3-6 words describing a specific, concrete, filmable scene for the background footage (e.g. "student writing notes at desk", "clock ticking exam hall", "sunrise over Lagos rooftops"). Make it visually specific to THIS line, not just a repeat of the topic name, so each line in the batch can get a different background.

Topic: "${asset.keyword}"
Subject: ${asset.subject || 'General'}
Summary: ${asset.summary || 'No summary available.'}
Key concepts: ${keyConcepts}
Facts: ${facts}

Write ${count} different headline+followUp+visualHint sets grounded in this topic. Rules:
- No hashtags, no emoji, no quotation marks around any part.
- The followUp must genuinely unpack and pay off the headline with real substance — not padding, not repetition in other words.
- Each headline must use a DIFFERENT hook formula from the list above — unpredictability across the set matters as much as any single hook, since a batch that's all the same shape gets ignored.
- Must actually connect to the topic above, not generic filler that could apply to anything.
- Each visualHint should describe a genuinely different scene from the others in the set, so a stock search doesn't keep returning the same clip.

Return ONLY JSON:
{ "lines": [{ "headline": "...", "followUp": "...", "visualHint": "..." }, ...] }`;

  const { result, errors } = await generateWithFallback(
    prompt,
    (text) => parseJsonFromText(text, 'object'),
    (parsed) =>
      parsed &&
      Array.isArray(parsed.lines) &&
      parsed.lines.length > 0 &&
      parsed.lines.every((l) => l && l.headline && l.followUp),
    2048
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
//
// `usedUrls` is shared across the whole batch (passed in by the caller) so
// that when several lines in one generate call land on overlapping queries,
// a clip already claimed by an earlier line in the batch gets skipped in
// favor of the next-best candidate instead of repeating.
async function findBackgroundCandidate(query, usedUrls) {
  for (const search of [searchPexelsVideoMulti, searchPixabayVideoMulti]) {
    try {
      // Pull a wider pool (8 instead of 3) so there's room to skip anything
      // already used elsewhere in this batch on a niche query.
      const hits = await search(query, 8);
      const fresh = hits.filter((h) => !usedUrls.has(h.url));
      const pool = fresh.length > 0 ? fresh : hits; // fall back to a repeat rather than nothing
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

  let lines;
  try {
    lines = await generateQuoteLines(asset, Math.min(Math.max(count, 1), 20));
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }

  const fallbackQuery = [asset.subject, asset.keyword].filter(Boolean).join(' ');
  // Per-line query: each line's own visualHint (specific, filmable scene)
  // falls back to the generic subject+keyword only if the model didn't
  // supply one — this is what stops every line in a batch from searching
  // the identical query and landing on the same clip.
  const backgroundQueries = lines.map((line) => line.visualHint || fallbackQuery);

  // Shared across the whole batch so a clip claimed by an earlier line gets
  // skipped for later lines on an overlapping/niche query. Still fetched
  // concurrently — the dedup check happens synchronously per-response, so
  // there's no race despite running in parallel.
  const usedUrls = new Set();
  const backgrounds = await Promise.all(
    backgroundQueries.map((query) => findBackgroundCandidate(query, usedUrls))
  );

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
      ? [`${missingBackground} of ${inserted.length} lines got no background candidate — you can still record them with a canvas-only gradient background.`]
      : [],
  });
}
