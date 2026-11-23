// SBA Social Publishing — Pinterest publisher (Pinterest API v5).
// Pins are created on a board (board_id required). Media must be a public URL.

import { apiFetch, assertPublicMediaUrl, readCredentials, requireToken, type PublishContext, type PublishResult, type PlatformPublisher } from './base'
import { classifyPlatformError } from './errors'

const API = 'https://api.pinterest.com/v5'

export const pinterestPublisher: PlatformPublisher = {
  async publish(ctx: PublishContext): Promise<PublishResult> {
    const creds = readCredentials(ctx.channel)
    const auth = requireToken(creds, 'accessToken', ctx.channel.name, 'Reconnect the Pinterest channel so the token carries pins:write.')
    if ('failure' in auth) return auth.failure

    const options = ctx.payload.content.options
    const boardId = (typeof options.boardId === 'string' && options.boardId.trim()) || creds.defaultBoardId || ''
    if (!boardId) {
      return { success: false, error: { code: 'CHANNEL_MISCONFIGURED', message: 'No Pinterest board configured.', guidance: 'Set a board id on the channel or in the Pinterest tab options (Board ID).', retryable: false } }
    }

    const notPublic = assertPublicMediaUrl(ctx.payload)
    if (notPublic) return notPublic
    const media = ctx.payload.media!
    const isVideo = /^video\//i.test(media.mimeType)

    const content = ctx.payload.content
    const body = {
      board_id: boardId,
      title: (content.title || '').slice(0, 100) || undefined,
      description: ctx.payload.caption.slice(0, 500),
      link: typeof options.link === 'string' && options.link.trim() ? options.link.trim() : undefined,
      media_source: isVideo
        ? { source_type: 'video_url', cover_image_url: ctx.payload.thumbnail?.url, video_url: media.url }
        : { source_type: 'image_url', url: media.url },
    }

    const res = await apiFetch(`${API}/pins`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${auth.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      timeoutMs: 300000,
    })
    if (!res.ok) return { success: false, error: classifyPlatformError('pinterest', res) }
    const data = res.json as { id?: string }
    return { success: true, externalId: data.id, externalUrl: data.id ? `https://www.pinterest.com/pin/${data.id}/` : undefined }
  },
}
