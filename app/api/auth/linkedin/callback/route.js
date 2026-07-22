import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';

export async function GET(req) {
  const code = req.nextUrl.searchParams.get('code');
  if (!code) {
    return NextResponse.json({ error: 'Missing authorization code' }, { status: 400 });
  }

  const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: process.env.LINKEDIN_REDIRECT_URI,
      client_id: process.env.LINKEDIN_CLIENT_ID,
      client_secret: process.env.LINKEDIN_CLIENT_SECRET,
    }),
  });
  const token = await tokenRes.json();
  if (!token.access_token) {
    return NextResponse.json(token, { status: 500 });
  }

  const profileRes = await fetch('https://api.linkedin.com/v2/userinfo', {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  const profile = await profileRes.json();

  const supabase = createAdminClient();
  const { error } = await supabase
    .from('social_channels_v2') // <- your real table, not "social_channels"
    .upsert(
      {
        platform: 'linkedin',
        label: 'Main',
        account_id: profile.sub,
        access_token: token.access_token,
        metadata: profile,
        token_expires_at: new Date(Date.now() + token.expires_in * 1000).toISOString(),
        is_active: true,
      },
      { onConflict: 'platform,label' } // matches the unique constraint already in your schema
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.redirect(
    `${process.env.NEXT_PUBLIC_SITE_URL || 'https://shineybrainacademy.vercel.app'}/admin/channels?success=linkedin`
  );
}