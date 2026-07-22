// lib/publishers/linkedin.js
import { PublishError, buildCaptionWithHashtags } from './base';

const API = 'https://api.linkedin.com/v2';

async function registerUpload(token, author, recipe) {
  const res = await fetch(`${API}/assets?action=registerUpload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      registerUploadRequest: {
        recipes: [recipe],
        owner: author,
        serviceRelationships: [{ relationshipType: 'OWNER', identifier: 'urn:li:userGeneratedContent' }],
      },
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new PublishError(`LinkedIn upload registration: ${data.message}`);
  return data.value; // { asset, uploadMechanism }
}

async function uploadBinary(uploadUrl, token, mediaUrl) {
  const fileRes = await fetch(mediaUrl);
  const buffer = await fileRes.arrayBuffer();
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: Buffer.from(buffer),
  });
  if (!res.ok) throw new PublishError('LinkedIn binary upload failed');
}

export async function publishLinkedIn(channel, contentAsset, media = []) {
  const token = channel.access_token;
  const author = `urn:li:person:${channel.account_id}`;
  const text = buildCaptionWithHashtags(contentAsset.body, contentAsset.metadata?.hashtags);

  let shareMediaCategory = 'NONE';
  let mediaAssets = [];

  if (media.length > 0) {
    const isVideo = media[0].media_type === 'video';
    shareMediaCategory = isVideo ? 'VIDEO' : 'IMAGE';
    const recipe = isVideo ? 'urn:li:digitalmediaRecipe:feedshare-video' : 'urn:li:digitalmediaRecipe:feedshare-image';

    for (const m of media) {
      const { asset, uploadMechanism } = await registerUpload(token, author, recipe);
      const uploadUrl = uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'].uploadUrl;
      await uploadBinary(uploadUrl, token, m.url);
      mediaAssets.push({ status: 'READY', media: asset });
    }
  }

  const payload = {
    author,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: { text },
        shareMediaCategory,
        ...(mediaAssets.length > 0 ? { media: mediaAssets } : {}),
      },
    },
    visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
  };

  const res = await fetch(`${API}/ugcPosts`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new PublishError(`LinkedIn: ${data.message}`, { rateLimited: res.status === 429 });
  return { externalId: data.id };
}
