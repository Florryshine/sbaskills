import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { generatePodcastEpisode } from '@/lib/podcastGenerate';

export const maxDuration = 60;

export async function POST(request) {
  try {
    const { title, text, source = 'manual_paste', format, saveAsAsset = true } = await request.json();
    if (!title || !text) {
      return NextResponse.json({ error: 'title and text are required' }, { status: 400 });
    }

    let knowledgeAssetId = null;

    // Blog-post podcasts (source: 'blog_post') don't need a knowledge asset —
    // the content_draft row is already the source of truth. Playbook/pasted
    // text does get saved as a knowledge asset, since that's the only place
    // this platform tracks topic content, and it's what makes it reusable
    // for quizzes/flashcards/games later.
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

    const result = await generatePodcastEpisode({
      title,
      content: text,
      format,
      extra: { knowledgeAssetId },
    });

    return NextResponse.json({ success: true, knowledgeAssetId, ...result });
  } catch (err) {
    console.error('generate-from-text error:', err);
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
