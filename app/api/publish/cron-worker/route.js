// app/api/publish/cron-worker/route.js
//
// Runs on a schedule (configure in vercel.json crons, e.g. every 5 min).
// Picks up: (a) scheduled jobs whose time has arrived, and (b) queued
// jobs that failed a retryable error and are due another attempt. Never
// touches a 'draft' or 'approved'-but-not-queued job — those require an
// explicit human approve/publish action first.

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { executePublishJob } from '@/lib/publish-engine';

export async function GET() {
  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const { data: scheduledDue, error: scheduledError } = await supabase
    .from('publish_jobs')
    .select('id')
    .eq('status', 'scheduled')
    .lte('scheduled_at', now);

  const { data: retryDue, error: retryError } = await supabase
    .from('publish_jobs')
    .select('id')
    .eq('status', 'queued')
    .gt('attempt_count', 0);

  const { data: rateLimitCleared, error: rateLimitError } = await supabase
    .from('publish_jobs')
    .select('id')
    .eq('status', 'rate_limited')
    .lte('rate_limit_until', now);

  if (scheduledError || retryError || rateLimitError) {
    return NextResponse.json(
      { error: (scheduledError || retryError || rateLimitError).message },
      { status: 500 }
    );
  }

  const dueJobs = [...(scheduledDue || []), ...(retryDue || []), ...(rateLimitCleared || [])];

  const results = [];
  for (const job of dueJobs) {
    try {
      const result = await executePublishJob(job.id);
      results.push({ id: job.id, ...result });
    } catch (err) {
      results.push({ id: job.id, success: false, error: err.message });
    }
  }

  return NextResponse.json({ processed: results.length, results });
}
