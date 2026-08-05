import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';

export async function GET(req) {
  const code = req.nextUrl.searchParams.get('code');
  if (!code) {
    return NextResponse.json({ error: 'Missing authorization code' }, { status: 400 });
  }

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: process.env.YOUTUBE_REDIRECT_URI,
      client_id: process.env.YOUTUBE_CLIENT_ID,
      client_secret: process.env.YOUTUBE_CLIENT_SECRET,
    }),
  });
  const token = await tokenRes.json();
  if (!token.access_token) {
    return NextResponse.json(token, { status: 500 });
  }

  // Get channel info
  const youtubeRes = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  const youtubeData = await youtubeRes.json();
  const channelInfo = youtubeData.items?.[0]?.snippet || {};
  const channelId = youtubeData.items?.[0]?.id;

  const supabase = createAdminClient();
  const { error } = await supabase
    .from('social_channels_v2')
    .upsert(
      {
        platform: 'youtube',
        label: 'Main',
        account_id: channelId,
        access_token: token.access_token,
        refresh_token: token.refresh_token,
        metadata: channelInfo,
        token_expires_at: new Date(Date.now() + token.expires_in * 1000).toISOString(),
        is_active: true,
      },
      { onConflict: 'platform,label' }
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.redirect(
    `${process.env.NEXT_PUBLIC_SITE_URL || 'https://shineybrainacademy.vercel.app'}/admin/channels?success=youtube`
  );
}
