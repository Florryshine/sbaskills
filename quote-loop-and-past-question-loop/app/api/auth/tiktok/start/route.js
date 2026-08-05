// app/api/auth/tiktok/start/route.js
//
// PREREQUISITE (one-time, only you can do this):
// Register an app at developers.tiktok.com, add "Login Kit" +
// "Content Posting API", and request the video.publish scope — TikTok
// reviews that scope manually before it works outside sandbox mode.
// Then set TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET / TIKTOK_REDIRECT_URI
// in your environment. Nothing below substitutes for that approval step.

import { NextResponse } from 'next/server';
import crypto from 'crypto';

function base64url(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function GET() {
  if (!process.env.TIKTOK_CLIENT_KEY || !process.env.TIKTOK_REDIRECT_URI) {
    return NextResponse.json(
      { error: 'TIKTOK_CLIENT_KEY / TIKTOK_REDIRECT_URI not configured' },
      { status: 500 }
    );
  }

  const state = crypto.randomUUID();
  // PKCE: TikTok requires this for the Content Posting API — a plain
  // client_id/secret exchange alone is rejected.
  const codeVerifier = base64url(crypto.randomBytes(32));
  const codeChallenge = base64url(crypto.createHash('sha256').update(codeVerifier).digest());

  const url =
    'https://www.tiktok.com/v2/auth/authorize/?' +
    new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY,
      scope: 'user.info.basic,video.publish',
      response_type: 'code',
      redirect_uri: process.env.TIKTOK_REDIRECT_URI,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

  const res = NextResponse.redirect(url);
  // short-lived, httpOnly — only this flow ever needs to read them back
  res.cookies.set('tiktok_oauth_state', state, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 600, path: '/' });
  res.cookies.set('tiktok_code_verifier', codeVerifier, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 600, path: '/' });
  return res;
}
