import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { generateWithFallback } from '@/lib/llmFallbackChain';
import { generatePodcastEpisode } from '@/lib/podcastGenerate';
import { parseJsonFromText } from '@/lib/robustJsonParse';
import { runInBackground } from '@/lib/backgroundTask';

// A full series (split + N episodes of script+TTS) can run well past a
// normal request's time budget, so this route only does the fast part
// synchronously (save the text, create the job row) and returns. The rest
// happens in runInBackground below; the paste page polls the status route.
export const maxDuration = 60;

function buildSplitPrompt(seriesTitle, text, targetMinutes) {
  return `Split the study material below into podcast episodes for a series called "${seriesTitle}".

Each episode should be a self-contained topic, roughly ${targetMinutes} minutes of spoken content (~${targetMinutes * 130} words of source material per episode). Split at natural topic boundaries, not arbitrary word counts.

Return ONLY a JSON array, no other text:
[{"title": "Episode title", "content": "the portion of source text this episode covers"}, ...]

Source material:
${text}`;
}

async function runBatchJob({ jobId, seriesTitle, text, targetMinutes, format, knowledgeAssetId }) {
  const supabase = createAdminClient();

  try {
    await supabase.from('podcast_batch_jobs').update({ status: 'splitting' }).eq('id', jobId);

    const splitPrompt = buildSplitPrompt(seriesTitle, text, targetMinutes);
    const { result: episodePlan, errors } = await generateWithFallback(
      splitPrompt,
      (t) => parseJsonFromText(t, 'array'),
      (r) => Array.isArray(r) && r.length > 0 && r.every((e) => e.title && e.content),
      8192
    );

    if (!episodePlan) {
      await supabase
        .from('podcast_batch_jobs')
        .update({ status: 'failed', error: (errors || []).join(' | ').slice(0, 2000) })
        .eq('id', jobId);
      return;
    }

    await supabase
      .from('podcast_batch_jobs')
      .update({ status: 'generating', episode_count: episodePlan.length })
      .eq('id', jobId);

    // Sequential on purpose — TTS + storage upload per episode is heavy;
    // running a whole series in parallel risks provider rate limits.
    for (let i = 0; i < episodePlan.length; i++) {
      const ep = episodePlan[i];
      try {
        await generatePodcastEpisode({
          title: ep.title,
          content: ep.content,
          format,
          extra: {
            knowledgeAssetId,
            seriesId: jobId,
            seriesTitle,
            episodeNumber: i + 1,
          },
        });
      } catch (e) {
        console.error(`Batch episode ${i + 1} failed:`, e.message);
        // Individual episode failure is recorded on its own podcast_episodes
        // row by generatePodcastEpisode() — the batch keeps going so one
        // bad episode doesn't sink the whole series.
      }
      await supabase
        .from('podcast_batch_jobs')
        .update({ completed_count: i + 1 })
        .eq('id', jobId);
    }

    await supabase.from('podcast_batch_jobs').update({ status: 'ready' }).eq('id', jobId);
  } catch (err) {
    console.error('Batch job failed:', err);
    await supabase
      .from('podcast_batch_jobs')
      .update({ status: 'failed', error: err.message?.slice(0, 2000) })
      .eq('id', jobId);
  }
}

export async function POST(request) {
  try {
    const { seriesTitle, text, targetMinutes = 5, format } = await request.json();
    if (!seriesTitle || !text) {
      return NextResponse.json({ error: 'seriesTitle and text are required' }, { status: 400 });
    }

    const supabase = createAdminClient();

    const { data: asset, error: assetError } = await supabase
      .from('knowledge_assets')
      .insert({
        keyword: seriesTitle,
        raw_content: text,
        source: 'manual_paste_batch',
        summary: text.slice(0, 500),
      })
      .select()
      .single();
    if (assetError) throw new Error(`Could not save knowledge asset: ${assetError.message}`);

    const { data: job, error: jobError } = await supabase
      .from('podcast_batch_jobs')
      .insert({
        knowledge_asset_id: asset.id,
        series_title: seriesTitle,
        status: 'queued',
      })
      .select()
      .single();
    if (jobError) throw new Error(`Could not create batch job: ${jobError.message}`);

    runInBackground(() =>
      runBatchJob({
        jobId: job.id,
        seriesTitle,
        text,
        targetMinutes,
        format,
        knowledgeAssetId: asset.id,
      })
    );

    return NextResponse.json({
      success: true,
      seriesId: job.id,
      knowledgeAssetId: asset.id,
      status: 'queued',
    });
  } catch (err) {
    console.error('generate-batch error:', err);
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
