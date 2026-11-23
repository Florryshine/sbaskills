// SBA Social Publishing — Facebook publisher (Meta Graph API, Page publishing).
//
// Facebook PAGE publishing remains fully supported by Meta (unlike Groups — see
// fb-groups module). Supported here:
//   - video  → POST /{page-id}/videos       (multipart file or file_url)
//   - image  → POST /{page-id}/photos       (multipart file or url param)
//   - text   → POST /{page-id}/feed         (message)
// Token type: a PAGE access token with pages_manage_posts (+ pages_read_engagement).

import { apiFetch, readCredentials, readMediaBuffer, requireToken, type PublishContext, type PublishResult, type PlatformPublisher } from './base'
import { classifyPlatformError } from './errors'

const GRAPH = 'https://graph.facebook.com/v21.0'

function pageToken(ctx: PublishContext, creds: Record<string, string>): string | null {
  // Prefer a page token; fall back to a user token that was exchanged with the page scope
  return creds.pageAccessToken || creds.accessToken || null
}

export const facebookPublisher: PlatformPublisher = {
  async publish(ctx: PublishContext): Promise<PublishResult> {
    const creds = readCredentials(ctx.channel)
    const auth = requireToken(creds, 'pageAccessToken', ctx.channel.name, 'Reconnect the Facebook Page (OAuth) so the app receives a Page access token with pages_manage_posts. A user token alone cannot post to a Page.')
    // fall back: some existing channels store a long-lived user token with page scope
    let token = 'failure' in auth ? pageToken(ctx, creds) : auth.token
    if (!token) {
      return {
        success: false,
        error: {
          code: 'CREDENTIALS_MISSING',
          message: `${ctx.channel.name} has no Page access token.`,
          guidance: 'Reconnect the Facebook Page channel (OAuth) so the system receives a Page access token with pages_manage_posts.',
          retryable: false,
        },
      }
    }
    const pageId = ctx.channel.externalId || creds.pageId
    if (!pageId) {
      return { success: false, error: { code: 'CHANNEL_MISCONFIGURED', message: 'No Facebook Page id is set on the channel.', guidance: 'Edit the channel and fill in the Page ID (the numeric id or page name from the page URL).', retryable: false } }
    }

    const media = ctx.payload.media
    const caption = ctx.payload.caption

    // Video
    if (media && /^video\//i.test(media.mimeType)) {
      // file_url when the URL is publicly reachable (Graph fetches server-side);
      // multipart otherwise.
      if (/^https?:\/\//i.test(media.url)) {
        const res = await apiFetch(`${GRAPH}/${pageId}/videos`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ file_url: media.url, description: caption }),
          timeoutMs: 300000,
        })
        if (!res.ok) return { success: false, error: classifyPlatformError('facebook', res) }
        const data = res.json as { id?: string }
        return { success: true, externalId: data.id, externalUrl: await permalink(token, data.id) }
      }
      const buffer = await readMediaBuffer(ctx.payload)
      const form = new FormData()
      form.append('file', new Blob([new Uint8Array(buffer)], { type: media.mimeType }), `video.${media.mimeType.split('/')[1] || 'mp4'}`)
      form.append('description', caption)
      const res = await apiFetch(`${GRAPH}/${pageId}/videos?access_token=${encodeURIComponent(token)}`, { method: 'POST', body: form, timeoutMs: 600000 })
      if (!res.ok) return { success: false, error: classifyPlatformError('facebook', res) }
      const data = res.json as { id?: string }
      return { success: true, externalId: data.id, externalUrl: await permalink(token, data.id) }
    }

    // Image
    if (media && /^image\//i.test(media.mimeType)) {
      if (/^https?:\/\//i.test(media.url)) {
        const res = await apiFetch(`${GRAPH}/${pageId}/photos`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: media.url, caption }),
        })
        if (!res.ok) return { success: false, error: classifyPlatformError('facebook', res) }
        const data = res.json as { id?: string; post_id?: string }
        return { success: true, externalId: data.post_id || data.id, externalUrl: await permalink(token, data.post_id || data.id) }
      }
      const buffer = await readMediaBuffer(ctx.payload)
      const form = new FormData()
      form.append('file', new Blob([new Uint8Array(buffer)], { type: media.mimeType }), `image.${media.mimeType.split('/')[1] || 'png'}`)
      form.append('caption', caption)
      const res = await apiFetch(`${GRAPH}/${pageId}/photos?access_token=${encodeURIComponent(token)}`, { method: 'POST', body: form })
      if (!res.ok) return { success: false, error: classifyPlatformError('facebook', res) }
      const data = res.json as { id?: string; post_id?: string }
      return { success: true, externalId: data.post_id || data.id, externalUrl: await permalink(token, data.post_id || data.id) }
    }

    // Text-only
    const res = await apiFetch(`${GRAPH}/${pageId}/feed`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: caption }),
    })
    if (!res.ok) return { success: false, error: classifyPlatformError('facebook', res) }
    const data = res.json as { id?: string }
    return { success: true, externalId: data.id, externalUrl: await permalink(token, data.id) }
  },
}

/** Resolve the canonical permalink for a published object (warning-only on failure). */
async function permalink(token: string, id?: string): Promise<string | undefined> {
  if (!id) return undefined
  const res = await apiFetch(`${GRAPH}/${id}?fields=permalink_url`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const url = (res.json as { permalink_url?: string } | null)?.permalink_url
  return url ? `https://www.facebook.com${url}` : undefined
}
