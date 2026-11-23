// SBA Social Publishing — shared types, platform metadata and zod schemas.
// Platform limits are the documented, stable API limits of each platform
// (see UPGRADE_REPORT.md for sources).

import { z } from 'zod'

// ---------------------------------------------------------------------------
// Platforms
// ---------------------------------------------------------------------------
export const PLATFORMS = [
  'youtube',
  'facebook',
  'instagram',
  'tiktok',
  'linkedin',
  'x',
  'pinterest',
  'telegram',
] as const

export type Platform = (typeof PLATFORMS)[number]

export function isPlatform(v: string): v is Platform {
  return (PLATFORMS as readonly string[]).includes(v)
}

// ---------------------------------------------------------------------------
// Statuses
// ---------------------------------------------------------------------------
export const ASSET_STATUSES = ['draft', 'ready', 'approved', 'archived'] as const
export const JOB_STATUSES = ['queued', 'publishing', 'published', 'failed', 'cancelled'] as const
export const CHANNEL_MODES = ['live', 'simulation'] as const
export const SIM_BEHAVIORS = ['success', 'always_fail', 'random_fail'] as const
export const SHARE_STATUSES = ['not_started', 'opened', 'confirmed'] as const
export type JobStatus = (typeof JOB_STATUSES)[number]
export type ShareStatus = (typeof SHARE_STATUSES)[number]

// ---------------------------------------------------------------------------
// Per-platform metadata: what each publisher supports and its limits
// ---------------------------------------------------------------------------
export interface PlatformOptionField {
  key: string
  label: string
  type: 'select' | 'text' | 'number' | 'boolean'
  options?: { value: string; label: string }[]
  placeholder?: string
  help?: string
}

export interface PlatformMeta {
  platform: Platform
  label: string
  /** Platform supports a custom uploaded cover/thumbnail (deep scope: YouTube) */
  customThumbnail: boolean
  /** Title field exists (YouTube, Pinterest) */
  title?: { label: string; maxLength: number }
  captionLabel: string
  captionMaxLength: number
  /** Separate keyword/tag field (YouTube tags, Pinterest tags) */
  tags?: { label: string; maxLength: number }
  /** Hard cap on number of hashtags (Instagram: 30, YouTube: first 15 used) */
  hashtagsMax?: number
  options: PlatformOptionField[]
  mediaTypes: ('video' | 'image')[]
  /** Media must be reachable at a public absolute URL (Instagram, TikTok, Pinterest) */
  requiresPublicMediaUrl: boolean
  toneHint?: string
}

export const PLATFORM_META: Record<Platform, PlatformMeta> = {
  youtube: {
    platform: 'youtube',
    label: 'YouTube',
    customThumbnail: true,
    title: { label: 'Video title', maxLength: 100 },
    captionLabel: 'Video description',
    captionMaxLength: 5000,
    tags: { label: 'Tags (comma separated)', maxLength: 500 },
    hashtagsMax: 15,
    options: [
      {
        key: 'privacy',
        label: 'Privacy',
        type: 'select',
        options: [
          { value: 'public', label: 'Public' },
          { value: 'unlisted', label: 'Unlisted' },
          { value: 'private', label: 'Private' },
        ],
      },
      {
        key: 'category',
        label: 'Category',
        type: 'select',
        options: [
          { value: '22', label: 'People & Blogs' },
          { value: '27', label: 'Education' },
          { value: '24', label: 'Entertainment' },
          { value: '10', label: 'Music' },
          { value: '26', label: 'Howto & Style' },
          { value: '28', label: 'Science & Technology' },
        ],
      },
      { key: 'playlistId', label: 'Playlist ID (optional)', type: 'text', placeholder: 'PLxxxxxxxx', help: 'Video is added to this playlist after upload when provided.' },
    ],
    mediaTypes: ['video'],
    requiresPublicMediaUrl: false,
    toneHint: 'Titles ≤ 100 chars. Hashtags go in the description; the first 3 show above the title.',
  },
  facebook: {
    platform: 'facebook',
    label: 'Facebook Page',
    customThumbnail: false,
    captionLabel: 'Post caption',
    captionMaxLength: 63206,
    options: [],
    mediaTypes: ['video', 'image'],
    requiresPublicMediaUrl: false,
    toneHint: 'Longer captions work here; hashtags are optional and low-impact on Facebook.',
  },
  instagram: {
    platform: 'instagram',
    label: 'Instagram',
    customThumbnail: false,
    captionLabel: 'Caption',
    captionMaxLength: 2200,
    hashtagsMax: 30,
    options: [
      {
        key: 'igMediaType',
        label: 'Video placement',
        type: 'select',
        options: [
          { value: 'REELS', label: 'Reel' },
          { value: 'POST', label: 'Feed post' },
        ],
      },
    ],
    mediaTypes: ['video', 'image'],
    requiresPublicMediaUrl: true,
    toneHint: 'Caption ≤ 2200 chars, max 30 hashtags. Reels captions support hashtags well.',
  },
  tiktok: {
    platform: 'tiktok',
    label: 'TikTok',
    customThumbnail: false,
    captionLabel: 'Caption',
    captionMaxLength: 2200,
    options: [
      {
        key: 'privacy',
        label: 'Who can watch',
        type: 'select',
        options: [
          { value: 'EVERYONE', label: 'Everyone' },
          { value: 'MUTUAL_FOLLOW_FRIENDS', label: 'Mutual follow friends' },
          { value: 'SELF_ONLY', label: 'Only me' },
        ],
      },
      { key: 'disableComment', label: 'Disable comments', type: 'boolean' },
      { key: 'disableDuet', label: 'Disable duet', type: 'boolean' },
      { key: 'disableStitch', label: 'Disable stitch', type: 'boolean' },
    ],
    mediaTypes: ['video'],
    requiresPublicMediaUrl: true,
    toneHint: 'Hashtags are part of the caption on TikTok. Keep hooks in the first line.',
  },
  linkedin: {
    platform: 'linkedin',
    label: 'LinkedIn',
    customThumbnail: false,
    captionLabel: 'Post text',
    captionMaxLength: 3000,
    options: [{ key: 'visibility', label: 'Visibility', type: 'select', options: [{ value: 'PUBLIC', label: 'Anyone' }, { value: 'CONNECTIONS', label: 'Connections only' }] }],
    mediaTypes: ['video', 'image'],
    requiresPublicMediaUrl: false,
    toneHint: 'Professional tone, ≤ 3000 chars. First ~200 chars show before "see more".',
  },
  x: {
    platform: 'x',
    label: 'X (Twitter)',
    customThumbnail: false,
    captionLabel: 'Post text',
    captionMaxLength: 280,
    options: [],
    mediaTypes: ['video', 'image'],
    requiresPublicMediaUrl: false,
    toneHint: '280 chars including hashtags and links.',
  },
  pinterest: {
    platform: 'pinterest',
    label: 'Pinterest',
    customThumbnail: false,
    title: { label: 'Pin title', maxLength: 100 },
    captionLabel: 'Pin description',
    captionMaxLength: 500,
    options: [
      { key: 'boardId', label: 'Board ID', type: 'text', placeholder: 'Board to pin to', help: 'Required by Pinterest: the board the Pin is created on.' },
      { key: 'link', label: 'Destination link (optional)', type: 'text' },
    ],
    mediaTypes: ['image', 'video'],
    requiresPublicMediaUrl: true,
    toneHint: 'Keyword-rich descriptions perform best; max 500 chars.',
  },
  telegram: {
    platform: 'telegram',
    label: 'Telegram',
    customThumbnail: false,
    captionLabel: 'Message caption',
    captionMaxLength: 1024,
    options: [],
    mediaTypes: ['video', 'image'],
    requiresPublicMediaUrl: false,
    toneHint: 'Captions ≤ 1024 chars when sending media. Supports basic HTML formatting.',
  },
}

// ---------------------------------------------------------------------------
// Zod schemas (validation lives in one place; API routes reuse these)
// ---------------------------------------------------------------------------
export const hashtagsSchema = z.string().max(2000).default('')

export const assetUpdateSchema = z.object({
  title: z.string().max(300).optional(),
  description: z.string().max(20000).optional(),
  hashtags: hashtagsSchema.optional(),
  keywords: z.string().max(1000).optional(),
  status: z.enum(['draft', 'ready', 'approved', 'archived']).optional(),
  type: z.enum(['video', 'image']).optional(),
})

export const youtubeOptionsSchema = z.object({
  privacy: z.enum(['public', 'unlisted', 'private']).optional(),
  category: z.string().max(10).optional(),
  playlistId: z.string().max(200).optional().nullable(),
})

export const platformContentUpdateSchema = z.object({
  assetId: z.string().min(1),
  platform: z.string().refine((v) => isPlatform(v), { message: 'unknown platform' }),
  useDefault: z.boolean().optional(),
  title: z.string().max(300).optional(),
  description: z.string().max(20000).optional(),
  hashtags: hashtagsSchema.optional(),
  tags: z.string().max(2000).optional(),
  options: z.record(z.string(), z.unknown()).optional(),
})

export const enqueueSchema = z.object({
  assetId: z.string().min(1),
  channelIds: z.array(z.string().min(1)).min(1),
  scheduleAt: z.string().datetime({ offset: true }).optional().nullable(),
})

export const channelUpsertSchema = z.object({
  id: z.string().optional(),
  platform: z.string().min(1),
  name: z.string().min(1).max(120),
  externalId: z.string().max(200).optional().nullable(),
  credentials: z.record(z.string(), z.unknown()).optional(),
  mode: z.enum(['live', 'simulation']).optional(),
  simBehavior: z.enum(['success', 'always_fail', 'random_fail']).optional(),
  simFailureRate: z.number().min(0).max(1).optional(),
  tokenExpiresAt: z.string().optional().nullable(),
})

export const fbGroupSchema = z.object({
  name: z.string().min(1).max(150),
  url: z.string().url().max(500),
  notes: z.string().max(500).default(''),
})

export const shareUpdateSchema = z.object({
  assetId: z.string().min(1).optional(), // required for 'attach' only
  groupIds: z.array(z.string().min(1)).optional(),
  shareId: z.string().optional(),
  action: z.enum(['attach', 'mark_opened', 'mark_confirmed', 'reset', 'detach', 'set_note']).optional(),
  note: z.string().max(500).optional(),
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
/** Normalize user hashtag input ("tag1, tag2" / "#tag1 #tag2") → "#tag1 #tag2".
 *  Dedupes case-insensitively (platforms treat #Science and #science as one tag). */
export function normalizeHashtags(input: string): string {
  const parts = input
    .split(/[\s,;\n]+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => p.replace(/^#+/, ''))
    .filter(Boolean)
  const seen = new Set<string>()
  const out: string[] = []
  for (const p of parts) {
    const key = p.toLowerCase()
    if (!seen.has(key)) {
      seen.add(key)
      out.push(p)
    }
  }
  return out.map((p) => `#${p}`).join(' ')
}

export function hashtagList(input: string): string[] {
  return normalizeHashtags(input).split(' ').filter(Boolean)
}

/** Platform-safe caption = description + hashtags joined as the platform expects */
export function composeCaption(description: string, hashtags: string): string {
  const d = description.trim()
  const h = normalizeHashtags(hashtags).trim()
  if (!h) return d
  if (d.toLowerCase().includes(h.toLowerCase())) return d
  return `${d}\n\n${h}`.trim()
}
