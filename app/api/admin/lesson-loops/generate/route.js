// app/api/admin/lesson-loops/generate/route.js
//
// The "authority machine" loop type — turns a knowledge_assets row into a
// ~2-minute landscape (16:9) micro-lesson: hook -> teach -> example ->
// answer -> CTA, each segment narrated server-side (synthesizeLine, the
// Render-hosted TTS endpoint already used by the podcast engine — the
// local-only edge-tts-universal path in lib/video-engine/narration.js
// can't run here, see that file's header) and given its own background
// candidate. Unlike quote-loops/meme-loops this is landscape, matching a
// real YouTube video upload rather than a Shorts/Reels loop, and carries
// full per-platform metadata (YouTube title+description+tags, Facebook
// caption, TikTok caption+hashtags) since a 2-minute video needs a real
// description, not just a caption line.
//
// Follows the exact same fast-return + background-pipeline shape as
// lib/podcastGenerate.js (createPodcastEpisodeRow + runPodcastEpisodePipeline
// via runInBackground) — see that file's header for why: script+narration
// for several segments can run close to Vercel's per-invocation time
// budget, so this route creates the content_assets row as status
// 'generating' and returns immediately with its id; the client polls
// /api/admin/lesson-loops/status the same way podcast/paste's page polls
// /api/content-engine/podcast/status. Recording (LessonLoopRecorder) plays
// every segment's real MP3 in sequence and captures canvas+audio live,
// same technique as AudiogramRecorder.

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { generateWithFallback } from '@/lib/llmFallbackChain';
import { parseJsonFromText } from '@/lib/robustJsonParse';
import { synthesizeLine, estimateDurationSeconds } from '@/lib/podcastTTS';
import { PLATFORM_LIMITS } from '@/lib/content-factory/generators/_shared';
import { runInBackground } from '@/lib/backgroundTask';
import {
  searchPexelsVideoMulti,
  searchPixabayVideoMulti,
  searchPexelsMulti,
  searchPixabayMulti,
} from '@/lib/image-search';

export const maxDuration = 60;

const BUCKET = 'lesson-loops';
const TTS_CONCURRENCY = 4; // same value/reasoning as podcastGenerate.js

const EMOTION_BY_TYPE = {
  hook: 'excited',
  teach: 'curious',
  example: 'playful',
  answer: 'emphatic',
  cta: 'excited',
};

const SEGMENT_TYPE_LABEL = {
  hook: '🎯 HOOK',
  teach: '📘 KEY IDEA',
  example: '🧠 EXAMPLE',
  answer: '✅ ANSWER',
  cta: '🔔 FOLLOW',
};

async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;
  async function runNext() {
    while (next < items.length) {
      const i = next++;
      results[i] = await worker(items[i], i);
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, runNext);
  await Promise.all(workers);
  return results;
}

async function generateLessonScript(asset) {
  const keyConcepts = (asset.key_concepts || []).slice(0, 6).join(', ') || 'none listed';
  const facts = (asset.facts || []).slice(0, 6).join('; ') || 'none listed';

  const prompt = `You are scripting a 2-minute landscape (16:9) micro-lesson video for Shiney Brain Academy, a Nigerian exam-prep brand (JAMB/WAEC/NECO/Post-UTME). This is the "authority machine" format — real teaching, not just a hook, meant to be uploaded as a genuine YouTube video (not a Short/Reel) and cross-posted to Facebook and TikTok as landscape content.

Structure — return a "segments" array in this exact order and these exact "type" values:
1. type "hook" (one segment, ~15-25 words spoken): a scroll-stopping opening line using a real hook formula — stakes ("this mistake costs you X marks"), a confident claim, a curiosity gap, or a pattern interrupt. Must be honestly earned by what follows, not empty clickbait.
2. type "teach" (2 to 4 segments, ~40-55 words spoken each): the actual lesson, broken into digestible beats — one idea per segment, building logically. This is the substance; don't pad it, and don't just restate the hook.
3. type "example" (one segment, ~30-45 words spoken): a concrete worked example or a quick question the viewer can try to answer, grounded in the actual concept just taught.
4. type "answer" (one segment, ~30-45 words spoken): reveal + explain the example/question's answer — the "why", not just the "what".
5. type "cta" (one segment, ~10-18 words spoken): a warm, direct call to action — follow for another lesson, not a generic "like and subscribe".

For EVERY segment also write:
- "onScreenText" — a short on-screen keyword/caption, 3-8 words, NOT a repeat of the full spoken text — this is what a viewer scrolling with sound off sees and reads in under 2 seconds.
- "visualHint" — 3-6 words describing a specific, concrete, filmable landscape scene matching this segment's content (e.g. "student solving equation whiteboard", "clock ticking exam hall", "close-up textbook diagram"). Each segment's visualHint should describe a genuinely different scene from the others.

Topic: "${asset.keyword}"
Subject: ${asset.subject || 'General'}
Summary: ${asset.summary || 'No summary available.'}
Key concepts: ${keyConcepts}
Facts: ${facts}

Also write platform metadata for the finished 2-minute video:
- "youtube": { "title" (unique, specific, under ${PLATFORM_LIMITS.youtube.title} characters, built from the hook/topic, not generic), "description" (a genuinely detailed YouTube description: 3-5 sentences summarizing what the lesson covers and who it's for, naturally including the topic/subject/exam keywords for search, under ${PLATFORM_LIMITS.youtube.description} characters — this is a real description, not a caption), "tags" (8-12 lowercase SEO keyword phrases) }
- "facebook": { "caption" (2-4 sentences, conversational, inviting comments/shares, can be longer than a tweet — Facebook rewards a real caption, not just a headline) }
- "tiktok": { "caption" (short, punchy, under 150 characters, hook-forward since TikTok captions get cut off fast), "hashtags" (5-8 hashtags with #, mixing topic-specific and #jamb #waec #studytok style tags) }

Rules:
- Total spoken word count across all segments should land around 260-320 words (roughly 100-130 seconds of narration at natural speaking pace) — don't run dramatically short or long of that.
- The teach segments must deliver real, correct educational substance grounded in the topic above — this is the credibility-building format, get the facts right.
- Vary sentence rhythm — this is spoken narration, not written prose; write it the way a confident teacher actually talks, contractions are fine.

Return ONLY JSON:
{
  "segments": [{ "type": "...", "text": "...", "onScreenText": "...", "visualHint": "..." }, ...],
  "youtube": { "title": "...", "description": "...", "tags": ["...", ...] },
  "facebook": { "caption": "..." },
  "tiktok": { "caption": "...", "hashtags": ["...", ...] }
}`;

  const { result, errors } = await generateWithFallback(
    prompt,
    (text) => parseJsonFromText(text, 'object'),
    (parsed) =>
      parsed &&
      Array.isArray(parsed.segments) &&
      parsed.segments.length >= 5 &&
      parsed.segments.every((s) => s && s.type && s.text) &&
      parsed.youtube?.title &&
      parsed.youtube?.description &&
      parsed.facebook?.caption &&
      parsed.tiktok?.caption,
    3500
  );

  if (!result) {
    throw new Error(
      `Lesson script generation failed across all providers.${errors?.length ? ' Errors: ' + errors.join('; ') : ''}`
    );
  }
  return result;
}

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

async function uploadSegmentAudio(supabase, contentAssetId, position, buffer) {
  const path_ = `${contentAssetId}/audio/${String(position).padStart(2, '0')}.mp3`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path_, buffer, { contentType: 'audio/mpeg', upsert: true });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path_);
  return urlData.publicUrl;
}

/**
 * The actual script -> narration -> backgrounds pipeline, run via
 * runInBackground so the route itself can return fast. Mirrors
 * runPodcastEpisodePipeline's status handling: 'generating' -> 'draft' on
 * success, 'generating' -> 'failed' (with error_message) if the script
 * itself can't be produced. Same maxDuration ceiling caveat applies — see
 * podcastGenerate.js's runPodcastEpisodePipeline header.
 */
async function runLessonLoopPipeline(contentAssetId, asset) {
  const supabase = createAdminClient();

  let script;
  try {
    script = await generateLessonScript(asset);
  } catch (err) {
    await supabase
      .from('content_assets')
      .update({ status: 'failed', metadata: { error_message: err.message.slice(0, 2000) } })
      .eq('id', contentAssetId);
    return;
  }

  const usedUrls = new Set();
  const fallbackQuery = [asset.subject, asset.keyword].filter(Boolean).join(' ');

  const segmentsWithMedia = await mapWithConcurrency(script.segments, TTS_CONCURRENCY, async (seg, i) => {
    const [background, audioResult] = await Promise.all([
      findBackgroundCandidate(seg.visualHint || fallbackQuery, usedUrls),
      (async () => {
        const emotion = EMOTION_BY_TYPE[seg.type] || 'neutral';
        try {
          const buffer = await synthesizeLine(seg.text, 'host_a', emotion);
          const audioUrl = await uploadSegmentAudio(supabase, contentAssetId, i, buffer);
          return { audioUrl };
        } catch (err) {
          console.warn(`Segment ${i} (${seg.type}) narration failed:`, err.message);
          return { audioUrl: null };
        }
      })(),
    ]);

    return {
      type: seg.type,
      label: SEGMENT_TYPE_LABEL[seg.type] || seg.type.toUpperCase(),
      text: seg.text,
      onScreenText: seg.onScreenText,
      visualHint: seg.visualHint,
      audioUrl: audioResult.audioUrl,
      durationSeconds: estimateDurationSeconds(seg.text),
      background,
    };
  });

  const totalDuration = segmentsWithMedia.reduce((sum, s) => sum + (s.durationSeconds || 0), 0);
  const hookSegment = segmentsWithMedia.find((s) => s.type === 'hook');

  await supabase
    .from('content_assets')
    .update({
      title: script.youtube.title,
      body: hookSegment?.text || asset.keyword,
      status: 'draft',
      metadata: {
        youtube: script.youtube,
        facebook: script.facebook,
        tiktok: script.tiktok,
        segments: segmentsWithMedia,
        totalDurationSeconds: totalDuration,
      },
    })
    .eq('id', contentAssetId);
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

  const { data: contentAsset, error: insertError } = await supabase
    .from('content_assets')
    .insert({
      knowledge_asset_id: knowledgeAssetId,
      asset_type: 'lesson_loop',
      platform: null,
      format: 'video',
      title: asset.keyword,
      body: asset.keyword,
      status: 'generating',
      generated_by: 'lesson-loop-generator',
      metadata: {},
    })
    .select()
    .single();

  if (insertError || !contentAsset) {
    return NextResponse.json({ error: insertError?.message || 'Failed to create draft' }, { status: 500 });
  }

  const response = NextResponse.json({ success: true, contentAssetId: contentAsset.id, status: 'generating' });

  runInBackground(() => runLessonLoopPipeline(contentAsset.id, asset));

  return response;
}
