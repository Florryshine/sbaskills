import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://shineybrainacademy.vercel.app';

function channelsRedirect(messageKey, message) {
  return NextResponse.redirect(
    `${SITE}/admin/channels?${messageKey}=${encodeURIComponent(message)}`
  );
}

export async function GET(req) {
  const code = req.nextUrl.searchParams.get('code');
  const state = req.nextUrl.searchParams.get('state');
  const savedState = req.cookies.get('linkedin_oauth_state')?.value;
  const oauthError = req.nextUrl.searchParams.get('error');

  if (oauthError) {
    const response = channelsRedirect('error', req.nextUrl.searchParams.get('error_description') || oauthError);
    response.cookies.delete('linkedin_oauth_state');
    return response;
  }

  if (!state || !savedState || state !== savedState) {
    const response = channelsRedirect('error', 'LinkedIn connection could not be verified. Please try connecting again.');
    response.cookies.delete('linkedin_oauth_state');
    return response;
  }

  if (!code) {
    const response = channelsRedirect('error', 'LinkedIn did not return an authorization code. Please try again.');
    response.cookies.delete('linkedin_oauth_state');
    return response;
  }

  const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: process.env.LINKEDIN_REDIRECT_URI,
      client_id: process.env.LINKEDIN_CLIENT_ID,
      client_secret: process.env.LINKEDIN_CLIENT_SECRET,
    }),
    cache: 'no-store',
  });
  const token = await tokenRes.json();

  if (!tokenRes.ok || !token.access_token) {
    const response = channelsRedirect('error', token.error_description || token.message || 'LinkedIn token exchange failed. Check the app credentials and redirect URL.');
    response.cookies.delete('linkedin_oauth_state');
    return response;
  }

  const profileRes = await fetch('https://api.linkedin.com/v2/userinfo', {
    headers: { Authorization: `Bearer ${token.access_token}` },
    cache: 'no-store',
  });
  const profile = await profileRes.json();

  if (!profileRes.ok || !profile.sub) {
    const response = channelsRedirect('error', profile.message || 'LinkedIn connected but the profile could not be read. Check the app’s OpenID Connect permissions.');
    response.cookies.delete('linkedin_oauth_state');
    return response;
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from('social_channels_v2')
    .upsert(
      {
        platform: 'linkedin',
        label: 'Main',
        account_id: profile.sub,
        access_token: token.access_token,
        metadata: profile,
        token_expires_at: new Date(Date.now() + (Number(token.expires_in) || 3600) * 1000).toISOString(),
        is_active: true,
      },
      { onConflict: 'platform,label' }
    );

  if (error) {
    const response = channelsRedirect('error', 'LinkedIn authorized, but saving the connection failed. Check the social_channels_v2 table and server logs.');
    response.cookies.delete('linkedin_oauth_state');
    return response;
  }

  const response = NextResponse.redirect(`${SITE}/admin/channels?success=linkedin`);
  response.cookies.delete('linkedin_oauth_state');
  return response;
}
