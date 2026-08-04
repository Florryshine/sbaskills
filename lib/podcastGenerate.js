import { createAdminClient } from '@/lib/supabase-admin';
import { generateWithFallback } from '@/lib/llmFallbackChain';
import { buildPodcastPrompt, parseScriptJson, isValidScript } from '@/lib/podcastPrompt';
import { DEFAULT_PODCAST_STYLE } from '@/lib/podcastStyles';
import {
  synthesizeLine,
  estimateDurationSeconds,
  VOICES,
  getRandomEffect,
} from '@/lib/podcastTTS';
import { readFile } from 'fs/promises';
import path from 'path';

const BUCKET = 'podcast-audio';

// How many lines' TTS + upload run at once.
const TTS_CONCURRENCY = 4;

// Effect files (laugh/wow/oh) live in /public/audio/effects — read them
// straight off disk instead of doing an internal HTTP round-trip back to
// the deployment's own URL. The self-fetch approach cost a full network
// hop (DNS + TLS + a hit on the same serverless region) per effect line,
// which on a 60s-capped Hobby function was pure wasted budget for a file
// that's sitting right there in the deployment bundle.
const effectFileCache = new Map();
async function readEffectFile(effectPath) {
  if (effectFileCache.has(effectPath)) return effectFileCache.get(effectPath);
  const filePath = path.join(process.cwd(), 'public', effectPath);
  const buffer = await readFile(filePath);
  effectFileCache.set(effectPath, buffer);
  return buffer;
}

async function uploadSegmentAudio(supabase, episodeId, position, buffer) {
  const path_ = `${episodeId}/${String(position).padStart(3, '0')}.mp3`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path_, buffer, { contentType: 'audio/mpeg', upsert: true });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path_);
  return urlData.publicUrl;
}

async function synthesizeSegment(supabase, episodeId, i, line) {
  const emotion = line.emotion || 'neutral';
  const duration = estimateDurationSeconds(line.text);
  let audioUrl = null;

  try {
    const buffer = await synthesizeLine(line.text, line.speaker, emotion);
    audioUrl = await uploadSegmentAudio(supabase, episodeId, i, buffer);
  } catch (e) {
    console.error(`Segment ${i} TTS/upload failed:`, {
      message: e.message,
      speaker: line.speaker,
      text: line.text?.substring(0, 50),
    });
  }

  const segment = {
    episode_id: episodeId,
    position: i,
    speaker: line.speaker,
    text: line.text,
    emotion_tag: emotion,
    audio_url: audioUrl,
    duration_seconds: duration,
    topic: typeof line.topic === 'string' ? line.topic : null,
    keywords: Array.isArray(line.keywords) ? line.keywords : [],
    exam_tip: line.exam_tip === true,
    difficulty: ['easy', 'medium', 'hard'].includes(line.difficulty) ? line.difficulty : null,
  };

  let effectSegment = null;
  if (line.effect && line.effect !== 'none') {
    const effectPath = getRandomEffect(line.effect);
    if (effectPath) {
      try {
        const effectBuffer = await readEffectFile(effectPath);
        const effectUrl = await uploadSegmentAudio(supabase, episodeId, i + 0.5, effectBuffer);
        effectSegment = {
          episode_id: episodeId,
          position: i + 0.5,
          speaker: line.speaker,
          text: `[${line.effect}]`,
          emotion_tag: 'neutral',
          audio_url: effectUrl,
          duration_seconds: 1,
          topic: 'effect',
          keywords: [],
          exam_tip: false,
          difficulty: null,
        };
      } catch (e) {
        console.error(`Effect ${line.effect} failed:`, e.message);
      }
    }
  }

  return { segment, effectSegment, duration };
}

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

/**
 * Creates the podcast_episodes row in status 'generating' and returns it
 * immediately. Callers use this to hand a real episodeId back to the
 * client FAST (before the slow script+TTS work happens), so the route
 * itself never has to hold the HTTP connection open long enough to hit
 * Vercel's function timeout.
 */
export async function createPodcastEpisodeRow({ title, style, extra = {} }) {
  const supabase = createAdminClient();
  const { data: episode, error } = await supabase
    .from('podcast_episodes')
    .insert({
      title,
      status: 'generating',
      style: style || DEFAULT_PODCAST_STYLE,
      host_a_voice: VOICES.host_a,
      host_b_voice: VOICES.host_b,
      knowledge_asset_id: extra.knowledgeAssetId || null,
      series_id: extra.seriesId || null,
      series_title: extra.seriesTitle || null,
      episode_number: extra.episodeNumber || null,
    })
    .select()
    .single();

  if (error) throw new Error(`Could not create episode: ${error.message}`);
  return episode;
}

/**
 * Runs the actual script -> TTS -> segments pipeline against an
 * already-created episode row. Callers should invoke this via
 * runInBackground() (see lib/backgroundTask.js) so it isn't blocking the
 * HTTP response — see both podcast/generate and podcast/generate-from-text
 * routes for the pattern.
 *
 * NOTE: backgrounding does not remove Vercel's per-function time limit —
 * on Hobby that's a hard 60s ceiling for the WHOLE invocation, foreground
 * work plus backgrounded work combined (see maxDuration in the route
 * files). What backgrounding fixes is the *symptom* you hit: the client's
 * fetch() no longer sits there until a 504 gateway timeout hands it a
 * non-JSON error page. The client gets a fast, valid response with an
 * episodeId and polls /api/content-engine/podcast/status from there. If
 * the pipeline genuinely can't finish inside 60s (very long/many-line
 * episodes), the episode will sit at 'generating' — that's a plan-level
 * ceiling, not a bug; shorten the source text or move engines/style
 * choices toward shorter scripts if you hit it consistently.
 */
export async function runPodcastEpisodePipeline({ episodeId, title, content, style = DEFAULT_PODCAST_STYLE }) {
  const supabase = createAdminClient();

  try {
    const post = { title, content, topic_type: 'learning' };

    const prompt = buildPodcastPrompt(post, style);
    const { result: script, usedProvider, errors } = await generateWithFallback(
      prompt,
      parseScriptJson,
      isValidScript,
      8192
    );

    if (!script) {
      await supabase
        .from('podcast_episodes')
        .update({ status: 'failed', error_message: errors.join(' | ').slice(0, 2000) })
        .eq('id', episodeId);
      throw new Error(`Script generation failed: ${errors.join(' | ')}`);
    }

    const results = await mapWithConcurrency(script, TTS_CONCURRENCY, (line, i) =>
      synthesizeSegment(supabase, episodeId, i, line)
    );

    const segmentRows = [];
    let totalDuration = 0;
    for (const { segment, effectSegment, duration } of results) {
      segmentRows.push(segment);
      if (effectSegment) segmentRows.push(effectSegment);
      totalDuration += duration;
    }

    const { error: segmentsError } = await supabase.from('podcast_segments').insert(segmentRows);
    if (segmentsError) throw new Error(`Could not save segments: ${segmentsError.message}`);

    const failedSegments = segmentRows.filter((s) => !s.audio_url).length;

    await supabase
      .from('podcast_episodes')
      .update({
        status: 'ready',
        total_duration_seconds: totalDuration,
        error_message: failedSegments > 0 ? `${failedSegments} segment(s) failed TTS` : null,
      })
      .eq('id', episodeId);

    return {
      episodeId,
      usedProvider,
      segmentCount: segmentRows.length,
      failedSegments,
      totalDurationSeconds: totalDuration,
    };
  } catch (err) {
    await supabase
      .from('podcast_episodes')
      .update({ status: 'failed', error_message: err.message?.slice(0, 2000) })
      .eq('id', episodeId);
    throw err;
  }
}

/**
 * Convenience wrapper that does createPodcastEpisodeRow + the pipeline in
 * one call, AWAITING the full result. Only use this where you know the
 * whole thing is fast (e.g. short scripts) or you're already inside a
 * background task yourself. For anything reachable directly from a
 * browser fetch(), use createPodcastEpisodeRow() + runInBackground(() =>
 * runPodcastEpisodePipeline(...)) instead, and return the episodeId
 * immediately — see the route files for the pattern.
 */
export async function generatePodcastEpisode({ title, content, style = DEFAULT_PODCAST_STYLE, extra = {} }) {
  const episode = await createPodcastEpisodeRow({ title, style, extra });
  return runPodcastEpisodePipeline({ episodeId: episode.id, title, content, style });
}
