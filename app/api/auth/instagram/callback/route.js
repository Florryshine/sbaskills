import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://shineybrainacademy.vercel.app';
const GRAPH = 'https://graph.instagram.com/v24.0';

function redirectError(message) {
  return NextResponse.redirect(`${SITE}/admin/channels?error=${encodeURIComponent(message)}`);
}

async function readJson(response, label) {
  const data = await response.json();
  if (!response.ok || data.error) throw new Error(data.error?.message || data.error_message || `${label} failed (${response.status})`);
  return data;
}

export async function GET(req) {
  const code = req.nextUrl.searchParams.get('code');
  const state = req.nextUrl.searchParams.get('state');
  const oauthError = req.nextUrl.searchParams.get('error_description') || req.nextUrl.searchParams.get('error');
  const savedState = req.cookies.get('instagram_oauth_state')?.value;

  if (oauthError) return redirectError(`Instagram authorization was not completed: ${oauthError}`);
  if (!code) return redirectError('Instagram did not return an authorization code. Start Connect Instagram again.');
  if (!state || !savedState || state !== savedState) return redirectError('Instagram security state did not match. Start Connect Instagram again.');

  const appId = process.env.INSTAGRAM_APP_ID;
  const appSecret = process.env.INSTAGRAM_APP_SECRET;
  const redirectUri = process.env.INSTAGRAM_REDIRECT_URI;
  if (!appId || !appSecret || !redirectUri) return redirectError('Instagram Login is not configured in the server environment.');

  try {
    const form = new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
      code,
    });
    const shortToken = await readJson(await fetch('https://api.instagram.com/oauth/access_token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form, cache: 'no-store',
    }), 'Instagram authorization-code exchange');

    if (!shortToken.access_token) throw new Error('Instagram did not return an access token.');
    const longTokenUrl = new URL(`${GRAPH}/access_token`);
    longTokenUrl.search = new URLSearchParams({
      grant_type: 'ig_exchange_token',
      client_secret: appSecret,
      access_token: shortToken.access_token,
    }).toString();
    const longToken = await readJson(await fetch(longTokenUrl, { cache: 'no-store' }), 'Instagram long-lived token exchange');
    const accessToken = longToken.access_token || shortToken.access_token;
    const expiresIn = longToken.expires_in || shortToken.expires_in || 0;

    const profileUrl = new URL(`${GRAPH}/me`);
    profileUrl.search = new URLSearchParams({ fields: 'user_id,username,account_type', access_token: accessToken }).toString();
    const profile = await readJson(await fetch(profileUrl, { cache: 'no-store' }), 'Instagram profile lookup');
    const accountId = profile.user_id || profile.id || shortToken.user_id;
    if (!accountId) throw new Error('Instagram authorized successfully but did not return an Instagram account ID.');

    const label = (profile.username || `Instagram ${accountId}`).trim().slice(0, 80);
    const expiry = expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null;
    const supabase = createAdminClient();
    const { error } = await supabase.from('social_channels_v2').upsert({
      platform: 'instagram', label, account_id: String(accountId), access_token: accessToken,
      refresh_token: null, token_expires_at: expiry,
      metadata: {
        connection: 'instagram_login', auth_type: 'instagram_login',
        instagram_username: profile.username || null, account_type: profile.account_type || null,
        connected_at: new Date().toISOString(),
      },
      is_active: true,
    }, { onConflict: 'platform,label' });
    if (error) throw new Error(`Could not save Instagram account: ${error.message}`);

    const res = NextResponse.redirect(`${SITE}/admin/channels?success=${encodeURIComponent(`Instagram @${profile.username || accountId} connected independently.`)}`);
    res.cookies.delete('instagram_oauth_state');
    return res;
  } catch (error) {
    return redirectError(`Instagram connection failed: ${error.message}`);
  }
}
