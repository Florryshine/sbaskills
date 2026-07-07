import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';
import { generateWithFallback } from '@/lib/llmFallbackChain';
import { buildPodcastPrompt, parseScriptJson, isValidScript } from '@/lib/podcastPrompt';
import { synthesizeLine, estimateDurationSeconds, VOICES } from '@/lib/podcastTTS';

const BUCKET = 'podcast-audio';

async function uploadSegmentAudio(supabase, episodeId, position, buffer) {
  const path = `${episodeId}/${String(position).padStart(3, '0')}.mp3`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: 'audio/mpeg', upsert: true });
  if (error) throw new Error(`Storage upload failed (segment ${position}): ${error.message}`);
  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return urlData.publicUrl;
}

export async function POST(request) {
  const supabase = createRouteHandlerClient();
  let episodeId = null;

  try {
    const { contentDraftId, format } = await request.json();
    if (!contentDraftId) {
      return NextResponse.json({ error: 'contentDraftId is required' }, { status: 400 });
    }

    // 1. Fetch the source post
    const { data: post, error: postError } = await supabase
      .from('content_drafts')
      .select('id, title, content, topic_type')
      .eq('id', contentDraftId)
      .single();

    if (postError || !post) {
      return NextResponse.json({ error: 'Source post not found' }, { status: 404 });
    }

    // 2. Create the episode row (status: generating)
    const { data: episode, error: episodeError } = await supabase
      .from('podcast_episodes')
      .insert({
        content_draft_id: post.id,
        title: post.title,
        status: 'generating',
        host_a_voice: VOICES.host_a,
        host_b_voice: VOICES.host_b,
      })
      .select()
      .single();

    if (episodeError || !episode) {
      throw new Error(`Could not create episode row: ${episodeError?.message}`);
    }
    episodeId = episode.id;

    // 3. Generate the script via the LLM fallback chain
    const prompt = buildPodcastPrompt(post, format || 'teacher_examiner');
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
      return NextResponse.json(
        { error: 'Script generation failed on all providers', details: errors },
        { status: 502 }
      );
    }

    // 4. Synthesize each line and upload, sequentially (keeps memory low,
    //    and Edge TTS has no benefit from parallelizing since it's one
    //    websocket connection per call anyway).
    let totalDuration = 0;
    const segmentRows = [];

    for (let i = 0; i < script.length; i++) {
      const line = script[i];
      const emotion = line.emotion || 'neutral';

      let audioUrl = null;
      let duration = estimateDurationSeconds(line.text);

      try {
        const buffer = await synthesizeLine(line.text, line.speaker, emotion);
        audioUrl = await uploadSegmentAudio(supabase, episodeId, i, buffer);
      } catch (e) {
        console.error(`Segment ${i} TTS/upload failed:`, e.message);
        // Continue — a missing segment just gets skipped by the player,
        // rather than failing the whole episode.
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
        // ── metadata (additive; defaults keep this safe if a provider omits them) ──
        topic: typeof line.topic === 'string' ? line.topic : null,
        keywords: Array.isArray(line.keywords) ? line.keywords : [],
        exam_tip: line.exam_tip === true,
        difficulty: ['easy', 'medium', 'hard'].includes(line.difficulty) ? line.difficulty : null,
        estimated_duration_seconds: duration,
      });
    }

    const { error: segmentsError } = await supabase
      .from('podcast_segments')
      .insert(segmentRows);

    if (segmentsError) {
      throw new Error(`Could not save segments: ${segmentsError.message}`);
    }

    const failedSegments = segmentRows.filter((s) => !s.audio_url).length;

    await supabase
      .from('podcast_episodes')
      .update({
        status: 'ready',
        total_duration_seconds: totalDuration,
        error_message:
          failedSegments > 0 ? `${failedSegments} segment(s) failed TTS and were skipped` : null,
      })
      .eq('id', episodeId);

    return NextResponse.json({
      success: true,
      episodeId,
      usedProvider,
      segmentCount: segmentRows.length,
      failedSegments,
      totalDurationSeconds: totalDuration,
    });
  } catch (err) {
    console.error('Podcast generation error:', err);
    if (episodeId) {
      await supabase
        .from('podcast_episodes')
        .update({ status: 'failed', error_message: err.message?.slice(0, 2000) })
        .eq('id', episodeId);
    }
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

// GET a single episode + its segments (used by the player)
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const contentDraftId = searchParams.get('contentDraftId');
  const episodeId = searchParams.get('episodeId');

  if (!contentDraftId && !episodeId) {
    return NextResponse.json({ error: 'contentDraftId or episodeId is required' }, { status: 400 });
  }

  const supabase = createRouteHandlerClient();

  let episodeQuery = supabase.from('podcast_episodes').select('*').eq('status', 'ready');
  episodeQuery = episodeId
    ? episodeQuery.eq('id', episodeId)
    : episodeQuery.eq('content_draft_id', contentDraftId);

  const { data: episode } = await episodeQuery.order('created_at', { ascending: false }).limit(1).maybeSingle();

  if (!episode) {
    return NextResponse.json({ episode: null, segments: [] });
  }

  const { data: segments } = await supabase
    .from('podcast_segments')
    .select('*')
    .eq('episode_id', episode.id)
    .order('position', { ascending: true });

  return NextResponse.json({ episode, segments: segments || [] });
}
