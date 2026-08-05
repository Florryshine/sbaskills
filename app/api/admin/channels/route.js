import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';

const PLATFORMS = ['instagram', 'facebook', 'telegram', 'linkedin', 'x', 'pinterest', 'youtube', 'tiktok', 'threads', 'whatsapp'];

function maskToken(token) {
  if (!token) return null;
  if (token.length <= 4) return '••••';
  return `••••••••${token.slice(-4)}`;
}

export async function GET() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('social_channels_v2')
    .select('id, platform, label, account_id, access_token, refresh_token, token_expires_at, metadata, is_active, created_at')
    .order('platform', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Never send the real token back to the browser once saved — only a
  // masked preview, so the list view can't leak a live credential.
  const masked = (data || []).map((c) => ({
    ...c,
    access_token: maskToken(c.access_token),
    has_refresh_token: !!c.refresh_token,
    refresh_token: undefined,
  }));

  return NextResponse.json({ data: masked });
}

export async function POST(request) {
  const body = await request.json();
  const { platform, label, account_id, access_token, refresh_token, token_expires_at } = body;

  if (!platform || !PLATFORMS.includes(platform)) {
    return NextResponse.json({ error: `platform must be one of: ${PLATFORMS.join(', ')}` }, { status: 400 });
  }
  if (!access_token) {
    return NextResponse.json({ error: 'access_token is required' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('social_channels_v2')
    .upsert(
      {
        platform,
        label: label || 'Main',
        account_id: account_id || null,
        access_token,
        refresh_token: refresh_token || null,
        token_expires_at: token_expires_at || null,
        is_active: true,
      },
      { onConflict: 'platform,label' }
    )
    .select('id, platform, label')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, data });
}

export async function PATCH(request) {
  const { id, is_active } = await request.json();
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const supabase = createAdminClient();
  const { error } = await supabase.from('social_channels_v2').update({ is_active }).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(request) {
  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const supabase = createAdminClient();
  const { error } = await supabase.from('social_channels_v2').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
