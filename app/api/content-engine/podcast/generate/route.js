import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { generateWithFallback } from '@/lib/llmFallbackChain';
import { buildPodcastPrompt, parseScriptJson, isValidScript } from '@/lib/podcastPrompt';
import {
  synthesizeLine,
  estimateDurationSeconds,
  VOICES,
  getRandomEffect
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

export async function POST(request) {
  const supabase = createAdminClient();
  let episodeId = null;

  try {
    const { knowledgeAssetId, format } = await request.json();
    if (!knowledgeAssetId) {
      return NextResponse.json({ error: 'knowledgeAssetId is required' }, { status: 400 });
    }

    // 1. Fetch the knowledge asset
    const { data: asset, error: assetError } = await supabase
      .from('knowledge_assets')
      .select('*')
      .eq('id', knowledgeAssetId)
      .single();

    if (assetError || !asset) {
      return NextResponse.json({ error: 'Knowledge asset not found' }, { status: 404 });
    }

    // 2. Build a "post" object from the asset (matches prompt expectations)
    const post = {
      id: asset.id,
      title: asset.keyword,
      content: `
Summary: ${asset.summary || ''}

Key Concepts:
${(asset.key_concepts || []).map(k => `- ${k}`).join('\n')}

Definitions:
${(asset.definitions || []).map(d => `- ${d.term}: ${d.definition}`).join('\n')}

Examples:
${(asset.examples || []).map(e => `- ${e}`).join('\n')}

Facts:
${(asset.facts || []).map(f => `- ${f}`).join('\n')}

Common Mistakes:
${(asset.common_mistakes || []).map(m => `- ${m}`).join('\n')}
      `.trim(),
      topic_type: asset.topic_type || 'learning'
    };

    // 3. Create the episode
    const { data: episode, error: episodeError } = await supabase
      .from('podcast_episodes')
      .insert({
        content_draft_id: null,
        title: asset.keyword,
        status: 'generating',
        host_a_voice: VOICES.host_a,
        host_b_voice: VOICES.host_b,
      })
      .select()
      .single();

    if (episodeError) {
      throw new Error(`Could not create episode: ${episodeError.message}`);
    }
    episodeId = episode.id;

    // 4. Generate the script
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
        { error: 'Script generation failed', details: errors },
        { status: 502 }
      );
    }

    // 5. Synthesize each line and add effects
    let totalDuration = 0;
    const segmentRows = [];

    for (let i = 0; i < script.length; i++) {
      const line = script[i];
      const emotion = line.emotion || 'neutral';
      let audioUrl = null;
      let duration = estimateDurationSeconds(line.text);

      // 5a. Synthesize the TTS audio
      try {
        const buffer = await synthesizeLine(line.text, line.speaker, emotion);
        audioUrl = await uploadSegmentAudio(supabase, episodeId, i, buffer);
      } catch (e) {
        console.error(`❌ Segment ${i} TTS/upload failed:`, {
          message: e.message,
          stack: e.stack,
          speaker: line.speaker,
          text: line.text.substring(0, 50)
        });
        // Continue – a missing segment just gets skipped by the player
      }

      // 5b. Handle effect with random selection
      let effectUrl = null;
      if (line.effect && line.effect !== 'none') {
        const effectPath = getRandomEffect(line.effect);
        if (effectPath) {
          try {
            const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://shineybrainacademy.vercel.app';
            const effectPublicUrl = `${baseUrl}${effectPath}`;
            const res = await fetch(effectPublicUrl);
            if (res.ok) {
              const effectBuffer = Buffer.from(await res.arrayBuffer());
              // Upload effect as a separate segment (position i + 0.5)
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

      // If effect was uploaded, add a separate segment for it
      if (effectUrl) {
        segmentRows.push({
          episode_id: episodeId,
          position: i + 0.5,
          speaker: 'effect',
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

    // 6. Save segments
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
        error_message: failedSegments > 0 ? `${failedSegments} segment(s) failed TTS` : null,
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
    console.error('Podcast error:', err);
    if (episodeId) {
      await supabase
        .from('podcast_episodes')
        .update({ status: 'failed', error_message: err.message?.slice(0, 2000) })
        .eq('id', episodeId);
    }
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}