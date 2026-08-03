import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { createPodcastEpisodeRow, runPodcastEpisodePipeline } from '@/lib/podcastGenerate';
import { DEFAULT_PODCAST_STYLE } from '@/lib/podcastStyles';
import { runInBackground } from '@/lib/backgroundTask';

// Same background pattern as generate-from-text/route.js — see the
// comment there for why. This route was just as exposed to the same 60s
// timeout risk (script + TTS for 15-25 lines, run inline), just less
// visibly since it's usually called from the multi-engine orchestrator
// (generate-selected/route.js) rather than directly from a form.
export const maxDuration = 60;

export async function POST(request) {
  try {
    const { knowledgeAssetId, style, format } = await request.json();
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

    const content = asset.raw_content
      ? asset.raw_content
      : `
Summary: ${asset.summary || ''}

Key Concepts:
${(asset.key_concepts || []).map((k) => `- ${k}`).join('\n')}

Definitions:
${(asset.definitions || []).map((d) => `- ${d.term}: ${d.definition}`).join('\n')}

Examples:
${(asset.examples || []).map((e) => `- ${e}`).join('\n')}

Facts:
${(asset.facts || []).map((f) => `- ${f}`).join('\n')}

Common Mistakes:
${(asset.common_mistakes || []).map((m) => `- ${m}`).join('\n')}
      `.trim();

    const resolvedStyle =
      style ||
      (format && format !== 'teacher_examiner' ? format : null) ||
      asset.default_podcast_style ||
      DEFAULT_PODCAST_STYLE;

    const episode = await createPodcastEpisodeRow({
      title: asset.keyword,
      style: resolvedStyle,
      extra: { knowledgeAssetId: asset.id },
    });

    runInBackground(() =>
      runPodcastEpisodePipeline({
        episodeId: episode.id,
        title: asset.keyword,
        content,
        style: resolvedStyle,
      })
    );

    return NextResponse.json({
      success: true,
      episodeId: episode.id,
      status: 'generating',
      style: resolvedStyle,
    });
  } catch (err) {
    console.error('Podcast error:', err);
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
