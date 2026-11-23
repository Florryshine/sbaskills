// SBA Social Publishing — TikTok publisher (Content Posting API v2).
//
// Flow: init publish (PULL_FROM_URL) → poll status/fetch → STATUS_PUBLISHED.
// Requires a publicly reachable video URL. Options: privacy level, comment/duet/stitch.

import { apiFetch, assertPublicMediaUrl, readCredentials, requireToken, type PublishContext, type PublishResult, type PlatformPublisher } from './base'
import { classifyPlatformError } from './errors'

const API = 'https://open.tiktokapis.com/v2'

export const tiktokPublisher: PlatformPublisher = {
  async publish(ctx: PublishContext): Promise<PublishResult> {
    const creds = readCredentials(ctx.channel)
    const auth = requireToken(creds, 'accessToken', ctx.channel.name, 'Reconnect the TikTok channel so the token carries video.publish (Content Posting API).')
    if ('failure' in auth) return auth.failure

    const notPublic = assertPublicMediaUrl(ctx.payload)
    if (notPublic) return notPublic
    const media = ctx.payload.media!
    if (!/^video\//i.test(media.mimeType)) {
      return { success: false, error: { code: 'MEDIA_TYPE_UNSUPPORTED', message: `TikTok requires a video file — got ${media.mimeType}.`, guidance: 'Select a video asset when publishing to TikTok.', retryable: false } }
    }

    const options = ctx.payload.content.options
    const title = ctx.payload.caption.slice(0, 2200)

    const init = await apiFetch(`${API}/post/publish/video/init/`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${auth.token}`, 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify({
        post_info: {
          title,
          privacy_level: typeof options.privacy === 'string' && options.privacy ? options.privacy : 'EVERYONE',
          disable_comment: options.disableComment === true,
          disable_duet: options.disableDuet === true,
          disable_stitch: options.disableStitch === true,
        },
        source_info: { source: 'PULL_FROM_URL', video_url: media.url },
      }),
      timeoutMs: 120000,
    })
    if (!init.ok) return { success: false, error: classifyPlatformError('tiktok', init) }
    const initJson = init.json as { data?: { publish_id?: string }; error?: { code?: string; message?: string } }
    if (initJson.error?.code && initJson.error.code !== 'ok') {
      return { success: false, error: classifyPlatformError('tiktok', init) }
    }
    const publishId = initJson.data?.publish_id
    if (!publishId) {
      return { success: false, error: { code: 'PLATFORM_ERROR', message: 'TikTok did not return a publish id.', guidance: 'Verify the video URL is publicly reachable and the app has video.publish granted.', retryable: true } }
    }

    // Poll until published or timeout
    const deadline = Date.now() + 180000
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 5000))
      const poll = await apiFetch(`${API}/post/publish/status/fetch/`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${auth.token}`, 'Content-Type': 'application/json; charset=UTF-8' },
        body: JSON.stringify({ publish_id: publishId }),
      })
      if (poll.ok) {
        const status = poll.json as { data?: { status?: string; fail_reason?: string[] } }
        if (status.data?.status === 'PUBLISHED') {
          return { success: true, externalId: publishId, externalUrl: undefined }
        }
        if (status.data?.status === 'FAILED') {
          return {
            success: false,
            error: {
              code: 'MEDIA_REJECTED',
              message: `TikTok rejected the video: ${(status.data.fail_reason || []).join('; ') || 'unknown reason'}.`,
              guidance: 'Check video specs: MP4/WebM, 5s–10min, ≤ 4GB (URL pull), and content policy compliance.',
              retryable: false,
            },
          }
        }
      }
    }
    return { success: false, error: { code: 'MEDIA_PROCESS_TIMEOUT', message: 'TikTok did not finish processing within the wait window.', guidance: 'The post may still appear; retry only after confirming it was not published.', retryable: true } }
  },
}
