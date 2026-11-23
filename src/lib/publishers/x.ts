// SBA Social Publishing — X (Twitter) publisher.
// v2 tweet creation (OAuth 2 user token) + v1.1 chunked media upload (OAuth 1.0a
// signing implemented locally with node:crypto — no extra dependency).

import crypto from 'crypto'
import { apiFetch, readCredentials, readMediaBuffer, requireToken, type PublishContext, type PublishResult, type PlatformPublisher } from './base'
import { classifyPlatformError } from './errors'

const API2 = 'https://api.twitter.com/2/tweets'
const MEDIA1 = 'https://upload.twitter.com/1.1/media/upload.json'

function percentEncode(s: string): string {
  return encodeURIComponent(s).replace(/!/g, '%21').replace(/\*/g, '%2A').replace(/'/g, '%27').replace(/\(/g, '%28').replace(/\)/g, '%29')
}

function oauth1Header(method: string, url: string, creds: Record<string, string>): string {
  const { oauthConsumerKey, oauthConsumerSecret, oauthToken, oauthTokenSecret } = creds
  if (!oauthConsumerKey || !oauthConsumerSecret || !oauthToken || !oauthTokenSecret) {
    return ''
  }
  const nonce = crypto.randomBytes(16).toString('hex')
  const ts = Math.floor(Date.now() / 1000).toString()
  const params: Record<string, string> = {
    oauth_consumer_key: oauthConsumerKey,
    oauth_nonce: nonce,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: ts,
    oauth_token: oauthToken,
    oauth_version: '1.0',
  }
  const baseParams = Object.keys(params)
    .sort()
    .map((k) => `${percentEncode(k)}=${percentEncode(params[k])}`)
    .join('&')
  const baseUrl = url.split('?')[0]
  const baseString = `${method.toUpperCase()}&${percentEncode(baseUrl)}&${percentEncode(baseParams)}`
  const signingKey = `${percentEncode(oauthConsumerSecret)}&${percentEncode(oauthTokenSecret)}`
  const signature = crypto.createHmac('sha1', signingKey).update(baseString).digest('base64')
  params.oauth_signature = signature
  const header = Object.keys(params)
    .sort()
    .map((k) => `${k}="${percentEncode(params[k])}"`)
    .join(', ')
  return `OAuth ${header}`
}

async function uploadMediaChunked(ctx: PublishContext, creds: Record<string, string>, buffer: Buffer, mime: string): Promise<{ mediaId?: string; failure?: PublishResult }> {
  // INIT
  const initHeader = oauth1Header('POST', MEDIA1, creds)
  if (!initHeader) return { failure: { success: false, error: { code: 'CREDENTIALS_MISSING', message: 'X media upload needs OAuth 1.0a credentials (oauth_consumer_key/secret, oauth_token/secret).', guidance: 'Store the four OAuth 1.0a values on the X channel credentials, in addition to the OAuth 2 user access token used for tweet creation.', retryable: false } } }
  const init = await apiFetch(`${MEDIA1}?command=INIT&total_bytes=${buffer.length}&media_type=${mime}`, {
    method: 'POST',
    headers: { Authorization: initHeader },
  })
  if (!init.ok) return { failure: { success: false, error: classifyPlatformError('x', init) } }
  const mediaId = (init.json as { media_id_string?: string })?.media_id_string
  if (!mediaId) return { failure: { success: false, error: { code: 'PLATFORM_ERROR', message: 'X did not return a media id.', guidance: 'Verify media size/format (video: MP4 ≤ 512MB).', retryable: true } } }

  // APPEND (single chunk under 5MB, chunked above)
  const chunkSize = 4 * 1024 * 1024
  for (let i = 0, idx = 0; i < buffer.length; i += chunkSize, idx++) {
    const chunk = buffer.subarray(i, Math.min(i + chunkSize, buffer.length))
    const header = oauth1Header('POST', MEDIA1, creds)
    const form = new FormData()
    form.append('media', new Blob([new Uint8Array(chunk)]))
    const res = await apiFetch(`${MEDIA1}?command=APPEND&media_id=${mediaId}&segment_index=${idx}`, {
      method: 'POST',
      headers: { Authorization: header },
      body: form,
    })
    if (!res.ok) return { failure: { success: false, error: classifyPlatformError('x', res) } }
  }
  // FINALIZE
  const fin = await apiFetch(`${MEDIA1}?command=FINALIZE&media_id=${mediaId}`, {
    method: 'POST',
    headers: { Authorization: oauth1Header('POST', MEDIA1, creds) },
  })
  if (!fin.ok) return { failure: { success: false, error: classifyPlatformError('x', fin) } }
  return { mediaId }
}

export const xPublisher: PlatformPublisher = {
  async publish(ctx: PublishContext): Promise<PublishResult> {
    const creds = readCredentials(ctx.channel)
    const auth = requireToken(creds, 'accessToken', ctx.channel.name, 'Reconnect the X channel with OAuth 2.0 scopes tweet.write, tweet.read, users.read, offline.access (plus OAuth 1.0a values for media upload).')
    if ('failure' in auth) return auth.failure

    const text = ctx.payload.caption
    if (!text.trim()) {
      return { success: false, error: { code: 'CAPTION_MISSING', message: 'X requires post text.', guidance: 'Write the X caption in the preparation screen.', retryable: false } }
    }

    let mediaIds: string[] = []
    const media = ctx.payload.media
    if (media) {
      const buffer = await readMediaBuffer(ctx.payload)
      const mime = media.mimeType.startsWith('video/') ? 'video/mp4' : media.mimeType.startsWith('image/gif') ? 'image/gif' : 'image/jpeg'
      if (mime === 'video/mp4' && !media.mimeType.startsWith('video/')) {
        return { success: false, error: { code: 'MEDIA_TYPE_UNSUPPORTED', message: `X does not accept ${media.mimeType}.`, guidance: 'Attach MP4 video or JPG/PNG/GIF images.', retryable: false } }
      }
      const up = await uploadMediaChunked(ctx, creds, buffer, mime)
      if (up.failure) return up.failure
      mediaIds = up.mediaId ? [up.mediaId] : []
    }

    const res = await apiFetch(API2, {
      method: 'POST',
      headers: { Authorization: `Bearer ${creds.accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text.slice(0, 280), ...(mediaIds.length ? { media: { media_ids: mediaIds } } : {}) }),
    })
    if (!res.ok) return { success: false, error: classifyPlatformError('x', res) }
    const data = res.json as { data?: { id?: string } }
    const id = data.data?.id
    return { success: true, externalId: id, externalUrl: id ? `https://x.com/i/status/${id}` : undefined }
  },
}
