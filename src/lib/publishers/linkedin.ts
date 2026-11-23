// SBA Social Publishing — LinkedIn publisher (Community Management API, REST).
//
// Flow for media posts:
//   1. initializeUpload (videos/images) → uploadUrl + asset urn
//   2. PUT file bytes to uploadUrl
//   3. POST /rest/posts {author, commentary, content:{contentEntities:[{entity: urn}]}}
// Text-only posts skip steps 1–2.

import { apiFetch, readCredentials, readMediaBuffer, requireToken, type PublishContext, type PublishResult, type PlatformPublisher } from './base'
import { classifyPlatformError } from './errors'

const REST = 'https://api.linkedin.com/rest'
const VERSION = '202411'
const PROTOCOL = '2.0.0'

function headers(token: string, extra: Record<string, string> = {}): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    'LinkedIn-Version': VERSION,
    'X-Restli-Protocol-Version': PROTOCOL,
    'Content-Type': 'application/json',
    ...extra,
  }
}

interface InitUploadResponse {
  value?: {
    videoUploadToken?: string
    uploadInstructions?: { uploadUrl?: string }[]
    uploadedFileId?: string
    image?: string
    video?: string
  }
}

export const linkedinPublisher: PlatformPublisher = {
  async publish(ctx: PublishContext): Promise<PublishResult> {
    const creds = readCredentials(ctx.channel)
    const auth = requireToken(creds, 'accessToken', ctx.channel.name, 'Reconnect the LinkedIn channel so the token carries w_member_social (person) or w_organization_social + r_organization_social (organization page).')
    if ('failure' in auth) return auth.failure
    const token = auth.token
    const author = ctx.channel.externalId || creds.authorUrn
    if (!author) {
      return { success: false, error: { code: 'CHANNEL_MISCONFIGURED', message: 'No LinkedIn author URN is set on the channel.', guidance: 'Set the channel external id to a person URN (urn:li:person:{id}) or organization URN (urn:li:organization:{id}).', retryable: false } }
    }

    const media = ctx.payload.media
    const commentary = ctx.payload.caption.slice(0, 3000)
    const visibility = ctx.payload.content.options.visibility === 'CONNECTIONS' ? 'CONNECTIONS' : 'PUBLIC'
    const basePost = {
      author,
      commentary,
      visibility: visibility === 'CONNECTIONS' ? 'CONNECTIONS' : 'PUBLIC',
      distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] },
    }

    let contentEntities: { entity: string }[] | undefined

    if (media && /^video\//i.test(media.mimeType)) {
      const buffer = await readMediaBuffer(ctx.payload)
      const initBody = {
        initializeUploadRequest: {
          files: [
            {
              uploadRecipe: {
                serviceRelationships: [
                  { relationshipType: 'OWNER', identifier: author },
                ],
              },
              fileSizeBytes: buffer.length,
            },
          ],
        },
      }
      const init = await apiFetch(`${REST}/videos?action=initializeUpload`, {
        method: 'POST',
        headers: headers(token),
        body: JSON.stringify(initBody),
      })
      if (!init.ok) return { success: false, error: classifyPlatformError('linkedin', init) }
      const data = (init.json as InitUploadResponse).value
      const uploadUrl = data?.uploadInstructions?.[0]?.uploadUrl
      const videoUrn = data?.video || data?.uploadedFileId
      if (!uploadUrl || !videoUrn) {
        return { success: false, error: { code: 'PLATFORM_ERROR', message: 'LinkedIn did not return upload instructions.', guidance: 'Verify the token scopes and that the author URN is correct.', retryable: true } }
      }
      const put = await apiFetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'application/octet-stream' }, body: new Uint8Array(buffer), timeoutMs: 600000 })
      if (!put.ok) {
        return { success: false, error: { code: 'MEDIA_UPLOAD_FAILED', message: `LinkedIn media upload failed (HTTP ${put.status}).`, guidance: 'The video upload endpoint rejected the file. Check size limits and token validity.', retryable: true, platformResponse: put.text.slice(0, 500) } }
      }
      contentEntities = [{ entity: videoUrn }]
    } else if (media && /^image\//i.test(media.mimeType)) {
      const buffer = await readMediaBuffer(ctx.payload)
      const init = await apiFetch(`${REST}/images?action=initializeUpload`, {
        method: 'POST',
        headers: headers(token),
        body: JSON.stringify({ initializeUploadRequest: { owner: author } }),
      })
      if (!init.ok) return { success: false, error: classifyPlatformError('linkedin', init) }
      const data = (init.json as InitUploadResponse).value
      const uploadUrl = data?.uploadInstructions?.[0]?.uploadUrl
      const imageUrn = data?.image
      if (!uploadUrl || !imageUrn) {
        return { success: false, error: { code: 'PLATFORM_ERROR', message: 'LinkedIn did not return image upload instructions.', guidance: 'Verify token scopes.', retryable: true } }
      }
      const put = await apiFetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'application/octet-stream' }, body: new Uint8Array(buffer), timeoutMs: 300000 })
      if (!put.ok) {
        return { success: false, error: { code: 'MEDIA_UPLOAD_FAILED', message: `LinkedIn image upload failed (HTTP ${put.status}).`, guidance: 'Check image format (JPG/PNG) and size.', retryable: true, platformResponse: put.text.slice(0, 500) } }
      }
      contentEntities = [{ entity: imageUrn }]
    }

    const post = await apiFetch(`${REST}/posts`, {
      method: 'POST',
      headers: headers(token),
      body: JSON.stringify(contentEntities ? { ...basePost, content: { contentEntities } } : basePost),
    })
    if (!post.ok) return { success: false, error: classifyPlatformError('linkedin', post) }
    const postId = post.headers.get('x-restli-id') || ((post.json as { id?: string })?.id ?? '')
    const urn = postId.startsWith('urn:') ? postId : postId ? `urn:li:share:${postId}` : ''
    return { success: true, externalId: urn || postId, externalUrl: urn ? `https://www.linkedin.com/feed/update/${urn}` : undefined }
  },
}
