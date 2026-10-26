import { NextResponse } from 'next/server';
import crypto from 'crypto';

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://shineybrainacademy.vercel.app';

export async function GET() {
  const appId = process.env.META_APP_ID;
  const redirectUri = process.env.META_REDIRECT_URI;
  if (!appId || !process.env.META_APP_SECRET || !redirectUri) {
    return NextResponse.redirect(`${SITE}/admin/channels?error=${encodeURIComponent('Meta OAuth is not configured. Add META_APP_ID, META_APP_SECRET, and META_REDIRECT_URI in Vercel, then redeploy.')}`);
  }

  const state = crypto.randomUUID();
  const scopes = [
    'pages_show_list',
    'pages_read_engagement',
    'pages_manage_posts',
    'instagram_basic',
    'instagram_content_publish',
  ].join(',');

  const url = new URL('https://www.facebook.com/v24.0/dialog/oauth');
  url.searchParams.set('client_id', appId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('state', state);
  url.searchParams.set('scope', scopes);
  url.searchParams.set('auth_type', 'rerequest');

  const response = NextResponse.redirect(url.toString());
  response.cookies.set('meta_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });
  return response;
}
