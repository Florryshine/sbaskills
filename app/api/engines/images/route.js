// app/api/engines/images/route.js
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { searchPixabayMulti, searchPexelsMulti, searchWikimediaMulti } from '@/lib/image-search';

// Which sources make sense for each visual type. Wikimedia Commons is full of
// labeled diagrams/charts but has almost no generic stock photography.
// Pexels/Pixabay are the opposite — great real photos, no labeled diagrams.
// Querying the wrong source for a type is exactly what produced irrelevant
// results (a swimmer photo for "comparison", a man-on-phone for "attention").
const SOURCE_ROUTING = {
  educational_diagram: ['wikimedia'],
  process: ['wikimedia'],
  comparison: ['wikimedia'],
  real_world_example: ['pexels', 'pixabay'],
  classroom_photo: ['pexels', 'pixabay'],
};

async function runSearch(source, query, count) {
  if (source === 'wikimedia') return searchWikimediaMulti(query, count);
  if (source === 'pexels') return searchPexelsMulti(query, count);
  if (source === 'pixabay') return searchPixabayMulti(query, count);
  return [];
}

async function saveCandidateRows(supabase, knowledgeAssetId, candidates, { sectionTitle = null, visualRequestId = null, purposeOverride = null } = {}) {
  const rows = candidates.map((c) => ({
    knowledge_asset_id: knowledgeAssetId,
    source: c.source,
    url: c.url,
    original_url: c.sourceUrl,
    photographer: c.photographer,
    license: c.license,
    purpose: purposeOverride || 'general',
    section_title: sectionTitle,
    visual_request_id: visualRequestId,
    hosted: false,
  }));
  if (rows.length === 0) return { saved: [], failed: [] };
  const { data, error } = await supabase.from('asset_images').insert(rows).select();
  if (error) return { saved: [], failed: [{ error: error.message }] };
  return { saved: data, failed: [] };
}

export async function POST(request) {
  try {
    const { knowledgeAssetId } = await request.json();
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

    const { data: plan } = await supabase
      .from('visual_requests')
      .select('*')
      .eq('knowledge_asset_id', knowledgeAssetId)
      .eq('status', 'pending');

    let allSaved = [];
    let allFailed = [];

    if (plan && plan.length > 0) {
      for (const item of plan) {
        const sources = SOURCE_ROUTING[item.image_type] || ['pexels', 'pixabay'];
        // Split ~3 desired candidates across the relevant sources only
        const perSource = Math.max(1, Math.ceil(3 / sources.length));
        const results = await Promise.all(sources.map((s) => runSearch(s, item.search_query, perSource)));
        const candidates = results.flat();

        const { saved, failed } = await saveCandidateRows(supabase, knowledgeAssetId, candidates, {
          sectionTitle: item.section_title,
          visualRequestId: item.id,
          purposeOverride: item.image_type,
        });
        allSaved.push(...saved);
        allFailed.push(...failed);

        await supabase
          .from('visual_requests')
          .update({ status: saved.length > 0 ? 'fulfilled' : 'failed' })
          .eq('id', item.id);
      }
    } else {
      // Fallback: no plan yet — blind keyword search across all sources (old behavior)
      const query = [asset.subject, asset.keyword].filter(Boolean).join(' ');
      const [px, pe, wm] = await Promise.all([
        searchPixabayMulti(query, 3),
        searchPexelsMulti(query, 3),
        searchWikimediaMulti(query, 4),
      ]);
      const { saved, failed } = await saveCandidateRows(supabase, knowledgeAssetId, [...px, ...pe, ...wm]);
      allSaved = saved;
      allFailed = failed;
    }

    if (allSaved.length === 0) {
      return NextResponse.json({
        success: true,
        savedCount: 0,
        message: 'No images found. Try "Generate Visual Blueprint" again, or check a broader subject/topic.',
      });
    }

    return NextResponse.json({
      success: true,
      usedBlueprint: !!(plan && plan.length > 0),
      savedCount: allSaved.length,
      images: allSaved,
      failedCount: allFailed.length,
    });
  } catch (error) {
    console.error('❌ Image engine error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}