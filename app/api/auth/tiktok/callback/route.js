import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';

export async function GET(req) {
  const code = req.nextUrl.searchParams.get('code');
  if (!code) {
    return NextResponse.json({ error: 'Missing authorization code' }, { status: 400 });
  }

  // Exchange code for access token
  const tokenRes = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: process.env.TIKTOK_REDIRECT_URI,
      client_key: process.env.TIKTOK_CLIENT_KEY,
      client_secret: process.env.TIKTOK_CLIENT_SECRET,
    }),
  });
  const tokenData = await tokenRes.json();
  
  if (!tokenData.access_token) {
    return NextResponse.json(tokenData, { status: 500 });
  }

  // Get user info
  const userInfoRes = await fetch('https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,display_name,avatar_url', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const userInfoData = await userInfoRes.json();
  const userInfo = userInfoData.data?.user || {};

  const supabase = createAdminClient();
  const { error } = await supabase
    .from('social_channels_v2')
    .upsert(
      {
        platform: 'tiktok',
        label: 'Main',
        account_id: userInfo.open_id || userInfo.union_id,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || null,
        metadata: userInfo,
        token_expires_at: tokenData.expires_in ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString() : null,
        is_active: true,
      },
      { onConflict: 'platform,label' }
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.redirect(
    `${process.env.NEXT_PUBLIC_SITE_URL || 'https://shineybrainacademy.vercel.app'}/admin/channels?success=tiktok`
  );
}
