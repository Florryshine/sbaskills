import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';

// Polled by app/admin/podcasts/paste/page.js (single-episode mode) and
// usable anywhere else a single episodeId needs a status check, following
// the same pattern already used for batch series
// (generate-batch/status/route.js).
export async function GET(request) {
  const episodeId = request.nextUrl.searchParams.get('episodeId');
  if (!episodeId) {
    return NextResponse.json({ error: 'episodeId is required' }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: episode, error } = await supabase
    .from('podcast_episodes')
    .select('id, title, status, style, total_duration_seconds, error_message, knowledge_asset_id')
    .eq('id', episodeId)
    .single();

  if (error || !episode) {
    return NextResponse.json({ error: 'Episode not found' }, { status: 404 });
  }

  let segmentCount = 0;
  let failedSegments = 0;
  if (episode.status === 'ready' || episode.status === 'failed') {
    const { data: segments } = await supabase
      .from('podcast_segments')
      .select('audio_url')
      .eq('episode_id', episodeId);
    segmentCount = segments?.length || 0;
    failedSegments = (segments || []).filter((s) => !s.audio_url).length;
  }

  return NextResponse.json({
    episodeId: episode.id,
    title: episode.title,
    status: episode.status,
    style: episode.style,
    totalDurationSeconds: episode.total_duration_seconds,
    errorMessage: episode.error_message,
    knowledgeAssetId: episode.knowledge_asset_id,
    segmentCount,
    failedSegments,
  });
}
