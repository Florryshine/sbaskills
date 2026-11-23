// SBA Social Publishing — platform error classification.
// Turns raw HTTP/platform errors into {code, message, guidance, retryable}.

import type { ApiResponse, PublishError } from './base'

interface Classified {
  code: string
  guidance: string
  retryable: boolean
}

const GENERIC_RETRY_CODES = ['RATE_LIMIT', 'TIMEOUT', 'PLATFORM_5XX', 'NETWORK']

export function classifyPlatformError(platform: string, res: ApiResponse): PublishError {
  const cls = classify(platform, res)
  return {
    code: cls.code,
    message: extractMessage(platform, res),
    guidance: cls.guidance,
    retryable: cls.retryable || GENERIC_RETRY_CODES.includes(cls.code),
    httpStatus: res.status || undefined,
    platformResponse: res.text.slice(0, 2000),
  }
}

function classify(platform: string, res: ApiResponse): Classified {
  const json = res.json as Record<string, unknown> | null

  // Network-level failure (status 0) or abort (408)
  if (res.status === 0 || res.status === 408) {
    return {
      code: 'TIMEOUT',
      guidance: 'The platform did not respond in time. The worker will retry automatically; if this repeats, check network connectivity from the server.',
      retryable: true,
    }
  }

  // Google / YouTube: { error: { message, code, errors: [{reason}] } }
  if (platform === 'youtube') {
    const err = (json?.error ?? {}) as { message?: string; code?: number; errors?: { reason?: string }[] }
    const reason = err.errors?.[0]?.reason || ''
    if (reason === 'quotaExceeded' || reason === 'rateLimitExceeded' || reason === 'uploadLimitExceeded') {
      return { code: 'RATE_LIMIT', guidance: 'YouTube API quota is exhausted for today. Retry after the quota resets (midnight Pacific Time).', retryable: true }
    }
    if (reason === 'invalidCredentials' || reason === 'authError' || res.status === 401) {
      return { code: 'TOKEN_EXPIRED', guidance: 'The YouTube access token is invalid or expired. Reconnect the channel (OAuth) to refresh it.', retryable: false }
    }
    if (reason === 'uploadLimitExceeded' || res.status === 403) {
      return { code: 'FORBIDDEN', guidance: 'YouTube rejected the upload (403). Check the channel is in good standing, not flagged, and that the token has youtube.upload scope.', retryable: false }
    }
    if (res.status >= 500) {
      return { code: 'PLATFORM_5XX', guidance: 'YouTube had a server error. Automatic retry will be attempted.', retryable: true }
    }
    return { code: 'PLATFORM_ERROR', guidance: 'Inspect the platform response in the job details. Common causes: video length limits, duplicate titles, or invalid category/privacy values.', retryable: res.status >= 500 }
  }

  // Meta Graph API (facebook / instagram): { error: { message, code, error_subcode, error_user_msg } }
  if (platform === 'facebook' || platform === 'instagram') {
    const err = (json?.error ?? {}) as { message?: string; code?: number; error_subcode?: number; error_user_msg?: string }
    const code = err.code
    if (code === 190 || code === 102 || res.status === 401) {
      return { code: 'TOKEN_EXPIRED', guidance: 'The Meta access token expired or was revoked. Reconnect the Facebook/Instagram channel to get a fresh token.', retryable: false }
    }
    if (code === 4 || code === 17 || code === 32 || code === 613) {
      return { code: 'RATE_LIMIT', guidance: 'Meta rate limit hit. The worker will retry with backoff; avoid publishing too frequently to the same page.', retryable: true }
    }
    if (code === 200 || code === 10) {
      return { code: 'PERMISSION_DENIED', guidance: 'The token lacks a required permission (e.g. pages_manage_posts, instagram_content_publish, pages_read_engagement). Re-authorize the channel with the full permission set.', retryable: false }
    }
    if (res.status >= 500) {
      return { code: 'PLATFORM_5XX', guidance: 'Meta had a server error. Automatic retry will be attempted.', retryable: true }
    }
    return { code: 'PLATFORM_ERROR', guidance: err.error_user_msg || 'Inspect the platform response. Common causes: media format not supported, video too long, or caption exceeding platform limits.', retryable: false }
  }

  // TikTok: { error: { code, message } } or data.error
  if (platform === 'tiktok') {
    const err = (json?.error ?? (json?.data as Record<string, unknown> | undefined)?.error ?? {}) as { code?: string; message?: string }
    const codeStr = String(err.code || '')
    if (codeStr.includes('rate') || res.status === 429) {
      return { code: 'RATE_LIMIT', guidance: 'TikTok rate limit hit. Retry with backoff.', retryable: true }
    }
    if (codeStr.includes('access_token') || res.status === 401) {
      return { code: 'TOKEN_EXPIRED', guidance: 'The TikTok access token is invalid or expired. Reconnect the channel.', retryable: false }
    }
    if (codeStr.includes('permission')) {
      return { code: 'PERMISSION_DENIED', guidance: 'The TikTok app lacks Content Posting API permissions (video.publish). Grant them in the TikTok developer console.', retryable: false }
    }
    if (res.status >= 500) {
      return { code: 'PLATFORM_5XX', guidance: 'TikTok had a server error. Automatic retry will be attempted.', retryable: true }
    }
    return { code: 'PLATFORM_ERROR', guidance: err.message || 'TikTok rejected the request. Verify the video is 5s–10min, MP4/WebM, and within size limits.', retryable: false }
  }

  // LinkedIn: { message, serviceErrorCode, status }
  if (platform === 'linkedin') {
    const body = (json ?? {}) as { message?: string; serviceErrorCode?: number }
    if (res.status === 401 || res.status === 403) {
      const expired = /expired|invalid access token/i.test(body.message || '')
      return {
        code: expired ? 'TOKEN_EXPIRED' : 'PERMISSION_DENIED',
        guidance: expired
          ? 'The LinkedIn access token expired (60-day lifetime). Reconnect the channel.'
          : 'The LinkedIn token lacks required scopes (w_member_social / w_organization_social, r_organization_social). Re-authorize the channel.',
        retryable: false,
      }
    }
    if (body.serviceErrorCode === 429 || res.status === 429) {
      return { code: 'RATE_LIMIT', guidance: 'LinkedIn rate limit hit. Retry with backoff.', retryable: true }
    }
    if (res.status >= 500) {
      return { code: 'PLATFORM_5XX', guidance: 'LinkedIn had a server error. Automatic retry will be attempted.', retryable: true }
    }
    return { code: 'PLATFORM_ERROR', guidance: body.message || 'LinkedIn rejected the post. Check text length (≤3000) and media registration steps.', retryable: false }
  }

  // X: { errors: [{ code, message }] } or { detail, title }
  if (platform === 'x') {
    const errors = (json?.errors ?? []) as { code?: number; message?: string }[]
    const detail = (json ?? {}) as { detail?: string; title?: string }
    const first = errors[0]
    if (res.status === 401 || res.status === 403 || first?.code === 32 || first?.code === 89 || first?.code === 403) {
      return { code: 'TOKEN_EXPIRED', guidance: 'The X credentials are invalid/missing scopes (tweet.write, media.write). Reconnect the channel with the correct OAuth 2 scopes.', retryable: false }
    }
    if (res.status === 429) {
      return { code: 'RATE_LIMIT', guidance: 'X rate limit hit. Retry with backoff.', retryable: true }
    }
    if (res.status >= 500) {
      return { code: 'PLATFORM_5XX', guidance: 'X had a server error. Automatic retry will be attempted.', retryable: true }
    }
    return { code: 'PLATFORM_ERROR', guidance: first?.message || detail.detail || 'X rejected the tweet. Check the 280-char limit and media format (MP4 for video).', retryable: false }
  }

  // Pinterest: { message, code }
  if (platform === 'pinterest') {
    const body = (json ?? {}) as { message?: string; code?: number }
    if (res.status === 401) {
      return { code: 'TOKEN_EXPIRED', guidance: 'The Pinterest token expired. Reconnect the channel.', retryable: false }
    }
    if (res.status === 429) {
      return { code: 'RATE_LIMIT', guidance: 'Pinterest rate limit hit. Retry with backoff.', retryable: true }
    }
    return { code: 'PLATFORM_ERROR', guidance: body.message || 'Pinterest rejected the pin. Check board_id, media URL reachability and image format.', retryable: false }
  }

  // Telegram: { ok: false, error_code, description }
  if (platform === 'telegram') {
    const body = (json ?? {}) as { error_code?: number; description?: string }
    if (body.error_code === 401) {
      return { code: 'TOKEN_EXPIRED', guidance: 'The Telegram bot token is invalid. Reconnect the channel with the correct bot token.', retryable: false }
    }
    if (body.error_code === 403) {
      return { code: 'PERMISSION_DENIED', guidance: body.description || 'The bot cannot post to this chat. Add the bot as an administrator with "Post messages" permission.', retryable: false }
    }
    if (body.error_code === 429) {
      return { code: 'RATE_LIMIT', guidance: 'Telegram rate limit hit. Retry with backoff.', retryable: true }
    }
    return { code: 'PLATFORM_ERROR', guidance: body.description || 'Telegram rejected the message. Check chat_id/channel username and caption length (≤1024).', retryable: false }
  }

  if (res.status >= 500) {
    return { code: 'PLATFORM_5XX', guidance: 'The platform had a server error. Automatic retry will be attempted.', retryable: true }
  }
  return { code: 'PLATFORM_ERROR', guidance: 'Inspect the platform response in the job details.', retryable: false }
}

function extractMessage(platform: string, res: ApiResponse): string {
  const json = res.json as Record<string, unknown> | null
  if (!json) return res.text.slice(0, 300) || `HTTP ${res.status}`
  if (platform === 'youtube') {
    const err = json.error as { message?: string } | undefined
    return err?.message || `HTTP ${res.status}`
  }
  if (platform === 'facebook' || platform === 'instagram') {
    const err = json.error as { message?: string; error_user_msg?: string } | undefined
    return err?.error_user_msg || err?.message || `HTTP ${res.status}`
  }
  if (platform === 'tiktok') {
    const err = json.error as { message?: string } | undefined
    const dataErr = (json.data as { error?: { message?: string } } | undefined)?.error
    return err?.message || dataErr?.message || `HTTP ${res.status}`
  }
  if (platform === 'linkedin') {
    const b = json as { message?: string }
    return b.message || `HTTP ${res.status}`
  }
  if (platform === 'x') {
    const errs = json.errors as { message?: string }[] | undefined
    const d = json as { detail?: string }
    return errs?.[0]?.message || d.detail || `HTTP ${res.status}`
  }
  if (platform === 'telegram') {
    const b = json as { description?: string }
    return b.description || `HTTP ${res.status}`
  }
  const b = json as { message?: string; error?: { message?: string } }
  return b.error?.message || b.message || res.text.slice(0, 300)
}
