// SBA Social Publishing — publisher contract + shared utilities.
// Every platform publisher implements `PlatformPublisher` and returns a structured
// result. Errors are ALWAYS classified with a code + actionable guidance — never a
// bare "Publishing failed".

import { getStorage } from '../storage'
import type { JobPayload } from '../platform-content'

export interface PublishError {
  code: string
  message: string
  guidance: string
  retryable: boolean
  httpStatus?: number
  platformResponse?: string
}

export interface PublishSuccess {
  success: true
  externalId?: string
  externalUrl?: string
  warnings?: string[]
  /** Video published but thumbnail failed — job stays published, warning surfaced in UI */
  thumbnailError?: string
  thumbnailApplied?: boolean
}

export interface PublishFailure {
  success: false
  error: PublishError
  warnings?: string[]
}

export type PublishResult = PublishSuccess | PublishFailure

export interface ChannelLike {
  id: string
  platform: string
  name: string
  externalId: string | null
  credentialsJson: string
  mode: string
  simBehavior: string
  simFailureRate: number
}

export interface PublishContext {
  jobId: string
  channel: ChannelLike
  payload: JobPayload
  onEvent?: (event: string, detail?: Record<string, unknown>) => Promise<void>
}

export interface PlatformPublisher {
  publish(ctx: PublishContext): Promise<PublishResult>
  /** Retry ONLY the thumbnail on an already-published video (YouTube). */
  retryThumbnail?(ctx: PublishContext, videoId: string): Promise<PublishResult>
}

// ---------------------------------------------------------------------------
// Channel credentials
// ---------------------------------------------------------------------------
export function readCredentials(channel: ChannelLike): Record<string, string> {
  try {
    return JSON.parse(channel.credentialsJson || '{}') as Record<string, string>
  } catch {
    return {}
  }
}

export function requireToken(
  creds: Record<string, string>,
  key: string,
  channelName: string,
  howTo: string,
): { token: string } | { failure: PublishFailure } {
  const token = creds[key]
  if (!token) {
    return {
      failure: {
        success: false,
        error: {
          code: 'CREDENTIALS_MISSING',
          message: `${channelName} has no ${key} configured.`,
          guidance: howTo,
          retryable: false,
        },
      },
    }
  }
  return { token }
}

// ---------------------------------------------------------------------------
// HTTP helper — returns parsed body + status, never throws raw
// ---------------------------------------------------------------------------
export interface ApiResponse {
  status: number
  ok: boolean
  json: unknown
  text: string
  headers: Headers
}

export async function apiFetch(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<ApiResponse> {
  const { timeoutMs = 120000, ...rest } = init
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { ...rest, signal: controller.signal })
    const text = await res.text()
    let json: unknown = null
    try {
      json = JSON.parse(text)
    } catch {
      // non-JSON response
    }
    return { status: res.status, ok: res.ok, json, text, headers: res.headers }
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError'
    return {
      status: aborted ? 408 : 0,
      ok: false,
      json: null,
      text: aborted ? `Request timed out after ${timeoutMs}ms` : String(err),
      headers: new Headers(),
    }
  } finally {
    clearTimeout(timer)
  }
}

// ---------------------------------------------------------------------------
// Media helpers
// ---------------------------------------------------------------------------
export async function readMediaBuffer(payload: JobPayload): Promise<Buffer> {
  if (!payload.media) throw new Error('Job payload has no media attached')
  const storage = getStorage()
  return storage.read(payload.media.bucket, payload.media.storagePath)
}

/** Platforms like Instagram/TikTok/Pinterest fetch media server-side: URL must be public. */
export function assertPublicMediaUrl(payload: JobPayload): PublishFailure | null {
  if (!payload.media) {
    return {
      success: false,
      error: { code: 'MEDIA_MISSING', message: 'No media is attached to this content.', guidance: 'Attach the video or image in the content library before publishing.', retryable: false },
    }
  }
  const url = payload.media.url
  if (!/^https:\/\//i.test(url)) {
    return {
      success: false,
      error: {
        code: 'MEDIA_URL_NOT_PUBLIC',
        message: `${payload.media.url || '(empty)'} is not publicly reachable, but ${payload.platform} fetches media server-side.`,
        guidance: 'Instagram/TikTok/Pinterest require a public HTTPS media URL. In production the Supabase Storage driver provides this automatically; locally, import the media by public URL instead of file upload.',
        retryable: false,
      },
    }
  }
  return null
}

export function mediaIsRequiredButMissing(payload: JobPayload): PublishFailure {
  return {
    success: false,
    error: {
      code: 'MEDIA_MISSING',
      message: 'No media is attached to this content.',
      guidance: 'Attach the video or image in the content library before publishing.',
      retryable: false,
    },
  }
}
