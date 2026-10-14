import { NextResponse } from 'next/server';

/**
 * Fail closed: scheduled routes must never become public when CRON_SECRET
 * is missing from the deployment environment.
 *
 * Use "authorization" for Bearer tokens (Vercel Cron / GitHub Actions) and
 * "x-cron-secret" only for existing callers configured to send that header.
 */
export function authorizeCronRequest(request, headerName = 'authorization') {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: 'Cron endpoint is not configured: CRON_SECRET is missing.' },
      { status: 503 }
    );
  }

  const supplied = request.headers.get(headerName);
  const expected = headerName.toLowerCase() === 'authorization' ? `Bearer ${secret}` : secret;

  if (supplied !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return null;
}
