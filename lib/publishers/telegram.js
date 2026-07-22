// lib/publishers/telegram.js
import { PublishError, buildCaptionWithHashtags } from './base';

async function telegramCall(botToken, method, payload) {
  const res = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!data.ok) {
    const rateLimited = data.error_code === 429;
    throw new PublishError(`Telegram: ${data.description}`, { rateLimited });
  }
  return data.result;
}

export async function publishTelegram(channel, contentAsset, media = []) {
  const botToken = channel.access_token;
  const chatId = channel.account_id;
  const caption = buildCaptionWithHashtags(contentAsset.body, contentAsset.metadata?.hashtags);

  if (media.length === 0) {
    const result = await telegramCall(botToken, 'sendMessage', { chat_id: chatId, text: caption });
    return { externalId: String(result.message_id) };
  }

  if (media.length > 1) {
    // sendMediaGroup — caption only allowed on the first item.
    const group = media.map((m, i) => ({
      type: m.media_type === 'video' ? 'video' : 'photo',
      media: m.url,
      caption: i === 0 ? caption : undefined,
    }));
    const result = await telegramCall(botToken, 'sendMediaGroup', { chat_id: chatId, media: group });
    return { externalId: String(result[0]?.message_id) };
  }

  const single = media[0];
  const methodByType = {
    video: 'sendVideo',
    document: 'sendDocument',
    audio: 'sendAudio',
    image: 'sendPhoto',
  };
  const method = methodByType[single.media_type] || 'sendPhoto';
  const fieldByMethod = { sendVideo: 'video', sendDocument: 'document', sendAudio: 'audio', sendPhoto: 'photo' };

  const result = await telegramCall(botToken, method, {
    chat_id: chatId,
    [fieldByMethod[method]]: single.url,
    caption,
  });
  return { externalId: String(result.message_id) };
}
