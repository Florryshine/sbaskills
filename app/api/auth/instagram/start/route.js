import { NextResponse } from 'next/server';
import crypto from 'crypto';

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://shineybrainacademy.vercel.app';

export async function GET() {
  const appId = process.env.META_APP_ID;
  const configId = process.env.INSTAGRAM_UNIFIED_CONFIG_ID;
  const redirectUri = process.env.INSTAGRAM_REDIRECT_URI;

  if (!appId || !process.env.META_APP_SECRET || !configId || !redirectUri) {
    return NextResponse.redirect(`${SITE}/admin/channels?error=${encodeURIComponent('Instagram Unified Login is not configured. Add INSTAGRAM_UNIFIED_CONFIG_ID and INSTAGRAM_REDIRECT_URI in Vercel. The existing META_APP_ID and META_APP_SECRET are reused.')}`);
  }

  const state = crypto.randomUUID();
  const url = new URL('https://www.facebook.com/v24.0/dialog/oauth');
  url.searchParams.set('client_id', appId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('config_id', configId);
  url.searchParams.set('override_default_response_type', 'true');
  url.searchParams.set('prompt', 'login');
  url.searchParams.set('state', state);

  const response = NextResponse.redirect(url.toString());
  response.cookies.set('instagram_oauth_state', state, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax', maxAge: 600, path: '/',
  });
  return response;
}
