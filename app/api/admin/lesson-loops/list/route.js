// app/api/admin/lesson-loops/list/route.js
//
// Same server-route-around-RLS reasoning as quote-loops/list — scoped to
// lesson_loop rows for one knowledge asset. Includes rows still in
// status 'generating' so the admin page can show them as in-progress
// rather than them just being invisible until done.

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
    .eq('asset_type', 'lesson_loop')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ contentAssets: data || [] });
}
