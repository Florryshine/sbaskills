// lib/publishers/tiktok.js
//
// PREREQUISITE (not code — approval steps only you can complete):
// 1. Register an app at developers.tiktok.com and request the "Content
//    Posting API" (video.publish) scope — TikTok manually reviews this,
//    it is not instant.
// 2. Complete the OAuth2 flow for your account to get access_token/refresh_token.
// 3. Store those on the social_channels_v2 row for platform='tiktok'.
// Until TikTok approves the scope, calls below will return a 403 — that's
// TikTok's review gate, not a bug in this code.

import { PublishError } from './base';

const API = 'https://open.tiktokapis.com/v2';

export async function publishTikTok(channel, contentAsset, media = []) {
  const video = media.find((m) => m.media_type === 'video');
  if (!video) throw new PublishError('TikTok requires a video file', { retryable: false });

  const token = channel.access_token;
  const caption = contentAsset.metadata?.caption || contentAsset.body || '';

  // Step 1: initialize upload (PULL_FROM_URL lets TikTok fetch the video
  // directly from your Supabase Storage URL instead of you streaming bytes).
  const initRes = await fetch(`${API}/post/publish/video/init/`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      post_info: {
        title: caption,
        privacy_level: 'PUBLIC_TO_EVERYONE',
        disable_duet: false,
        disable_comment: false,
        disable_stitch: false,
      },
      source_info: {
        source: 'PULL_FROM_URL',
        video_url: video.url,
      },
    }),
  });
  const initData = await initRes.json();
  if (!initRes.ok || initData.error?.code !== 'ok') {
    const rateLimited = initRes.status === 429;
    throw new PublishError(`TikTok init: ${initData.error?.message || initRes.statusText}`, { rateLimited });
  }

  const publishId = initData.data.publish_id;

  // Step 2: poll status — TikTok processes the pulled video asynchronously.
  for (let i = 0; i < 10; i++) {
    await new Promise((r) => setTimeout(r, 4000));
    const statusRes = await fetch(`${API}/post/publish/status/fetch/`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ publish_id: publishId }),
    });
    const statusData = await statusRes.json();
    const status = statusData.data?.status;
    if (status === 'PUBLISH_COMPLETE') {
      return { externalId: publishId };
    }
    if (status === 'FAILED') {
      throw new PublishError(`TikTok publish failed: ${statusData.data?.fail_reason}`, { retryable: false });
    }
  }

  throw new PublishError('TikTok publish timed out waiting for processing', { retryable: true });
}

// TikTok access tokens expire in 24h; refresh_tokens are valid ~365 days
// but ROTATE on every use — the caller (publish-engine's ensureFreshToken)
// must persist the new refresh_token we return here, not just the new
// access_token, or the next refresh will fail with an already-used token.
export async function refreshTikTokToken(channel) {
  if (!channel.refresh_token) {
    throw new PublishError(
      'TikTok channel has no refresh_token on file — reconnect it from /admin/channels',
      { retryable: false }
    );
  }

  const res = await fetch(`${API}/oauth/token/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Cache-Control': 'no-cache' },
    body: new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY,
      client_secret: process.env.TIKTOK_CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: channel.refresh_token,
    }),
  });
  const data = await res.json();
  if (!data.access_token) {
    // A dead refresh_token (revoked, expired, or already-rotated) needs a
    // human to reconnect — retrying automatically will never succeed.
    throw new PublishError(
      `TikTok token refresh failed: ${data.error_description || data.error || res.statusText}`,
      { retryable: false }
    );
  }

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token || channel.refresh_token,
    token_expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
  };
}
