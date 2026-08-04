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

/**
 * Refresh TikTok access token using refresh_token.
 * TikTok tokens expire after 24 hours by default.
 */
export async function refreshTikTokToken(channel) {
  if (!channel.refresh_token) {
    throw new Error('No refresh token available for TikTok');
  }

  const tokenRes = await fetch(`${API}/oauth/token/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: channel.refresh_token,
      client_key: process.env.TIKTOK_CLIENT_KEY,
      client_secret: process.env.TIKTOK_CLIENT_SECRET,
    }),
  });

  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) {
    throw new Error(`TikTok token refresh failed: ${tokenData.error?.message || 'Unknown error'}`);
  }

  return {
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token || channel.refresh_token,
    token_expires_at: tokenData.expires_in ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString() : null,
  };
}

export async function publishTikTok(channel, contentAsset, media = []) {
  const video = media.find((m) => m.media_type === 'video');
  if (!video) throw new PublishError('TikTok requires a video file', { retryable: false });

  const token = channel.access_token;
  const metadata = contentAsset.metadata || {};
  
  // Build caption with hashtags
  let caption = metadata.caption || contentAsset.body || '';
  const hashtags = metadata.hashtags || [];
  if (hashtags.length > 0) {
    caption = [caption, hashtags.join(' ')].filter(Boolean).join('\n\n');
  }

  // Privacy level from metadata or default (TikTok API values)
  const privacyLevel = metadata.privacy_level || 'PUBLIC_TO_EVERYONE';

  // Step 1: initialize upload (PULL_FROM_URL lets TikTok fetch the video
  // directly from your Supabase Storage URL instead of you streaming bytes).
  const initRes = await fetch(`${API}/post/publish/video/init/`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      post_info: {
        title: caption,
        privacy_level: privacyLevel,
        disable_duet: metadata.disableDuet ?? false,
        disable_comment: metadata.disableComment ?? false,
        disable_stitch: metadata.disableStitch ?? false,
      },
      source_info: {
        source: 'PULL_FROM_URL',
        video_url: video.url,
        video_size: video.file_size_bytes || 0,
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
  // Extended polling for longer videos (up to 3 minutes)
  for (let i = 0; i < 36; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    const statusRes = await fetch(`${API}/post/publish/status/fetch/`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ publish_id: publishId }),
    });
    const statusData = await statusRes.json();
    const status = statusData.data?.status;
    console.log(`TikTok publish status (attempt ${i + 1}): ${status}`);
    if (status === 'PUBLISH_COMPLETE') {
      console.log(`✅ TikTok video published successfully: ${publishId}`);
      return { externalId: publishId };
    }
    if (status === 'FAILED') {
      const failReason = statusData.data?.fail_reason || 'Unknown error';
      console.error(`❌ TikTok publish failed: ${failReason}`);
      throw new PublishError(`TikTok publish failed: ${failReason}`, { retryable: false });
    }
  }

  throw new PublishError('TikTok publish timed out waiting for processing', { retryable: true });
}
