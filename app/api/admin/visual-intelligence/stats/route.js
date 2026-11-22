import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/require-admin-api';
import { storageStats } from '@/lib/visual-intelligence/storage';

export const runtime = 'nodejs';

/** Storage usage + dedup/tier statistics for the admin panel. */
export async function GET() {
  const { response } = await requireAdminApi();
  if (response) return response;
  const stats = await storageStats();
  if (!stats.ok) return NextResponse.json({ error: stats.reason }, { status: 500 });
  return NextResponse.json(stats);
}
