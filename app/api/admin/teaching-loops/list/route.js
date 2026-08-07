// app/api/admin/teaching-loops/list/route.js
//
// content_assets is locked to service-role-only by RLS (see
// 20260718_social_engine_v2.sql) — the browser's anon key can't read it
// directly, same reason every other *-loops list route goes through a
// server route. Scoped to teaching_loop rows for one knowledge asset,
// joined with media_files (the recorded video, once
// TeachingLoopRecorder.js saves it).

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
    .eq('asset_type', 'teaching_loop')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ contentAssets: data || [] });
}
