// app/api/auth/youtube/callback/route.js
import { NextResponse } from 'next/server';
import { google } from 'googleapis';
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

  const savedState = req.cookies.get('youtube_oauth_state')?.value;
  if (!state || state !== savedState) {
    return NextResponse.json({ error: 'State mismatch — restart the connect flow from /admin/channels' }, { status: 400 });
  }

  const client = new google.auth.OAuth2(
    process.env.YOUTUBE_CLIENT_ID,
    process.env.YOUTUBE_CLIENT_SECRET,
    process.env.YOUTUBE_REDIRECT_URI
  );

  let tokens;
  try {
    ({ tokens } = await client.getToken(code));
  } catch (err) {
    return NextResponse.json({ error: `Token exchange failed: ${err.message}` }, { status: 500 });
  }

  if (!tokens.refresh_token) {
    // Happens if the Google account already granted this app access before
    // and Google silently skipped issuing a new refresh_token — revoke
    // access at myaccount.google.com/permissions and retry so it's forced.
    return NextResponse.redirect(
      `${siteUrl}/admin/channels?error=${encodeURIComponent(
        'No refresh_token returned — revoke Shiney Brain Academy access at myaccount.google.com/permissions, then reconnect.'
      )}`
    );
  }

  client.setCredentials(tokens);
  const youtube = google.youtube({ version: 'v3', auth: client });

  let channelId = null;
  let channelTitle = null;
  try {
    const { data } = await youtube.channels.list({ part: ['snippet'], mine: true });
    const ch = data.items?.[0];
    channelId = ch?.id || null;
    channelTitle = ch?.snippet?.title || null;
  } catch {
    // Non-fatal — tokens are already good; we just won't have a friendly label.
  }

  const supabase = createAdminClient();
  const { error: dbError } = await supabase.from('social_channels_v2').upsert(
    {
      platform: 'youtube',
      label: 'Main',
      account_id: channelId,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: new Date(tokens.expiry_date).toISOString(),
      metadata: { channel_title: channelTitle },
      is_active: true,
    },
    { onConflict: 'platform,label' }
  );

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  const res = NextResponse.redirect(`${siteUrl}/admin/channels?success=youtube`);
  res.cookies.delete('youtube_oauth_state');
  return res;
}
