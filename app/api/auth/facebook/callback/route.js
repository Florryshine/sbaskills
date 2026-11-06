import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://shineybrainacademy.vercel.app';
const GRAPH = 'https://graph.facebook.com/v24.0';

async function graphJson(url) {
  const response = await fetch(url, { cache: 'no-store' });
  const data = await response.json();
  if (!response.ok || data.error) throw new Error(data.error?.message || `Facebook API request failed (${response.status})`);
  return data;
}

function redirectError(message) {
  return NextResponse.redirect(`${SITE}/admin/channels?error=${encodeURIComponent(message)}`);
}

export async function GET(req) {
  const code = req.nextUrl.searchParams.get('code');
  const state = req.nextUrl.searchParams.get('state');
  const oauthError = req.nextUrl.searchParams.get('error_description') || req.nextUrl.searchParams.get('error');
  const savedState = req.cookies.get('facebook_oauth_state')?.value;

  if (oauthError) return redirectError(`Facebook authorization was not completed: ${oauthError}`);
  if (!code) return redirectError('Facebook did not return an authorization code. Start Connect Facebook again.');
  if (!state || !savedState || state !== savedState) return redirectError('Facebook security state did not match. Start Connect Facebook again.');

  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  const redirectUri = process.env.META_REDIRECT_URI;
  if (!appId || !appSecret || !redirectUri) return redirectError('Facebook OAuth is not configured in the server environment.');

  try {
    const shortToken = await graphJson(`${GRAPH}/oauth/access_token?${new URLSearchParams({
      client_id: appId, client_secret: appSecret, redirect_uri: redirectUri, code,
    })}`);

    let userToken = shortToken.access_token;
    let expiresIn = shortToken.expires_in || 0;
    try {
      const longToken = await graphJson(`${GRAPH}/oauth/access_token?${new URLSearchParams({
        grant_type: 'fb_exchange_token', client_id: appId,
        client_secret: appSecret, fb_exchange_token: userToken,
      })}`);
      userToken = longToken.access_token || userToken;
      expiresIn = longToken.expires_in || expiresIn;
    } catch { /* Keep the valid short-lived token if exchange is unavailable. */ }

    const pagesResult = await graphJson(`${GRAPH}/me/accounts?${new URLSearchParams({
      fields: 'id,name,access_token', limit: '100', access_token: userToken,
    })}`);
    const pages = pagesResult.data || [];
    if (!pages.length) return redirectError('Facebook login succeeded, but no Pages were returned. Confirm this account has a Page role and pages_show_list permission.');

    const supabase = createAdminClient();
    const expiry = expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null;
    let saved = 0;
    for (const page of pages) {
      if (!page.id || !page.access_token) continue;
      const label = (page.name || 'Main').trim().slice(0, 80) || 'Main';
      const { error } = await supabase.from('social_channels_v2').upsert({
        platform: 'facebook', label, account_id: page.id, access_token: page.access_token,
        refresh_token: null, token_expires_at: expiry,
        metadata: { connection: 'facebook_oauth', auth_type: 'facebook_login', page_name: page.name || null, connected_at: new Date().toISOString() },
        is_active: true,
      }, { onConflict: 'platform,label' });
      if (error) throw new Error(`Could not save Facebook Page "${label}": ${error.message}`);
      saved++;
    }
    if (!saved) return redirectError('Facebook returned Pages, but none included a usable Page access token.');
    const res = NextResponse.redirect(`${SITE}/admin/channels?success=${encodeURIComponent(`${saved} Facebook Page(s) connected independently.`)}`);
    res.cookies.delete('facebook_oauth_state');
    return res;
  } catch (error) {
    return redirectError(`Facebook connection failed: ${error.message}`);
  }
}
