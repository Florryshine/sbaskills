// app/api/engines/images/route.js
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { searchPixabayMulti, searchPexelsMulti, searchWikimediaMulti } from '@/lib/image-search';

// NOTE: this route does NOT download or upload any image bytes.
// It only stores the external URL + metadata so you can preview candidates.
// Nothing touches Supabase Storage until you click "Select" or "Edit" on
// an image (see app/api/asset-images/[id]/host/route.js).

async function saveCandidateRows(supabase, knowledgeAssetId, candidates, { sectionTitle = null, visualRequestId = null, purposeOverride = null } = {}) {
  const rows = candidates.map((c) => ({
    knowledge_asset_id: knowledgeAssetId,
    source: c.source,
    url: c.url,              // external URL for now — just a preview
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
        const [px, pe, wm] = await Promise.all([
          searchPixabayMulti(item.search_query, 1),
          searchPexelsMulti(item.search_query, 1),
          searchWikimediaMulti(item.search_query, 1),
        ]);
        const candidates = [...px, ...pe, ...wm];

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
      const query = [asset.subject, asset.keyword].filter(Boolean).join(' ');
      const [px, pe, wm] = await Promise.all([
        searchPixabayMulti(query, 3),
        searchPexelsMulti(query, 3),
        searchWikimediaMulti(query, 4),
      ]);
      const candidates = [...px, ...pe, ...wm];
      const { saved, failed } = await saveCandidateRows(supabase, knowledgeAssetId, candidates);
      allSaved = saved;
      allFailed = failed;
    }

    if (allSaved.length === 0) {
      return NextResponse.json({
        success: true,
        savedCount: 0,
        message: 'No images found. Try "Generate Visual Blueprint" first, or check a broader subject/topic.',
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
