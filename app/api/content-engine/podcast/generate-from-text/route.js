import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { createPodcastEpisodeRow, runPodcastEpisodePipeline } from '@/lib/podcastGenerate';
import { DEFAULT_PODCAST_STYLE } from '@/lib/podcastStyles';
import { runInBackground } from '@/lib/backgroundTask';

// Same fixed Hobby ceiling as everywhere else in this project — see the
// comment in app/api/admin/books/from-text/route.js. This route now only
// does the fast synchronous part (optionally save a knowledge asset,
// create the episode row) and returns immediately with an episodeId; the
// actual script + TTS pipeline runs via runInBackground and the client
// polls /api/content-engine/podcast/status. Previously this route awaited
// the whole pipeline inline, which is what was producing the 504 Gateway
// Timeout + "Unexpected token 'A', 'An error o'..." JSON-parse error on
// /admin/podcasts/paste — the browser was trying to JSON.parse Vercel's
// plain-text timeout page because the connection never got a real
// response in time.
export const maxDuration = 60;

export async function POST(request) {
  try {
    const {
      title,
      text,
      source = 'manual_paste',
      style,
      format, // legacy field name, still honored
      saveAsAsset = true,
    } = await request.json();
    if (!title || !text) {
      return NextResponse.json({ error: 'title and text are required' }, { status: 400 });
    }

    let knowledgeAssetId = null;

    if (saveAsAsset) {
      const supabase = createAdminClient();
      const { data: asset, error: assetError } = await supabase
        .from('knowledge_assets')
        .insert({
          keyword: title,
          raw_content: text,
          source,
          summary: text.slice(0, 500),
        })
        .select()
        .single();

      if (assetError) throw new Error(`Could not save knowledge asset: ${assetError.message}`);
      knowledgeAssetId = asset.id;
    }

    const resolvedStyle = style || (format && format !== 'teacher_examiner' ? format : null) || DEFAULT_PODCAST_STYLE;

    // Create the row fast, hand the id back immediately...
    const episode = await createPodcastEpisodeRow({
      title,
      style: resolvedStyle,
      extra: { knowledgeAssetId },
    });

    // ...then let the slow part (LLM script + TTS for every line) run
    // after the response is sent.
    runInBackground(() =>
      runPodcastEpisodePipeline({
        episodeId: episode.id,
        title,
        content: text,
        style: resolvedStyle,
      })
    );

    return NextResponse.json({
      success: true,
      episodeId: episode.id,
      knowledgeAssetId,
      status: 'generating',
      style: resolvedStyle,
    });
  } catch (err) {
    console.error('generate-from-text error:', err);
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
