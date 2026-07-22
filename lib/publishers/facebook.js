// lib/publishers/facebook.js
import { PublishError, buildCaptionWithHashtags } from './base';

const GRAPH = 'https://graph.facebook.com/v20.0';

async function graphPost(path, payload) {
  const res = await fetch(`${GRAPH}${path}`, { method: 'POST', body: new URLSearchParams(payload) });
  const data = await res.json();
  if (data.error) {
    const rateLimited = data.error.code === 4 || data.error.code === 32;
    throw new PublishError(`Facebook: ${data.error.message}`, { rateLimited });
  }
  return data;
}

export async function publishFacebook(channel, contentAsset, media = []) {
  const pageId = channel.account_id;
  const token = channel.access_token;
  const message = buildCaptionWithHashtags(contentAsset.body, contentAsset.metadata?.hashtags);

  const video = media.find((m) => m.media_type === 'video');
  if (video) {
    const data = await graphPost(`/${pageId}/videos`, {
      file_url: video.url,
      description: message,
      access_token: token,
    });
    return { externalId: data.id };
  }

  if (media.length > 1) {
    // Multi-photo native post: upload each unpublished, then attach to one feed post.
    const uploaded = await Promise.all(
      media.map((m) =>
        graphPost(`/${pageId}/photos`, { url: m.url, published: 'false', access_token: token })
      )
    );
    const attached = uploaded.map((u) => ({ media_fbid: u.id }));
    const data = await graphPost(`/${pageId}/feed`, {
      message,
      attached_media: JSON.stringify(attached),
      access_token: token,
    });
    return { externalId: data.id };
  }

  if (media.length === 1) {
    const data = await graphPost(`/${pageId}/photos`, {
      url: media[0].url,
      caption: message,
      access_token: token,
    });
    return { externalId: data.post_id || data.id };
  }

  // No media at all — plain text/link post.
  const data = await graphPost(`/${pageId}/feed`, { message, access_token: token });
  return { externalId: data.id };
}
