import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://shineybrainacademy.vercel.app';
const GRAPH = 'https://graph.facebook.com/v24.0';

async function graphJson(url) {
  const response = await fetch(url, { cache: 'no-store' });
  const data = await response.json();
  if (!response.ok || data.error) {
    throw new Error(data.error?.message || `Meta API request failed (${response.status})`);
  }
  return data;
}

function redirectError(message) {
  return NextResponse.redirect(`${SITE}/admin/channels?error=${encodeURIComponent(message)}`);
}

export async function GET(req) {
  const code = req.nextUrl.searchParams.get('code');
  const state = req.nextUrl.searchParams.get('state');
  const oauthError = req.nextUrl.searchParams.get('error_description') || req.nextUrl.searchParams.get('error');
  const savedState = req.cookies.get('meta_oauth_state')?.value;

  if (oauthError) return redirectError(`Meta authorization was not completed: ${oauthError}`);
  if (!code) return redirectError('Meta did not return an authorization code. Start Connect Meta again.');
  if (!state || !savedState || state !== savedState) {
    return redirectError('Meta security state did not match. Start Connect Meta again.');
  }

  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  const redirectUri = process.env.META_REDIRECT_URI;
  if (!appId || !appSecret || !redirectUri) return redirectError('Meta OAuth is not configured in the server environment.');

  try {
    const shortToken = await graphJson(
      `${GRAPH}/oauth/access_token?${new URLSearchParams({
        client_id: appId,
        client_secret: appSecret,
        redirect_uri: redirectUri,
        code,
      })}`
    );

    // Exchange the short-lived user token for a long-lived token when Meta permits it.
    let userToken = shortToken.access_token;
    let expiresIn = shortToken.expires_in || 0;
    try {
      const longToken = await graphJson(
        `${GRAPH}/oauth/access_token?${new URLSearchParams({
          grant_type: 'fb_exchange_token',
          client_id: appId,
          client_secret: appSecret,
          fb_exchange_token: userToken,
        })}`
      );
      userToken = longToken.access_token || userToken;
      expiresIn = longToken.expires_in || expiresIn;
    } catch {
      // Some app/account configurations may not allow token exchange; continue with the valid token.
    }

    const pagesResult = await graphJson(
      `${GRAPH}/me/accounts?${new URLSearchParams({
        fields: 'id,name,access_token,instagram_business_account{id,username}',
        limit: '100',
        access_token: userToken,
      })}`
    );
    const pages = pagesResult.data || [];
    if (!pages.length) {
      return redirectError('Meta login succeeded, but no Facebook Pages were returned. Confirm the account has a Page role and the app has pages_show_list permission.');
    }

    const supabase = createAdminClient();
    const expiry = expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null;
    let savedFacebook = 0;
    let savedInstagram = 0;

    for (const page of pages) {
      if (!page.id || !page.access_token) continue;
      const label = (page.name || 'Main').trim().slice(0, 80) || 'Main';
      const pageMetadata = {
        connection: 'meta_oauth',
        page_name: page.name || null,
        user_token_expires_at: expiry,
        connected_at: new Date().toISOString(),
      };

      const { error: fbError } = await supabase.from('social_channels_v2').upsert({
        platform: 'facebook',
        label,
        account_id: page.id,
        access_token: page.access_token,
        refresh_token: null,
        token_expires_at: expiry,
        metadata: pageMetadata,
        is_active: true,
      }, { onConflict: 'platform,label' });
      if (fbError) throw new Error(`Could not save Facebook Page "${label}": ${fbError.message}`);
      savedFacebook++;

      const ig = page.instagram_business_account;
      if (ig?.id) {
        const { error: igError } = await supabase.from('social_channels_v2').upsert({
          platform: 'instagram',
          label,
          account_id: ig.id,
          access_token: page.access_token,
          refresh_token: null,
          token_expires_at: expiry,
          metadata: {
            ...pageMetadata,
            instagram_username: ig.username || null,
            linked_facebook_page_id: page.id,
          },
          is_active: true,
        }, { onConflict: 'platform,label' });
        if (igError) throw new Error(`Could not save Instagram account for "${label}": ${igError.message}`);
        savedInstagram++;
      }
    }

    if (!savedFacebook) return redirectError('Meta returned Pages, but none included a usable Page access token.');
    const summary = `Meta connected: ${savedFacebook} Facebook Page(s), ${savedInstagram} linked Instagram account(s).`;
    const res = NextResponse.redirect(`${SITE}/admin/channels?success=${encodeURIComponent(summary)}`);
    res.cookies.delete('meta_oauth_state');
    return res;
  } catch (error) {
    return redirectError(`Meta connection failed: ${error.message}`);
  }
}
