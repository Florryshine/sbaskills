// lib/services/social-publisher.js

export async function publishToPlatform(platform, channel, caption, mediaUrls = null) {
  switch (platform) {
    case 'facebook': return publishToFacebook(channel, caption, mediaUrls);
    case 'instagram': return publishToInstagram(channel, caption, mediaUrls);
    case 'twitter': return publishToTwitter(channel, caption, mediaUrls);
    case 'linkedin': return publishToLinkedIn(channel, caption, mediaUrls);
    case 'telegram': return publishToTelegram(channel, caption, mediaUrls);
    case 'whatsapp': return publishToWhatsApp(channel, caption, mediaUrls);
    case 'pinterest': return publishToPinterest(channel, caption, mediaUrls);
    case 'threads': return publishToThreads(channel, caption, mediaUrls);
    case 'youtube': return publishToYouTube(channel, caption, mediaUrls);
    default: throw new Error(`Unsupported platform: ${platform}`);
  }
}

// ─── FACEBOOK ──────────────────────────────────────────────
export async function publishToFacebook(channel, caption, mediaUrls) {
  const pageId = channel.account_id;
  const token = channel.access_token;
  const url = `https://graph.facebook.com/v20.0/${pageId}/feed`;
  const payload = { message: caption, access_token: token };
  if (mediaUrls && mediaUrls.length > 0) payload.link = mediaUrls[0];
  const res = await fetch(url, { method: 'POST', body: new URLSearchParams(payload) });
  const data = await res.json();
  if (data.error) throw new Error(`Facebook error: ${data.error.message}`);
  return data.id;
}

// ─── INSTAGRAM ──────────────────────────────────────────────
export async function publishToInstagram(channel, caption, mediaUrls) {
  const igUserId = channel.account_id;
  const token = channel.access_token;
  const imageUrl = Array.isArray(mediaUrls) ? mediaUrls[0] : mediaUrls;
  if (!imageUrl) throw new Error('Instagram requires an image URL');

  const createUrl = `https://graph.facebook.com/v20.0/${igUserId}/media`;
  const createPayload = { image_url: imageUrl, caption, access_token: token };
  const createRes = await fetch(createUrl, { method: 'POST', body: new URLSearchParams(createPayload) });
  const createData = await createRes.json();
  if (createData.error) throw new Error(`Instagram container error: ${createData.error.message}`);

  const publishUrl = `https://graph.facebook.com/v20.0/${igUserId}/media_publish`;
  const pubPayload = { creation_id: createData.id, access_token: token };
  const pubRes = await fetch(publishUrl, { method: 'POST', body: new URLSearchParams(pubPayload) });
  const pubData = await pubRes.json();
  if (pubData.error) throw new Error(`Instagram publish error: ${pubData.error.message}`);
  return pubData.id;
}

// ─── TWITTER / X ────────────────────────────────────────────
export async function publishToTwitter(channel, caption, mediaUrls) {
  const token = channel.access_token;
  const url = 'https://api.twitter.com/2/tweets';
  const payload = { text: caption };
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (data.errors) throw new Error(`Twitter error: ${data.errors[0].message}`);
  return data.data.id;
}

// ─── LINKEDIN ───────────────────────────────────────────────
export async function publishToLinkedIn(channel, caption, mediaUrls) {
  const token = channel.access_token;
  const author = `urn:li:person:${channel.account_id}`;
  const url = 'https://api.linkedin.com/v2/ugcPosts';
  const payload = {
    author,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: { text: caption },
        shareMediaCategory: 'NONE',
      },
    },
    visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
  };
  if (mediaUrls && mediaUrls.length > 0) {
    payload.specificContent['com.linkedin.ugc.ShareContent'].shareMediaCategory = 'IMAGE';
    payload.specificContent['com.linkedin.ugc.ShareContent'].media = mediaUrls.map(url => ({
      status: 'READY',
      originalUrl: url,
    }));
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (data.message) throw new Error(`LinkedIn error: ${data.message}`);
  return data.id;
}

// ─── TELEGRAM ───────────────────────────────────────────────
export async function publishToTelegram(channel, caption, mediaUrls) {
  const botToken = channel.access_token;
  const chatId = channel.workspace_id || channel.account_id;
  const method = mediaUrls ? 'sendPhoto' : 'sendMessage';
  const url = `https://api.telegram.org/bot${botToken}/${method}`;
  const payload = { chat_id: chatId };
  if (method === 'sendMessage') {
    payload.text = caption;
  } else {
    payload.photo = mediaUrls[0];
    payload.caption = caption;
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`Telegram error: ${data.description}`);
  return data.result.message_id;
}

// ─── WHATSAPP ───────────────────────────────────────────────
export async function publishToWhatsApp(channel, caption, mediaUrls) {
  const token = channel.access_token;
  const phoneNumberId = channel.account_id;
  const to = channel.workspace_id;
  const url = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`;
  const payload = {
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: { body: caption },
  };
  if (mediaUrls && mediaUrls.length > 0) {
    payload.type = 'image';
    payload.image = { link: mediaUrls[0] };
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (data.error) throw new Error(`WhatsApp error: ${data.error.message}`);
  return data.messages?.[0]?.id || 'sent';
}

// ─── PINTEREST ──────────────────────────────────────────────
export async function publishToPinterest(channel, caption, mediaUrls) {
  const token = channel.access_token;
  const boardId = channel.account_id;
  const imageUrl = Array.isArray(mediaUrls) ? mediaUrls[0] : mediaUrls;
  if (!imageUrl) throw new Error('Pinterest requires an image URL');
  const url = 'https://api.pinterest.com/v5/pins';
  const payload = {
    board_id: boardId,
    title: caption.substring(0, 100),
    description: caption,
    media_source: { source_type: 'image_url', url: imageUrl },
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (data.code) throw new Error(`Pinterest error: ${data.message}`);
  return data.id;
}

// ─── THREADS ────────────────────────────────────────────────
export async function publishToThreads(channel, caption, mediaUrls) {
  const userId = channel.account_id;
  const token = channel.access_token;
  const url = `https://graph.threads.net/v1.0/${userId}/threads`;
  const payload = { text: caption, access_token: token };
  if (mediaUrls && mediaUrls.length > 0) payload.image_url = mediaUrls[0];
  const createRes = await fetch(url, { method: 'POST', body: new URLSearchParams(payload) });
  const createData = await createRes.json();
  if (createData.error) throw new Error(`Threads container error: ${createData.error.message}`);

  const publishUrl = `https://graph.threads.net/v1.0/${userId}/threads_publish`;
  const pubPayload = { creation_id: createData.id, access_token: token };
  const pubRes = await fetch(publishUrl, { method: 'POST', body: new URLSearchParams(pubPayload) });
  const pubData = await pubRes.json();
  if (pubData.error) throw new Error(`Threads publish error: ${pubData.error.message}`);
  return pubData.id;
}

// ─── YOUTUBE (simplified – requires OAuth2) ──────────────
export async function publishToYouTube(channel, caption, mediaUrls) {
  // This requires full OAuth2 with refresh token; implement googleapis if needed.
  // Placeholder – you need to replace with actual Google API call.
  throw new Error('YouTube publishing requires OAuth2 setup – implement with googleapis library.');
}