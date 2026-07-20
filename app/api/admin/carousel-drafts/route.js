import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';

export async function GET() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('media_files')
    .select('*, content_assets(id, title, platform, status, knowledge_assets(keyword))')
    .eq('role', 'carousel_slide')
    .order('content_asset_id', { ascending: true })
    .order('position', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function DELETE(request) {
  const contentAssetId = request.nextUrl.searchParams.get('contentAssetId');
  if (!contentAssetId) {
    return NextResponse.json({ error: 'contentAssetId is required' }, { status: 400 });
  }
  const supabase = createAdminClient();
  const { error } = await supabase
    .from('media_files')
    .delete()
    .eq('content_asset_id', contentAssetId)
    .eq('role', 'carousel_slide');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
