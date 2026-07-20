import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';

// content_assets/media_files/video_scripts/publish_jobs are service_role-only
// by RLS (see supabase/migrations/20260718_social_engine_v2.sql) — the
// browser's anon key gets zero rows back, silently, no error. This route is
// the server-side door the admin UI is supposed to go through instead.

export async function GET() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('content_assets')
    .select(
      '*, knowledge_assets(keyword), media_files(*), video_scripts(*), publish_jobs(id, status, external_url, last_error, social_channels_v2(platform, label))'
    )
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function PATCH(request) {
  const { id, status } = await request.json();
  if (!id || !status) {
    return NextResponse.json({ error: 'id and status are required' }, { status: 400 });
  }
  const supabase = createAdminClient();
  const { error } = await supabase.from('content_assets').update({ status }).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(request) {
  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
  const supabase = createAdminClient();
  const { error } = await supabase.from('content_assets').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
