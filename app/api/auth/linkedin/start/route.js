import { NextResponse } from 'next/server';
import crypto from 'crypto';

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://shineybrainacademy.vercel.app';

export async function GET() {
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const redirectUri = process.env.LINKEDIN_REDIRECT_URI;

  if (!clientId || !process.env.LINKEDIN_CLIENT_SECRET || !redirectUri) {
    return NextResponse.redirect(
      `${SITE}/admin/channels?error=${encodeURIComponent('LinkedIn OAuth is not configured. Add LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET, and LINKEDIN_REDIRECT_URI in Vercel, then redeploy.')}`
    );
  }

  const state = crypto.randomUUID();
  const scope = ['openid', 'profile', 'email', 'w_member_social'].join(' ');
  const url = new URL('https://www.linkedin.com/oauth/v2/authorization');
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('state', state);
  url.searchParams.set('scope', scope);

  const response = NextResponse.redirect(url.toString());
  response.cookies.set('linkedin_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });
  return response;
}
