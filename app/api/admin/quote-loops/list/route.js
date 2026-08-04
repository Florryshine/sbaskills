// app/api/admin/quote-loops/list/route.js
//
// content_assets/media_files are locked to "service role full access" only
// (see 20260718_social_engine_v2.sql) — the browser's anon key can't read
// them directly. Every other admin page that lists content_assets goes
// through a server route for this reason (see /api/admin/content-assets);
// this is that same route, scoped to quote_loop rows for one knowledge
// asset, so the drafts list on /admin/quote-loops can actually populate.

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
    .eq('asset_type', 'quote_loop')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ contentAssets: data || [] });
}