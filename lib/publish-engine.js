// lib/publish-engine.js
import { createAdminClient } from '@/lib/supabase-admin';
import { getPublisher } from '@/lib/publishers/registry';
import { PublishError } from '@/lib/publishers/base';

/**
 * Executes a single publish_jobs row: loads the content asset + media +
 * channel, calls the right platform adapter, and records the outcome.
 * Used by both the "Publish Now" route (immediate) and the cron worker
 * (scheduled/retry sweep) so there's exactly one place retry/rate-limit
 * logic lives.
 */
export async function executePublishJob(jobId) {
  const supabase = createAdminClient();

  const { data: job, error: jobError } = await supabase
    .from('publish_jobs')
    .select('*, content_assets(*), social_channels_v2(*)')
    .eq('id', jobId)
    .single();

  if (jobError || !job) throw new Error(`Publish job not found: ${jobId}`);

  const contentAsset = job.content_assets;
  const channel = job.social_channels_v2;

  if (!channel || !channel.is_active) {
    return failJob(supabase, job, 'No active channel configured', { retryable: false });
  }

  const { data: media } = await supabase
    .from('media_files')
    .select('*')
    .eq('content_asset_id', contentAsset.id)
    .order('position', { ascending: true });

  await supabase.from('publish_jobs').update({ status: 'publishing' }).eq('id', job.id);

  try {
    const { publish } = getPublisher(channel.platform);
    const result = await publish(channel, contentAsset, media || []);

    const now = new Date().toISOString();
    await supabase
      .from('publish_jobs')
      .update({
        status: 'published',
        published_at: now,
        external_post_id: result.externalId,
        external_url: result.externalUrl || null,
      })
      .eq('id', job.id);

    await supabase.from('content_assets').update({ status: 'published' }).eq('id', contentAsset.id);

    await supabase.from('publish_history').insert({
      publish_job_id: job.id,
      content_asset_id: contentAsset.id,
      platform: channel.platform,
      status: 'success',
      response: result,
    });

    return { success: true, externalId: result.externalId };
  } catch (err) {
    const retryable = err instanceof PublishError ? err.retryable : true;
    const rateLimited = err instanceof PublishError ? err.rateLimited : false;
    return failJob(supabase, job, err.message, { retryable, rateLimited });
  }
}

async function failJob(supabase, job, message, { retryable, rateLimited }) {
  const attemptCount = (job.attempt_count || 0) + 1;
  const exhausted = attemptCount >= (job.max_attempts || 3) || !retryable;

  const update = {
    attempt_count: attemptCount,
    last_error: message,
    status: exhausted ? 'failed' : 'queued',
  };
  if (rateLimited) {
    update.status = 'rate_limited';
    update.rate_limit_until = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // back off 15 min
  }

  await supabase.from('publish_jobs').update(update).eq('id', job.id);
  await supabase.from('publish_history').insert({
    publish_job_id: job.id,
    content_asset_id: job.content_asset_id,
    platform: job.social_channels_v2?.platform,
    status: exhausted ? 'error' : 'retry',
    error: message,
  });

  return { success: false, error: message, willRetry: !exhausted };
}
