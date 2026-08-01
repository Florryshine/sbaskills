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

async function uploadSegmentAudio(supabase, episodeId, position, buffer) {
  const path = `${episodeId}/${String(position).padStart(3, '0')}.mp3`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: 'audio/mpeg', upsert: true });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return urlData.publicUrl;
}

/**
 * Generates one podcast episode end-to-end: script -> TTS per line -> sound
 * effects -> storage upload -> podcast_segments rows -> episode status.
 *
 * This is the one place that talks to the LLM + TTS + storage for podcasts —
 * app/api/content-engine/podcast/generate/route.js (knowledge assets),
 * generate-from-text/route.js (pasted/playbook text + blog posts), and
 * generate-batch/route.js (long text split into a series) all call this
 * instead of duplicating the pipeline.
 *
 * @param {Object} args
 * @param {string} args.title
 * @param {string} args.content - plain text the script gets built from
 * @param {string} [args.format='teacher_examiner']
 * @param {Object} [args.extra] - optional traceability/batching fields
 * @param {string} [args.extra.knowledgeAssetId]
 * @param {string} [args.extra.seriesId]
 * @param {string} [args.extra.seriesTitle]
 * @param {number} [args.extra.episodeNumber]
 * @returns {Promise<{episodeId: string, usedProvider: string, segmentCount: number, failedSegments: number, totalDurationSeconds: number}>}
 */
export async function generatePodcastEpisode({ title, content, format = 'teacher_examiner', extra = {} }) {
  const supabase = createAdminClient();
  let episodeId = null;

  try {
    const post = { title, content, topic_type: 'learning' };

    // 1. Create the episode row up front so failures still leave a
    // trackable 'failed' row instead of vanishing silently.
    const { data: episode, error: episodeError } = await supabase
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

    if (episodeError) throw new Error(`Could not create episode: ${episodeError.message}`);
    episodeId = episode.id;

    // 2. Generate the script
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

    // 3. Synthesize each line + effects
    let totalDuration = 0;
    const segmentRows = [];

    for (let i = 0; i < script.length; i++) {
      const line = script[i];
      const emotion = line.emotion || 'neutral';
      let audioUrl = null;
      const duration = estimateDurationSeconds(line.text);

      try {
        const buffer = await synthesizeLine(line.text, line.speaker, emotion);
        audioUrl = await uploadSegmentAudio(supabase, episodeId, i, buffer);
      } catch (e) {
        console.error(`❌ Segment ${i} TTS/upload failed:`, {
          message: e.message,
          speaker: line.speaker,
          text: line.text?.substring(0, 50),
        });
        // Continue – a missing segment just gets skipped by the player
      }

      let effectUrl = null;
      if (line.effect && line.effect !== 'none') {
        const effectPath = getRandomEffect(line.effect);
        if (effectPath) {
          try {
            const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://shineybrainacademy.vercel.app';
            const res = await fetch(`${baseUrl}${effectPath}`);
            if (res.ok) {
              const effectBuffer = Buffer.from(await res.arrayBuffer());
              effectUrl = await uploadSegmentAudio(supabase, episodeId, i + 0.5, effectBuffer);
            }
          } catch (e) {
            console.error(`❌ Effect ${line.effect} failed:`, e.message);
          }
        }
      }

      totalDuration += duration;
      segmentRows.push({
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
      });

      // speaker must satisfy podcast_segments_speaker_check (host_a/host_b
      // only) — reuse the line's own speaker for the effect segment rather
      // than inventing a new value.
      if (effectUrl) {
        segmentRows.push({
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
        });
      }
    }

    // 4. Save segments
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
    if (episodeId) {
      await supabase
        .from('podcast_episodes')
        .update({ status: 'failed', error_message: err.message?.slice(0, 2000) })
        .eq('id', episodeId);
    }
    throw err;
  }
}
