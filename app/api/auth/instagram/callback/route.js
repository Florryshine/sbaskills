import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://shineybrainacademy.vercel.app';
const GRAPH = 'https://graph.facebook.com/v24.0';

function redirectError(message) {
  return NextResponse.redirect(`${SITE}/admin/channels?error=${encodeURIComponent(message)}`);
}

async function graphJson(url, label) {
  const response = await fetch(url, { cache: 'no-store' });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error) {
    const error = new Error(data.error?.message || `${label} failed (${response.status})`);
    error.meta = {
      httpStatus: response.status,
      errorType: data.error?.type || null,
      errorCode: data.error?.code || null,
      errorSubcode: data.error?.error_subcode || null,
      fbtraceId: data.error?.fbtrace_id || response.headers.get('x-fb-trace-id') || null,
      requestId: response.headers.get('x-fb-request-id') || null,
    };
    throw error;
  }
  return {
    data,
    meta: {
      httpStatus: response.status,
      fbtraceId: response.headers.get('x-fb-trace-id') || null,
      requestId: response.headers.get('x-fb-request-id') || null,
    },
  };
}

function safeTokenDebug(data) {
  // Explicit allowlist: never log the token itself or any secret.
  return {
    app_id: data?.app_id || null,
    application: data?.application || null,
    type: data?.type || null,
    is_valid: typeof data?.is_valid === 'boolean' ? data.is_valid : null,
    user_id: data?.user_id || null,
    expires_at: data?.expires_at || null,
    data_access_expires_at: data?.data_access_expires_at || null,
    scopes: Array.isArray(data?.scopes) ? data.scopes : [],
    granular_scopes: Array.isArray(data?.granular_scopes)
      ? data.granular_scopes.map((item) => ({
          scope: item.scope || null,
          target_ids: Array.isArray(item.target_ids) ? item.target_ids : [],
        }))
      : [],
  };
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
  const configId = process.env.INSTAGRAM_UNIFIED_CONFIG_ID;
  if (!appId || !appSecret || !configId || !redirectUri) {
    return redirectError('Instagram Unified Login is not configured in the server environment.');
  }

  try {
    const tokenUrl = new URL(`${GRAPH}/oauth/access_token`);
    tokenUrl.search = new URLSearchParams({ client_id: appId, client_secret: appSecret, redirect_uri: redirectUri, code }).toString();
    const tokenResult = await graphJson(tokenUrl, 'Instagram authorization-code exchange');
    const tokenData = tokenResult.data;
    if (!tokenData.access_token) throw new Error('Meta did not return an access token.');
    const accessToken = tokenData.access_token;

    const accountsUrl = new URL(`${GRAPH}/me/assigned_instagram_accounts`);
    accountsUrl.search = new URLSearchParams({ fields: 'id,username', access_token: accessToken }).toString();
    const accountsResult = await graphJson(accountsUrl, 'Instagram account lookup');
    const accounts = accountsResult.data.data || [];

    if (!accounts.length) {
      const appToken = `${appId}|${appSecret}`;
      const diagnosticRequests = await Promise.allSettled([
        graphJson(new URL(`${GRAPH}/debug_token?${new URLSearchParams({ input_token: accessToken, access_token: appToken })}`), 'debug_token'),
        graphJson(new URL(`${GRAPH}/me/permissions?${new URLSearchParams({ access_token: accessToken })}`), 'permissions'),
        graphJson(new URL(`${GRAPH}/me?${new URLSearchParams({ fields: 'id,name', access_token: accessToken })}`), 'me'),
      ]);

      const diagnostic = (result) => {
        if (result.status === 'rejected') {
          return { error: result.reason?.message || 'Diagnostic request failed', meta: result.reason?.meta || null };
        }
        return result.value;
      };
      const [debugResult, permissionsResult, meResult] = diagnosticRequests.map(diagnostic);
      const debugData = debugResult?.data?.data || {};
      const permissions = permissionsResult?.data?.data || [];
      const me = meResult?.data || {};

      console.error('[IG_UNIFIED_EMPTY_ACCOUNTS]', JSON.stringify({
        event: 'instagram_unified_empty_assigned_accounts',
        appId,
        configId,
        redirectUri,
        authorization: {
          tokenType: tokenData.token_type || null,
          expiresIn: tokenData.expires_in || null,
          tokenDebug: safeTokenDebug(debugData),
        },
        permissions: Array.isArray(permissions)
          ? permissions.map((item) => ({ permission: item.permission || null, status: item.status || null }))
          : [],
        me: { id: me.id || null, name: me.name || null },
        accountLookup: {
          returnedCount: accounts.length,
          responseMeta: accountsResult.meta,
        },
        diagnostics: {
          debugToken: debugResult?.meta || null,
          permissions: permissionsResult?.meta || null,
          me: meResult?.meta || null,
        },
      }));

      throw new Error('Login succeeded, but Meta returned no Instagram accounts. Diagnostic details were recorded in the Vercel function log as IG_UNIFIED_EMPTY_ACCOUNTS. No access token or app secret was logged.');
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
    console.error('[IG_UNIFIED_CALLBACK_ERROR]', JSON.stringify({
      message: error?.message || 'Unknown Instagram OAuth callback error',
      meta: error?.meta || null,
    }));
    return redirectError(`Instagram connection failed: ${error.message}`);
  }
}
