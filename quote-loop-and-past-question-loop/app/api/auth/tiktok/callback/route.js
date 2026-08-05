// app/api/auth/tiktok/callback/route.js
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';

export async function GET(req) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://shineybrainacademy.vercel.app';
  const code = req.nextUrl.searchParams.get('code');
  const state = req.nextUrl.searchParams.get('state');
  const oauthError = req.nextUrl.searchParams.get('error');

  if (oauthError) {
    return NextResponse.redirect(`${siteUrl}/admin/channels?error=${encodeURIComponent(oauthError)}`);
  }
  if (!code) {
    return NextResponse.json({ error: 'Missing authorization code' }, { status: 400 });
  }

  const savedState = req.cookies.get('tiktok_oauth_state')?.value;
  const codeVerifier = req.cookies.get('tiktok_code_verifier')?.value;
  if (!state || state !== savedState) {
    return NextResponse.json({ error: 'State mismatch — restart the connect flow from /admin/channels' }, { status: 400 });
  }
  if (!codeVerifier) {
    return NextResponse.json({ error: 'Missing PKCE verifier (cookie expired) — restart the connect flow' }, { status: 400 });
  }

  const tokenRes = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Cache-Control': 'no-cache' },
    body: new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY,
      client_secret: process.env.TIKTOK_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: process.env.TIKTOK_REDIRECT_URI,
      code_verifier: codeVerifier,
    }),
  });
  const token = await tokenRes.json();
  if (!token.access_token) {
    return NextResponse.json(token, { status: 500 });
  }

  // TikTok's user.info.basic scope — just enough to label the channel row
  // with a real name instead of a bare open_id.
  const infoRes = await fetch('https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name', {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  const info = await infoRes.json().catch(() => ({}));
  const profile = info?.data?.user || {};

  const supabase = createAdminClient();
  const { error: dbError } = await supabase.from('social_channels_v2').upsert(
    {
      platform: 'tiktok',
      label: 'Main',
      account_id: token.open_id || profile.open_id || null,
      access_token: token.access_token,
      refresh_token: token.refresh_token || null,
      token_expires_at: new Date(Date.now() + token.expires_in * 1000).toISOString(),
      metadata: { display_name: profile.display_name || null, scope: token.scope },
      is_active: true,
    },
    { onConflict: 'platform,label' } // matches the unique constraint already in your schema
  );

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  const res = NextResponse.redirect(`${siteUrl}/admin/channels?success=tiktok`);
  res.cookies.delete('tiktok_oauth_state');
  res.cookies.delete('tiktok_code_verifier');
  return res;
}
