// lib/publishers/pinterest.js
import { PublishError } from './base';

export async function publishPinterest(channel, contentAsset, media = []) {
  const token = channel.access_token;
  const boardId = channel.account_id;
  const image = media[0];
  if (!image) throw new PublishError('Pinterest requires an image', { retryable: false });

  const res = await fetch('https://api.pinterest.com/v5/pins', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      board_id: boardId,
      title: (contentAsset.title || '').substring(0, 100),
      description: contentAsset.body,
      media_source: { source_type: 'image_url', url: image.url },
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new PublishError(`Pinterest: ${data.message}`, { rateLimited: res.status === 429 });
  return { externalId: data.id };
}
