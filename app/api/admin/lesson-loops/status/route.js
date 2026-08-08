// app/api/admin/lesson-loops/status/route.js
//
// Polled by app/admin/lesson-loops/page.js while a lesson loop's
// background pipeline (script -> narration -> backgrounds) runs — same
// pattern as /api/content-engine/podcast/status. Once status flips to
// 'draft' the metadata.segments array is populated and ready to record;
// 'failed' surfaces metadata.error_message.

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';

export async function GET(request) {
  const contentAssetId = request.nextUrl.searchParams.get('contentAssetId');
  if (!contentAssetId) {
    return NextResponse.json({ error: 'contentAssetId is required' }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('content_assets')
    .select('*, media_files(url, media_type, role)')
    .eq('id', contentAssetId)
    .eq('asset_type', 'lesson_loop')
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Lesson loop not found' }, { status: 404 });
  }

  return NextResponse.json({
    contentAssetId: data.id,
    status: data.status,
    errorMessage: data.status === 'failed' ? data.metadata?.error_message : undefined,
    contentAsset: data.status !== 'generating' ? data : undefined,
  });
}
