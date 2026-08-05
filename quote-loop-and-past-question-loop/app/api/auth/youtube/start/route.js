// app/api/auth/youtube/start/route.js
//
// PREREQUISITE (one-time, only you can do this):
// In Google Cloud Console: enable "YouTube Data API v3", create an OAuth2
// Client ID (type: Web application), add YOUTUBE_REDIRECT_URI as an
// authorized redirect URI, and — since this app isn't Google-verified —
// add your own Google account as a Test User under the OAuth consent
// screen, or every login will be blocked with "app not verified".
// Set YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET / YOUTUBE_REDIRECT_URI.

import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import crypto from 'crypto';

export async function GET() {
  if (!process.env.YOUTUBE_CLIENT_ID || !process.env.YOUTUBE_REDIRECT_URI) {
    return NextResponse.json(
      { error: 'YOUTUBE_CLIENT_ID / YOUTUBE_REDIRECT_URI not configured' },
      { status: 500 }
    );
  }

  const client = new google.auth.OAuth2(
    process.env.YOUTUBE_CLIENT_ID,
    process.env.YOUTUBE_CLIENT_SECRET,
    process.env.YOUTUBE_REDIRECT_URI
  );

  const state = crypto.randomUUID();

  const url = client.generateAuthUrl({
    // 'offline' + prompt:'consent' together are what makes Google actually
    // issue a refresh_token — with only one of the two, a browser that has
    // already granted access before gets access_token-only on repeat auth.
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/youtube.upload',
      'https://www.googleapis.com/auth/youtube.readonly',
    ],
    state,
  });

  const res = NextResponse.redirect(url);
  res.cookies.set('youtube_oauth_state', state, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 600, path: '/' });
  return res;
}
