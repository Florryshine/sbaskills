// app/api/admin/meme-loops/generate/route.js
//
// Step 1 of the meme/joke-loop feature — same shape as quote-loops/generate
// (see that file's header for the full pipeline explanation): turn one
// knowledge_assets row into several short, relatable student-meme
// setup+punchline pairs, pick a background candidate for each, save each
// as a draft content_assets row with asset_type='meme_loop'. Recording
// happens later via MemeLoopRecorder on /admin/meme-loops, same
// generate-then-record split as every other loop type.

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

const LAUGH_EMOJI_POOL = ['😂', '🤣', '😭', '💀', '😩', '🙃', '😅'];

async function generateMemeLines(asset, count) {
  const keyConcepts = (asset.key_concepts || []).slice(0, 5).join(', ') || 'none listed';

  const prompt = `You are writing short, relatable student memes/jokes for Shiney Brain Academy, a Nigerian exam-prep brand (JAMB/WAEC/NECO/Post-UTME). These are the "reach machine" content type — not directly educational, just funny enough that students share them and follow the page. They get overlaid on a short looping 9:16 video (about 8 seconds, replaying continuously), structured like the text-heavy meme format used on Nigerian student meme pages:

1. A "setup" — the relatable situation/scenario, appears first and holds for a couple seconds. Under 16 words. Written in the shared first/second-person voice students actually use to caption memes — "When you...", "Me: ... Also me: ...", "POV: ...", "Nobody: ... Me:...", "That moment when...". This should immediately be recognizable as "oh no, that's literally me."
2. A "punchline" — the funny twist/turn, revealed a beat after the setup. Under 12 words. This is the payoff — it should land, not just restate the setup.
3. An "emojis" array — 2 to 4 laugh/reaction emoji from this exact pool only: ${LAUGH_EMOJI_POOL.join(' ')}. Pick ones that match the specific flavor of the joke (💀 for "I'm dead" energy, 😭 for pained-laughter, 🤣 for pure comedy, 😩 for exhausted-relatable), not just the same 😂😂😂 every time.

Also write a "visualHint" — 3-6 words describing a specific, concrete, filmable scene for the background footage that matches the setup's mood (e.g. "student staring blankly at textbook", "clock on classroom wall", "student head on desk exam hall"). Make it specific to THIS joke, not a repeat of the topic name.

Topic context (use loosely — a joke connected to this subject is great when it fits naturally, but don't force curriculum facts into a joke where they don't belong; universal exam-stress/student-life humor is completely fine too): "${asset.keyword}" (${asset.subject || 'General'}). Related concepts if useful: ${keyConcepts}.

Write ${count} different setup+punchline+emojis+visualHint sets. Rules:
- No hashtags, no quotation marks around any part.
- This is laughing WITH students about shared struggle, never laughing AT them, never mocking low scores, failure, or poverty — keep it warm, self-aware, universally relatable exam/study-life humor. This is an education brand; the joke can never undercut trust in it.
- The punchline must be an actual twist or payoff, not just a rephrasing of the setup — read each pair back and ask "would someone actually laugh or wince-recognize at this."
- Vary the opening structure across the set ("When you...", "Me: / Also me:...", "POV:...", "Nobody:... Me:...", "That moment when...") — don't repeat the same opening shape twice in a row.
- Each visualHint should describe a genuinely different scene from the others in the set.

Return ONLY JSON:
{ "lines": [{ "setup": "...", "punchline": "...", "emojis": ["...", "..."], "visualHint": "..." }, ...] }`;

  const { result, errors } = await generateWithFallback(
    prompt,
    (text) => parseJsonFromText(text, 'object'),
    (parsed) =>
      parsed &&
      Array.isArray(parsed.lines) &&
      parsed.lines.length > 0 &&
      parsed.lines.every((l) => l && l.setup && l.punchline),
    2048
  );

  if (!result) {
    throw new Error(
      `Meme generation failed across all providers.${errors?.length ? ' Errors: ' + errors.join('; ') : ''}`
    );
  }

  // Sanitize emoji picks server-side too, in case a model wanders outside
  // the requested pool — cheap safety net, not just prompt-trust.
  return result.lines.slice(0, count).map((line) => ({
    ...line,
    emojis: Array.isArray(line.emojis) && line.emojis.length > 0
      ? line.emojis.filter((e) => LAUGH_EMOJI_POOL.includes(e)).slice(0, 4)
      : ['😂', '🤣'],
  }));
}

// Identical dedup/fallback strategy to quote-loops/generate — see that
// file for the full explanation of why photo is the fallback tier and why
// usedUrls is shared across the batch.
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

  let lines;
  try {
    lines = await generateMemeLines(asset, Math.min(Math.max(count, 1), 20));
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }

  const fallbackQuery = [asset.subject, asset.keyword].filter(Boolean).join(' ');
  const backgroundQueries = lines.map((line) => line.visualHint || fallbackQuery);

  const usedUrls = new Set();
  const backgrounds = await Promise.all(
    backgroundQueries.map((query) => findBackgroundCandidate(query, usedUrls))
  );

  const toInsert = lines.map((line, i) => ({
    knowledge_asset_id: knowledgeAssetId,
    asset_type: 'meme_loop',
    platform: null,
    format: 'video',
    title: asset.keyword,
    body: line.setup,
    status: 'draft',
    generated_by: 'meme-loop-generator',
    metadata: {
      punchline: line.punchline,
      emojis: line.emojis,
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
      ? [`${missingBackground} of ${inserted.length} memes got no background candidate — you can still record them with a canvas-only gradient background.`]
      : [],
  });
}
