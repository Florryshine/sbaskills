// lib/publish-engine.js
import { createAdminClient } from '@/lib/supabase-admin';
import { getPublisher } from '@/lib/publishers/registry';
import { PublishError } from '@/lib/publishers/base';

// Refresh 5 min before actual expiry so a slow upload (TikTok's PULL_FROM_URL
// polling, YouTube's resumable upload) never straddles the token going stale
// mid-request.
const REFRESH_SKEW_MS = 5 * 60 * 1000;

// YouTube and TikTok both issue short-lived access_tokens + a refresh_token.
// registry.js exposes `refreshToken` per-adapter but nothing was ever
// calling it — every channel would work once at connect time and then die
// the moment the access_token expired. This is the one place that now
// checks expiry, calls the adapter's refresh, and persists the rotated
// tokens back to social_channels_v2 before the publish attempt.
async function ensureFreshToken(supabase, channel, adapter) {
  if (!adapter.refreshToken) return channel;

  const expiresAt = channel.token_expires_at ? new Date(channel.token_expires_at).getTime() : null;
  const needsRefresh = !channel.access_token || (expiresAt !== null && expiresAt - Date.now() < REFRESH_SKEW_MS);
  if (!needsRefresh) return channel;

  const refreshed = await adapter.refreshToken(channel);

  await supabase
    .from('social_channels_v2')
    .update({
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token || channel.refresh_token,
      token_expires_at: refreshed.token_expires_at || channel.token_expires_at,
    })
    .eq('id', channel.id);

  return { ...channel, ...refreshed };
}

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
  let channel = job.social_channels_v2;

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
    const adapter = getPublisher(channel.platform);
    channel = await ensureFreshToken(supabase, channel, adapter);
    const result = await adapter.publish(channel, contentAsset, media || []);

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
