import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://shineybrainacademy.vercel.app';
const GRAPH = 'https://graph.facebook.com/v24.0';

function redirectError(message) {
  return NextResponse.redirect(`${SITE}/admin/channels?error=${encodeURIComponent(message)}`);
}

async function graphJson(url, label) {
  const response = await fetch(url, { cache: 'no-store' });
  const data = await response.json();
  if (!response.ok || data.error) throw new Error(data.error?.message || `${label} failed (${response.status})`);
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

  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  const redirectUri = process.env.INSTAGRAM_REDIRECT_URI;
  if (!appId || !appSecret || !process.env.INSTAGRAM_UNIFIED_CONFIG_ID || !redirectUri) {
    return redirectError('Instagram Unified Login is not configured in the server environment.');
  }

  try {
    const tokenUrl = new URL(`${GRAPH}/oauth/access_token`);
    tokenUrl.search = new URLSearchParams({ client_id: appId, client_secret: appSecret, redirect_uri: redirectUri, code }).toString();
    const tokenData = await graphJson(tokenUrl, 'Instagram authorization-code exchange');
    if (!tokenData.access_token) throw new Error('Meta did not return an access token.');
    const accessToken = tokenData.access_token;

    const accountsUrl = new URL(`${GRAPH}/me/assigned_instagram_accounts`);
    accountsUrl.search = new URLSearchParams({ fields: 'id,username', access_token: accessToken }).toString();
    const accountsData = await graphJson(accountsUrl, 'Instagram account lookup');
    const accounts = accountsData.data || [];
    if (!accounts.length) {
      throw new Error('Login succeeded, but Meta returned no Instagram accounts. Confirm @shineybrainacademy is assigned to the business and included in this app configuration, then reconnect.');
    }

    const supabase = createAdminClient();
    let saved = 0;
    for (const account of accounts) {
      if (!account.id) continue;
      const username = (account.username || `instagram_${account.id}`).trim();
      const label = username.startsWith('@') ? username.slice(1).slice(0, 80) : username.slice(0, 80);
      const { error } = await supabase.from('social_channels_v2').upsert({
        platform: 'instagram', label, account_id: String(account.id), access_token: accessToken,
        refresh_token: null, token_expires_at: null,
        metadata: {
          connection: 'instagram_unified_login',
          auth_type: 'system_user_access_token',
          instagram_username: account.username || null,
          connected_at: new Date().toISOString(),
        },
        is_active: true,
      }, { onConflict: 'platform,label' });
      if (error) throw new Error(`Could not save Instagram account "${label}": ${error.message}`);
      saved++;
    }

    if (!saved) throw new Error('Meta returned Instagram accounts without usable account IDs.');
    const response = NextResponse.redirect(`${SITE}/admin/channels?success=${encodeURIComponent(`${saved} Instagram account(s) connected independently.`)}`);
    response.cookies.delete('instagram_oauth_state');
    return response;
  } catch (error) {
    return redirectError(`Instagram connection failed: ${error.message}`);
  }
}
