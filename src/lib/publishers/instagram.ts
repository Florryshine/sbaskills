// SBA Social Publishing — Instagram publisher (Meta Graph API, Instagram Content Publishing).
//
// Two-phase container flow (documented requirement of the IG Content Publishing API):
//   1. POST /{ig-user-id}/media            → container id (media_type REELS/POST, video_url/image_url)
//   2. Poll /{container-id}?fields=status_code until FINISHED (IN_PROGRESS → poll)
//   3. POST /{ig-user-id}/media_publish    → published media id
//
// Constraints enforced here: publicly reachable media URL (Meta fetches it server-side),
// caption ≤ 2200 chars, video for REELS/POST, image for POST.

import { apiFetch, assertPublicMediaUrl, readCredentials, requireToken, type PublishContext, type PublishResult, type PlatformPublisher } from './base'
import { classifyPlatformError } from './errors'

const GRAPH = 'https://graph.facebook.com/v21.0'
const POLL_INTERVAL_MS = 5000
const POLL_TIMEOUT_MS = 300000 // IG video processing can take minutes

export const instagramPublisher: PlatformPublisher = {
  async publish(ctx: PublishContext): Promise<PublishResult> {
    const creds = readCredentials(ctx.channel)
    const auth = requireToken(creds, 'accessToken', ctx.channel.name, 'Reconnect the Instagram channel (via the linked Facebook Login) so the token carries instagram_content_publish.')
    if ('failure' in auth) return auth.failure
    const igUserId = ctx.channel.externalId || creds.igUserId
    if (!igUserId) {
      return { success: false, error: { code: 'CHANNEL_MISCONFIGURED', message: 'No Instagram user id is set on the channel.', guidance: 'Edit the channel and fill in the IG user id (from /me/accounts → instagram_business_account).', retryable: false } }
    }

    const notPublic = assertPublicMediaUrl(ctx.payload)
    if (notPublic) return notPublic
    const media = ctx.payload.media!

    const isVideo = /^video\//i.test(media.mimeType)
    if (!isVideo && !/^image\//i.test(media.mimeType)) {
      return { success: false, error: { code: 'MEDIA_TYPE_UNSUPPORTED', message: `Instagram does not accept ${media.mimeType}.`, guidance: 'Attach a JPG/PNG image or MP4/MOV video.', retryable: false } }
    }

    const mediaType = isVideo ? (ctx.payload.content.options.igMediaType === 'POST' ? 'POST' : 'REELS') : 'POST'
    if (!isVideo && mediaType === 'REELS') {
      return { success: false, error: { code: 'MEDIA_TYPE_UNSUPPORTED', message: 'Reels placement requires a video.', guidance: 'Attach a video or switch the Instagram option to "Feed post".', retryable: false } }
    }
    const caption = ctx.payload.caption.slice(0, 2200)

    // 1. Create container
    const createRes = await apiFetch(`${GRAPH}/${igUserId}/media`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${auth.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(
        isVideo
          ? { media_type: mediaType, video_url: media.url, caption, share_to_feed: true }
          : { image_url: media.url, caption },
      ),
      timeoutMs: 120000,
    })
    if (!createRes.ok) return { success: false, error: classifyPlatformError('instagram', createRes) }
    const container = createRes.json as { id?: string }
    if (!container.id) {
      return { success: false, error: { code: 'PLATFORM_ERROR', message: 'Instagram did not return a container id.', guidance: 'Check the media URL responds with HTTP 200 and correct Content-Type.', retryable: true } }
    }

    // 2. Poll container status
    const deadline = Date.now() + POLL_TIMEOUT_MS
    let statusCode = 'IN_PROGRESS'
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
      const poll = await apiFetch(`${GRAPH}/${container.id}?fields=status_code,status`, {
        headers: { Authorization: `Bearer ${auth.token}` },
      })
      if (poll.ok) {
        statusCode = ((poll.json as { status_code?: string })?.status_code || 'IN_PROGRESS') as string
        if (statusCode === 'FINISHED' || statusCode === 'ERROR') break
      }
    }
    if (statusCode !== 'FINISHED') {
      return {
        success: false,
        error: {
          code: statusCode === 'ERROR' ? 'MEDIA_REJECTED' : 'MEDIA_PROCESS_TIMEOUT',
          message: statusCode === 'ERROR' ? 'Instagram rejected the media during processing.' : 'Instagram media processing did not finish in time.',
          guidance: 'Verify the video is MP4/MOV, ≤ 15 min (feed) / ≤ 90s+ (Reels), within Instagram size limits, and that the URL is publicly reachable.',
          retryable: statusCode !== 'ERROR',
        },
      }
    }

    // 3. Publish container
    const pub = await apiFetch(`${GRAPH}/${igUserId}/media_publish`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${auth.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ creation_id: container.id }),
    })
    if (!pub.ok) return { success: false, error: classifyPlatformError('instagram', pub) }
    const data = pub.json as { id?: string }
    return { success: true, externalId: data.id, externalUrl: data.id ? `https://www.instagram.com/${mediaType === 'REELS' ? 'reel' : 'p'}/${data.id}` : undefined }
  },
}
