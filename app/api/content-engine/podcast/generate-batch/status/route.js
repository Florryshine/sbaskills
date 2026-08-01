import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';

// Polled by app/admin/podcasts/paste/page.js after POSTing to
// generate-batch, which returns almost immediately with { seriesId,
// status: 'queued' } instead of waiting for every episode to finish.
export async function GET(request) {
  const seriesId = request.nextUrl.searchParams.get('seriesId');
  if (!seriesId) {
    return NextResponse.json({ error: 'seriesId is required' }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: job, error: jobError } = await supabase
    .from('podcast_batch_jobs')
    .select('*')
    .eq('id', seriesId)
    .single();
  if (jobError) {
    return NextResponse.json({ error: jobError.message }, { status: 404 });
  }

  const { data: episodes } = await supabase
    .from('podcast_episodes')
    .select('id, title, status, episode_number, total_duration_seconds, error_message')
    .eq('series_id', seriesId)
    .order('episode_number', { ascending: true });

  return NextResponse.json({
    seriesId: job.id,
    seriesTitle: job.series_title,
    status: job.status,
    episodeCount: job.episode_count,
    completedCount: job.completed_count,
    error: job.error,
    episodes: episodes || [],
  });
}
