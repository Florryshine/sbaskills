import { NextResponse } from 'next/server';

// TEMPORARY — delete this file once the TikTok OAuth issue is diagnosed.
// Never returns the real key/secret values, only presence/length/shape,
// so it's safe to hit in production while debugging.
export async function GET() {
  const key = process.env.TIKTOK_CLIENT_KEY;
  const secret = process.env.TIKTOK_CLIENT_SECRET;
  const redirect = process.env.TIKTOK_REDIRECT_URI;

  return NextResponse.json({
    client_key_present: !!key,
    client_key_length: key?.length ?? 0,
    client_key_has_whitespace: key ? key !== key.trim() : null,
    client_secret_present: !!secret,
    client_secret_length: secret?.length ?? 0,
    redirect_uri: redirect ?? null,
    redirect_uri_matches_expected: redirect === 'https://shineybrainacademy.vercel.app/api/auth/tiktok/callback',
  });
}
