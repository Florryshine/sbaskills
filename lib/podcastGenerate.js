import { createAdminClient } from '@/lib/supabase-admin';
import { generateWithFallback } from '@/lib/llmFallbackChain';
import { buildPodcastPrompt, parseScriptJson, isValidScript } from '@/lib/podcastPrompt';
import {
  synthesizeLine,
  estimateDurationSeconds,
  VOICES,
  getRandomEffect,
} from '@/lib/podcastTTS';

const BUCKET = 'podcast-audio';

// How many lines' TTS + upload run at once. Each line was previously done
// one at a time in a for-loop -- for a 15-20 line episode at ~2-4s per
// line (TTS call + storage upload), that alone blew past Vercel Hobby's
// fixed 60s function ceiling and the whole episode died with a 504
// mid-generation. Running them concurrently (bounded, so we don't hammer
// the TTS endpoint or Supabase storage) is what actually fixes that --
// returning early via runInBackground alone doesn't help, since Hobby
// caps *all* compute for an invocation at 60s, foreground or background.
const TTS_CONCURRENCY = 4;

async function uploadSegmentAudio(supabase, episodeId, position, buffer) {
  const path = `${episodeId}/${String(position).padStart(3, '0')}.mp3`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: 'audio/mpeg', upsert: true });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
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
    // Continue - a missing segment just gets skipped by the player
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
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://shineybrainacademy.vercel.app';
        const res = await fetch(`${baseUrl}${effectPath}`);
        if (res.ok) {
          const effectBuffer = Buffer.from(await res.arrayBuffer());
          const effectUrl = await uploadSegmentAudio(supabase, episodeId, i + 0.5, effectBuffer);
          // speaker must satisfy podcast_segments_speaker_check (host_a/
          // host_b only) -- reuse the line's own speaker.
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
        }
      } catch (e) {
        console.error(`Effect ${line.effect} failed:`, e.message);
      }
    }
  }

  return { segment, effectSegment, duration };
}

// Bounded-concurrency map: runs `items` through `worker` with at most
// `limit` in flight at once, preserving each result's original index.
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
 * immediately -- callers that need the id for traceability/polling before
 * the pipeline finishes (e.g. the batch route's per-episode loop) can grab
 * it here.
 */
export async function createPodcastEpisodeRow({ title, extra = {} }) {
  const supabase = createAdminClient();
  const { data: episode, error } = await supabase
    .from('podcast_episodes')
    .insert({
      title,
      status: 'generating',
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
 * already-created episode row. TTS + upload per line runs with bounded
 * concurrency (see TTS_CONCURRENCY) so a full episode fits inside Vercel
 * Hobby's fixed 60s function ceiling instead of timing out with a 504
 * partway through.
 */
export async function runPodcastEpisodePipeline({ episodeId, title, content, format = 'teacher_examiner' }) {
  const supabase = createAdminClient();

  try {
    const post = { title, content, topic_type: 'learning' };

    const prompt = buildPodcastPrompt(post, format);
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
 * Drop-in replacement for the old single-function generatePodcastEpisode:
 * same signature, same behavior from the caller's point of view (creates
 * the episode row, runs the full pipeline, returns the result) -- the only
 * change is that TTS now runs with bounded concurrency internally so it
 * fits inside Vercel Hobby's 60s ceiling. No route changes needed.
 */
export async function generatePodcastEpisode({ title, content, format = 'teacher_examiner', extra = {} }) {
  const episode = await createPodcastEpisodeRow({ title, extra });
  return runPodcastEpisodePipeline({ episodeId: episode.id, title, content, format });
}
