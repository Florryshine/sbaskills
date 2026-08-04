import { NextResponse } from 'next/server';

export async function GET() {
  const state = crypto.randomUUID();

  // TikTok Login Kit scopes for video posting
  const scope = ['user.info.basic', 'video.upload', 'video.publish'].join(',');

  const url =
    'https://www.tiktok.com/v2/auth/authorize?' +
    new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY,
      redirect_uri: process.env.TIKTOK_REDIRECT_URI,
      state,
      scope,
      response_type: 'code',
    });

  return NextResponse.redirect(url);
}
