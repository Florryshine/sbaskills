import { NextResponse } from 'next/server';
import crypto from 'crypto';

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://shineybrainacademy.vercel.app';

export async function GET() {
  const appId = process.env.INSTAGRAM_APP_ID;
  const redirectUri = process.env.INSTAGRAM_REDIRECT_URI;
  if (!appId || !process.env.INSTAGRAM_APP_SECRET || !redirectUri) {
    return NextResponse.redirect(`${SITE}/admin/channels?error=${encodeURIComponent('Instagram Login is not configured. Add INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET, and INSTAGRAM_REDIRECT_URI in Vercel, then redeploy.')}`);
  }

  const state = crypto.randomUUID();
  const url = new URL('https://www.instagram.com/oauth/authorize');
  url.searchParams.set('client_id', appId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'instagram_business_basic,instagram_business_content_publish');
  url.searchParams.set('state', state);
  url.searchParams.set('force_reauth', 'true');

  const response = NextResponse.redirect(url.toString());
  response.cookies.set('instagram_oauth_state', state, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax', maxAge: 600, path: '/',
  });
  return response;
}
