// app/api/publish/bulk/route.js
//
// Handles both cases from the brief: "publish Instagram + Facebook now"
// and "publish everything except TikTok" — the caller just passes the
// list of jobIds it wants (already filtered in the dashboard UI) plus
// whether to publish immediately or schedule.

import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';
import { createAdminClient } from '@/lib/supabase-admin';
import { executePublishJob } from '@/lib/publish-engine';

export async function POST(request) {
  // Was importing createRouteHandlerClient from @supabase/auth-helpers-nextjs,
  // a different (legacy) cookie format than the @supabase/ssr client the rest
  // of the app's auth (login, middleware) actually uses — auth.getUser()
  // could never see a real session here, so every call 401'd regardless of
  // login state.
  const routeSupabase = createRouteHandlerClient();
  const { data: { user } } = await routeSupabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { jobIds, mode, scheduledAt } = await request.json();
    if (!Array.isArray(jobIds) || jobIds.length === 0) {
      return NextResponse.json({ error: 'jobIds[] is required' }, { status: 400 });
    }

    if (mode === 'schedule') {
      if (!scheduledAt) return NextResponse.json({ error: 'scheduledAt is required for mode=schedule' }, { status: 400 });
      const supabase = createAdminClient();
      const { error } = await supabase
        .from('publish_jobs')
        .update({ status: 'scheduled', scheduled_at: scheduledAt })
        .in('id', jobIds);
      if (error) throw error;
      return NextResponse.json({ success: true, scheduled: jobIds.length });
    }

    // mode === 'now' (default): fire all jobs in parallel, collect per-job results.
    const results = await Promise.all(
      jobIds.map(async (id) => {
        try {
          const r = await executePublishJob(id);
          return { jobId: id, ...r };
        } catch (err) {
          return { jobId: id, success: false, error: err.message };
        }
      })
    );

    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error('Bulk publish error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
