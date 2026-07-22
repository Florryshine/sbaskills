import { NextResponse } from 'next/server';

export async function GET() {
  const state = crypto.randomUUID(); // real random string, not a literal placeholder

  const scope = ['openid', 'profile', 'email', 'w_member_social'].join(' ');

  const url =
    'https://www.linkedin.com/oauth/v2/authorization?' +
    new URLSearchParams({
      response_type: 'code',
      client_id: process.env.LINKEDIN_CLIENT_ID,
      redirect_uri: process.env.LINKEDIN_REDIRECT_URI,
      state,
      scope,
    });

  return NextResponse.redirect(url);
}