// SBA Social Publishing — Telegram publisher (Bot API).
// channel.externalId = @channelusername or numeric chat id (-100… for supergroups/channels).
// The bot must be an administrator with "Post messages" on the target chat.

import { apiFetch, readCredentials, readMediaBuffer, requireToken, type PublishContext, type PublishResult, type PlatformPublisher } from './base'
import { classifyPlatformError } from './errors'

export const telegramPublisher: PlatformPublisher = {
  async publish(ctx: PublishContext): Promise<PublishResult> {
    const creds = readCredentials(ctx.channel)
    const auth = requireToken(creds, 'botToken', ctx.channel.name, 'Store the bot token (from @BotFather) on the channel credentials and make the bot an administrator of the target channel.')
    if ('failure' in auth) return auth.failure
    const chatId = ctx.channel.externalId
    if (!chatId) {
      return { success: false, error: { code: 'CHANNEL_MISCONFIGURED', message: 'No Telegram chat/channel id is set on the channel.', guidance: 'Set the external id to @channelusername or the numeric -100… chat id.', retryable: false } }
    }

    const token = auth.token
    const base = `https://api.telegram.org/bot${token}`
    const caption = ctx.payload.caption.slice(0, 1024)
    const media = ctx.payload.media

    if (media && /^video\//i.test(media.mimeType)) {
      if (/^https?:\/\//i.test(media.url)) {
        const res = await apiFetch(`${base}/sendVideo`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, video: media.url, caption }),
        })
        if (!res.ok) return { success: false, error: classifyPlatformError('telegram', res) }
        const data = res.json as { result?: { message_id?: number } }
        return { success: true, externalId: data.result?.message_id ? String(data.result.message_id) : undefined }
      }
      const buffer = await readMediaBuffer(ctx.payload)
      const form = new FormData()
      form.append('video', new Blob([new Uint8Array(buffer)], { type: media.mimeType }), 'video.mp4')
      form.append('chat_id', chatId)
      form.append('caption', caption)
      const res = await apiFetch(`${base}/sendVideo`, { method: 'POST', body: form, timeoutMs: 600000 })
      if (!res.ok) return { success: false, error: classifyPlatformError('telegram', res) }
      const data = res.json as { result?: { message_id?: number } }
      return { success: true, externalId: data.result?.message_id ? String(data.result.message_id) : undefined }
    }

    if (media && /^image\//i.test(media.mimeType)) {
      if (/^https?:\/\//i.test(media.url)) {
        const res = await apiFetch(`${base}/sendPhoto`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, photo: media.url, caption }),
        })
        if (!res.ok) return { success: false, error: classifyPlatformError('telegram', res) }
        const data = res.json as { result?: { message_id?: number } }
        return { success: true, externalId: data.result?.message_id ? String(data.result.message_id) : undefined }
      }
      const buffer = await readMediaBuffer(ctx.payload)
      const form = new FormData()
      form.append('photo', new Blob([new Uint8Array(buffer)], { type: media.mimeType }), 'image.jpg')
      form.append('chat_id', chatId)
      form.append('caption', caption)
      const res = await apiFetch(`${base}/sendPhoto`, { method: 'POST', body: form })
      if (!res.ok) return { success: false, error: classifyPlatformError('telegram', res) }
      const data = res.json as { result?: { message_id?: number } }
      return { success: true, externalId: data.result?.message_id ? String(data.result.message_id) : undefined }
    }

    const res = await apiFetch(`${base}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: ctx.payload.caption }),
    })
    if (!res.ok) return { success: false, error: classifyPlatformError('telegram', res) }
    const data = res.json as { result?: { message_id?: number } }
    return { success: true, externalId: data.result?.message_id ? String(data.result.message_id) : undefined }
  },
}
