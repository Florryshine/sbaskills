// app/api/auth/youtube/start/route.js
//
// Keep the browser on the same host that Google will use for the callback.
// OAuth state is stored in a host-only cookie, so starting on one Vercel
// domain and returning to another causes a false state mismatch.

import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import crypto from 'crypto';

export async function GET(req) {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const redirectUri = process.env.YOUTUBE_REDIRECT_URI;

  if (!clientId || !redirectUri || !process.env.YOUTUBE_CLIENT_SECRET) {
    return NextResponse.json(
      { error: 'YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET / YOUTUBE_REDIRECT_URI not configured' },
      { status: 500 }
    );
  }

  let callbackUrl;
  try {
    callbackUrl = new URL(redirectUri);
    if (callbackUrl.protocol !== 'https:') throw new Error('HTTPS is required');
  } catch {
    return NextResponse.json(
      { error: 'YOUTUBE_REDIRECT_URI must be a valid HTTPS URL' },
      { status: 500 }
    );
  }

  // Cookies are host-only by design. If the admin page was opened through
  // another Vercel alias, move the browser to the callback's origin BEFORE
  // creating state or setting its cookie. The OAuth round-trip then stays
  // on one hostname and the callback receives the exact cookie we set.
  if (req.nextUrl.origin !== callbackUrl.origin) {
    return NextResponse.redirect(new URL('/api/auth/youtube/start', callbackUrl.origin));
  }

  const client = new google.auth.OAuth2(
    clientId,
    process.env.YOUTUBE_CLIENT_SECRET,
    redirectUri
  );

  const state = crypto.randomUUID();
  const url = client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/youtube.upload',
      'https://www.googleapis.com/auth/youtube.readonly',
    ],
    state,
  });

  const res = NextResponse.redirect(url);
  res.cookies.set('youtube_oauth_state', state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });
  return res;
}
