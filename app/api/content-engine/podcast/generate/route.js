import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { generatePodcastEpisode } from '@/lib/podcastGenerate';

export const maxDuration = 60;

export async function POST(request) {
  try {
    const { knowledgeAssetId, format } = await request.json();
    if (!knowledgeAssetId) {
      return NextResponse.json({ error: 'knowledgeAssetId is required' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // 1. Fetch the knowledge asset
    const { data: asset, error: assetError } = await supabase
      .from('knowledge_assets')
      .select('*')
      .eq('id', knowledgeAssetId)
      .single();

    if (assetError || !asset) {
      return NextResponse.json({ error: 'Knowledge asset not found' }, { status: 404 });
    }

    // 2. Build plain-text content from the asset's structured fields, or
    // fall back to raw_content when the asset came from a paste/playbook
    // rather than the AI research pipeline.
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

    // 3. Generate — knowledge_asset_id is now stored on the episode row,
    // so regenerate/traceability from the admin list actually works.
    const result = await generatePodcastEpisode({
      title: asset.keyword,
      content,
      format: format || 'teacher_examiner',
      extra: { knowledgeAssetId: asset.id },
    });

    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    console.error('Podcast error:', err);
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
