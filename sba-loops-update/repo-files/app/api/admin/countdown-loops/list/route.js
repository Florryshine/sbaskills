// app/api/admin/countdown-loops/list/route.js
//
// Same reasoning as quote-loops/list/route.js and past-question-loops/list/
// route.js: content_assets/media_files are service-role only, so this is
// the server route that lets /admin/countdown-loops populate its drafts
// list, scoped to countdown_loop rows for one knowledge asset.

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const knowledgeAssetId = searchParams.get('knowledgeAssetId');
  if (!knowledgeAssetId) {
    return NextResponse.json({ error: 'knowledgeAssetId is required' }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('content_assets')
    .select('*, media_files(url, media_type, role)')
    .eq('knowledge_asset_id', knowledgeAssetId)
    .eq('asset_type', 'countdown_loop')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ contentAssets: data || [] });
}
