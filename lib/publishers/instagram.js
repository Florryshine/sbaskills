// lib/publishers/instagram.js
import { PublishError } from './base';

const GRAPH = 'https://graph.facebook.com/v20.0';

async function graphPost(path, payload) {
  const res = await fetch(`${GRAPH}${path}`, {
    method: 'POST',
    body: new URLSearchParams(payload),
  });
  const data = await res.json();
  if (data.error) {
    const rateLimited = data.error.code === 4 || data.error.code === 32 || data.error.code === 613;
    throw new PublishError(`Instagram: ${data.error.message}`, { rateLimited });
  }
  return data;
}

/**
 * media: array of { url, media_type, position } sorted by position.
 * Single image -> direct publish. Multiple images -> carousel (children).
 * Video with media_type 'video' -> Reels via media_type=REELS.
 */
export async function publishInstagram(channel, contentAsset, media = []) {
  const igUserId = channel.account_id;
  const token = channel.access_token;
  const caption = buildCaption(contentAsset);

  if (media.length === 0) {
    throw new PublishError('Instagram requires at least one media item', { retryable: false });
  }

  // ── Reels (single video) ──────────────────────────────────────────
  const video = media.find((m) => m.media_type === 'video');
  if (video && media.length === 1) {
    const create = await graphPost(`/${igUserId}/media`, {
      video_url: video.url,
      media_type: 'REELS',
      caption,
      access_token: token,
    });
    return finishPublish(igUserId, token, create.id, /* isVideo */ true);
  }

  // ── Carousel (2+ images) ────────────────────────────────────────
  if (media.length > 1) {
    const children = await Promise.all(
      media.map((m) =>
        graphPost(`/${igUserId}/media`, {
          image_url: m.url,
          is_carousel_item: 'true',
          access_token: token,
        })
      )
    );
    const create = await graphPost(`/${igUserId}/media`, {
      media_type: 'CAROUSEL',
      children: children.map((c) => c.id).join(','),
      caption,
      access_token: token,
    });
    return finishPublish(igUserId, token, create.id, false, /* isCarousel */ true);
  }

  // ── Single image ───────────────────────────────────────────────
  const create = await graphPost(`/${igUserId}/media`, {
    image_url: media[0].url,
    caption,
    access_token: token,
  });
  return finishPublish(igUserId, token, create.id, false);
}

async function finishPublish(igUserId, token, creationId, isVideo, isCarousel = false) {
  // Video containers (and carousels, which bundle multiple child containers)
  // need a moment to finish processing before they're publishable.
  if (isVideo || isCarousel) await pollUntilReady(igUserId, token, creationId);
  const pub = await graphPost(`/${igUserId}/media_publish`, {
    creation_id: creationId,
    access_token: token,
  });
  return { externalId: pub.id };
}

async function pollUntilReady(igUserId, token, creationId, attempts = 10, delayMs = 3000) {
  for (let i = 0; i < attempts; i++) {
    const res = await fetch(`${GRAPH}/${creationId}?fields=status_code&access_token=${token}`);
    const data = await res.json();
    if (data.status_code === 'FINISHED') return true;
    if (data.status_code === 'ERROR') throw new PublishError('Instagram video processing failed', { retryable: false });
    await new Promise((r) => setTimeout(r, delayMs));
  }
  throw new PublishError('Instagram video processing timed out', { retryable: true });
}

function buildCaption(contentAsset) {
  const hashtags = (contentAsset.metadata?.hashtags || []).join(' ');
  return [contentAsset.body, hashtags].filter(Boolean).join('\n\n');
}