// lib/publishers/x.js
import { PublishError } from './base';

async function uploadMedia(token, mediaUrl, mediaType) {
  const fileRes = await fetch(mediaUrl);
  const buffer = Buffer.from(await fileRes.arrayBuffer());
  const category = mediaType === 'video' ? 'tweet_video' : 'tweet_image';

  const form = new FormData();
  form.append('media', new Blob([buffer]));
  form.append('media_category', category);

  const res = await fetch('https://upload.twitter.com/1.1/media/upload.json', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const data = await res.json();
  if (data.errors) throw new PublishError(`X media upload: ${data.errors[0].message}`);
  return data.media_id_string;
}

async function postTweet(token, text, mediaIds = [], replyToId = null) {
  const payload = { text };
  if (mediaIds.length > 0) payload.media = { media_ids: mediaIds };
  if (replyToId) payload.reply = { in_reply_to_tweet_id: replyToId };

  const res = await fetch('https://api.twitter.com/2/tweets', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (data.errors) {
    const rateLimited = res.status === 429;
    throw new PublishError(`X: ${data.errors[0].message}`, { rateLimited });
  }
  return data.data.id;
}

export async function publishX(channel, contentAsset, media = []) {
  const token = channel.access_token;
  // X's API rejects more than 4 media_ids per tweet. The generator already
  // requests only 3-4 carousel slides for X, but this cap stays here too
  // as a safety net in case media ever comes from somewhere else with more.
  const cappedMedia = media.slice(0, 4);
  const mediaIds = await Promise.all(cappedMedia.map((m) => uploadMedia(token, m.url, m.media_type)));

  const thread = contentAsset.metadata?.thread;
  if (Array.isArray(thread) && thread.length > 0) {
    let previousId = null;
    let firstId = null;
    for (let i = 0; i < thread.length; i++) {
      const id = await postTweet(token, thread[i], i === 0 ? mediaIds : [], previousId);
      if (i === 0) firstId = id;
      previousId = id;
    }
    return { externalId: firstId };
  }

  const id = await postTweet(token, contentAsset.body, mediaIds);
  return { externalId: id };
}
