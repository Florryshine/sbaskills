// app/api/publish/approve/route.js
//
// The human-in-the-loop gate. Approving a draft does NOT publish it — it
// only marks it approved and creates one publish_jobs row per selected
// channel, each still requiring an explicit "publish now" or "schedule"
// call. This route never talks to any external platform API.

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';

export async function POST(request) {
  try {
    const { contentAssetId, channelIds } = await request.json();
    if (!contentAssetId || !Array.isArray(channelIds) || channelIds.length === 0) {
      return NextResponse.json({ error: 'contentAssetId and channelIds[] are required' }, { status: 400 });
    }

    const supabase = createAdminClient();

    const { error: updateError } = await supabase
      .from('content_assets')
      .update({ status: 'approved' })
      .eq('id', contentAssetId);
    if (updateError) throw updateError;

    const jobs = channelIds.map((channelId) => ({
      content_asset_id: contentAssetId,
      channel_id: channelId,
      status: 'queued',
    }));

    const { data: inserted, error: insertError } = await supabase
      .from('publish_jobs')
      .insert(jobs)
      .select();
    if (insertError) throw insertError;

    return NextResponse.json({ success: true, jobs: inserted });
  } catch (error) {
    console.error('Approve error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
