import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/require-admin-api';
import { listEphemeral, purgeExpiredEphemeral } from '@/lib/visual-intelligence/storage';

export const runtime = 'nodejs';

/** Ephemeral (tier B) asset management for the admin panel. */
export async function GET(request) {
  const { response } = await requireAdminApi();
  if (response) return response;
  const url = new URL(request.url);
  const includeExpired = url.searchParams.get('includeExpired') === 'true';
  const result = await listEphemeral({ includeExpired, limit: 120 });
  if (!result.ok) return NextResponse.json({ error: result.reason, items: [] }, { status: 500 });
  return NextResponse.json({ items: result.items });
}

/** Force-purge expired ephemeral assets now (normally done by the cron). */
export async function DELETE(request) {
  const { response } = await requireAdminApi();
  if (response) return response;
  const url = new URL(request.url);
  const dryRun = url.searchParams.get('dryRun') === 'true';
  const result = await purgeExpiredEphemeral({ dryRun });
  if (!result.ok) return NextResponse.json({ error: result.reason }, { status: 500 });
  return NextResponse.json({ purged: result.purged, dryRun: Boolean(result.dryRun) });
}
