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
