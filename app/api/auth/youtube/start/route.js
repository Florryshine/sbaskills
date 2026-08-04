import { NextResponse } from 'next/server';

export async function GET() {
  const state = crypto.randomUUID();

  const scope = 'https://www.googleapis.com/auth/youtube.upload';

  const url =
    'https://accounts.google.com/o/oauth2/v2/auth?' +
    new URLSearchParams({
      response_type: 'code',
      client_id: process.env.YOUTUBE_CLIENT_ID,
      redirect_uri: process.env.YOUTUBE_REDIRECT_URI,
      state,
      scope,
      access_type: 'offline',
      prompt: 'consent',
    });

  return NextResponse.redirect(url);
}
