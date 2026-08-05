// app/api/admin/past-question-loops/generate/route.js
//
// Past Question Loop, step 1 — same shape as quote-loops/generate: turn one
// knowledge_assets row into several JAMB/WAEC/NECO-style MCQ drafts (via
// the shared LLM fallback chain), pick a background candidate for each,
// and save each as a draft content_assets row with asset_type =
// 'past_question_loop'. Deliberately reuses content_assets/media_files —
// no new tables — so this rides the exact same Social Engine review,
// approval, and publish_jobs pipeline quote_loop already goes through.
//
// Nothing is recorded yet — an admin opens /admin/past-question-loops,
// picks a draft, and records it with PastQuestionLoopRecorder (mirrors the
// quote-loop flow: generate the "script" first, record after).

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

async function generateQuestions(asset, count) {
  const keyConcepts = (asset.key_concepts || []).slice(0, 5).join(', ') || 'none listed';
  const facts = (asset.facts || []).slice(0, 5).join('; ') || 'none listed';

  const prompt = `You are writing JAMB/WAEC/NECO/Post-UTME style past-question multiple-choice questions for Shiney Brain Academy, a Nigerian exam-prep brand. Each one gets rendered as a short quiz-reveal video: the question and 4 options show first, then the correct option highlights and a short explanation appears underneath.

Topic: "${asset.keyword}"
Subject: ${asset.subject || 'General'}
Summary: ${asset.summary || 'No summary available.'}
Key concepts: ${keyConcepts}
Facts: ${facts}

Write ${count} different past-question-style MCQs grounded in this topic. Rules:
- Each question has exactly 4 options labelled A-D, plausible distractors (no giveaway options like "all of the above" or an obviously silly choice).
- Exactly one correct option per question.
- Keep the question itself under 30 words so it fits on a 9:16 frame.
- The explanation should be 2-3 sentences (roughly 25-45 words): state why the correct option is right, briefly say why the strongest distractor is wrong if useful, and stay grounded in the topic above.
- No hashtags, no emoji, no quotation marks.
- Vary difficulty and angle across the set — don't make every question test the exact same fact.
- Also write a "visualHint" — 3-6 words describing a specific, concrete, filmable scene for the background footage (e.g. "student writing notes at desk", "chalkboard equation close-up"), different for each question.

Return ONLY JSON:
{ "questions": [{ "question": "...", "options": [{"id":"A","text":"..."},{"id":"B","text":"..."},{"id":"C","text":"..."},{"id":"D","text":"..."}], "correctOptionId": "A", "explanation": "...", "visualHint": "..." }, ...] }`;

  const { result, errors } = await generateWithFallback(
    prompt,
    (text) => parseJsonFromText(text, 'object'),
    (parsed) =>
      parsed &&
      Array.isArray(parsed.questions) &&
      parsed.questions.length > 0 &&
      parsed.questions.every(
        (q) =>
          q &&
          q.question &&
          Array.isArray(q.options) &&
          q.options.length === 4 &&
          q.options.every((o) => o && o.id && o.text) &&
          ['A', 'B', 'C', 'D'].includes(q.correctOptionId) &&
          q.explanation
      ),
    2560
  );

  if (!result) {
    throw new Error(
      `Past-question generation failed across all providers.${errors?.length ? ' Errors: ' + errors.join('; ') : ''}`
    );
  }
  return result.questions.slice(0, count);
}

// Identical to quote-loops/generate's findBackgroundCandidate — kept as its
// own copy rather than a shared import, matching how quote-loops/generate
// itself is a self-contained route file in this codebase.
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

  let questions;
  try {
    questions = await generateQuestions(asset, Math.min(Math.max(count, 1), 20));
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }

  const fallbackQuery = [asset.subject, asset.keyword].filter(Boolean).join(' ');
  const backgroundQueries = questions.map((q) => q.visualHint || fallbackQuery);

  const usedUrls = new Set();
  const backgrounds = await Promise.all(
    backgroundQueries.map((query) => findBackgroundCandidate(query, usedUrls))
  );

  const toInsert = questions.map((q, i) => ({
    knowledge_asset_id: knowledgeAssetId,
    asset_type: 'past_question_loop',
    platform: null, // format-agnostic, same as quote_loop — publishable to any platform's queue
    format: 'video',
    title: asset.keyword,
    body: q.question,
    status: 'draft',
    generated_by: 'past-question-loop-generator',
    metadata: {
      options: q.options,
      correctOptionId: q.correctOptionId,
      explanation: q.explanation,
      subject: asset.subject || null,
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
      ? [`${missingBackground} of ${inserted.length} questions got no background candidate — you can still record them with a canvas-only gradient background.`]
      : [],
  });
}
