import { NextResponse } from 'next/server';
import { authorizeCronRequest } from '@/lib/cronAuth';
import { purgeExpiredEphemeral } from '@/lib/visual-intelligence/storage';
import { createAdminClient } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Storage hygiene cron: purge expired ephemeral media (tier B) and expired
 * search-cache rows (tier A). Safe to run frequently; purges are bounded.
 */
export async function GET(request) {
  const authError = authorizeCronRequest(request, 'authorization');
  if (authError) return authError;

  const ephemeral = await purgeExpiredEphemeral({ dryRun: false });

  // Tier A rows are deleted directly (they are tiny JSON blobs).
  let cachePurged = 0;
  let cacheError = null;
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.from('visual_search_cache')
      .delete().lt('expires_at', new Date().toISOString()).select('cache_key');
    if (error) cacheError = error.message;
    else cachePurged = (data || []).length;
  } catch (error) {
    cacheError = error?.message || 'cache purge failed';
  }

  return NextResponse.json({
    ephemeral: { purged: ephemeral.purged?.length || 0, ok: ephemeral.ok, reason: ephemeral.reason || null },
    searchCache: { purged: cachePurged, error: cacheError },
    ranAt: new Date().toISOString(),
  });
}
