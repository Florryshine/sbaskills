// SBA Social Publishing — per-platform content resolution.
//
// Semantics (documented in UPGRADE_REPORT.md):
// - Every (asset, platform) pair has at most one PlatformContent row.
// - `useDefault = true` (or no row): the platform resolves its content FROM THE MAIN
//   asset fields at enqueue time — no duplication stored, later main edits propagate.
// - `useDefault = false`: the row stores an explicit per-platform version edited by
//   the user. Editing one platform never writes to another platform's row.
// - "Sync from main" simply sets useDefault back to true.

import type { ContentAsset, PlatformContent } from '@prisma/client'
import { PLATFORM_META, isPlatform, normalizeHashtags, type Platform } from './types'

export interface ResolvedPlatformContent {
  platform: Platform
  title: string
  description: string
  hashtags: string
  tags: string
  options: Record<string, string | boolean | undefined>
  isDefault: boolean
}

export function defaultOptionsFor(platform: Platform): Record<string, string | boolean | undefined> {
  const opts: Record<string, string | boolean | undefined> = {}
  for (const f of PLATFORM_META[platform].options) {
    if (f.type === 'select' && f.options?.length) opts[f.key] = f.options[0].value
    if (f.type === 'boolean') opts[f.key] = false
  }
  return opts
}

/**
 * Resolve the effective content for a platform.
 * `row` = stored PlatformContent override (nullable).
 */
export function resolvePlatformContent(
  asset: Pick<ContentAsset, 'title' | 'description' | 'hashtags' | 'keywords'>,
  platform: Platform,
  row?: Pick<PlatformContent, 'useDefault' | 'title' | 'description' | 'hashtags' | 'tags' | 'optionsJson'> | null,
): ResolvedPlatformContent {
  const meta = PLATFORM_META[platform]
  const isDefault = !row || row.useDefault

  if (isDefault) {
    return {
      platform,
      title: meta.title ? asset.title : '',
      description: asset.description,
      hashtags: normalizeHashtags(asset.hashtags),
      tags: asset.keywords,
      options: defaultOptionsFor(platform),
      isDefault: true,
    }
  }

  let options: Record<string, string | boolean | undefined> = {}
  try {
    options = JSON.parse(row.optionsJson || '{}') as Record<string, string | boolean | undefined>
  } catch {
    options = {}
  }
  // Fill missing option defaults so partial edits still produce complete payloads
  const defaults = defaultOptionsFor(platform)
  for (const [k, v] of Object.entries(defaults)) {
    if (options[k] === undefined) options[k] = v
  }

  return {
    platform,
    title: meta.title ? row.title : '',
    description: row.description,
    hashtags: normalizeHashtags(row.hashtags),
    tags: row.tags,
    options,
    isDefault: false,
  }
}

/** Snapshot payload stored on each publish job at enqueue time (audit + retry safety). */
export interface JobPayload {
  assetId: string
  assetType: 'video' | 'image'
  platform: Platform
  content: ResolvedPlatformContent
  caption: string // platform-composed caption (description + hashtags)
  media: { id: string; url: string; storagePath: string; bucket: string; mimeType: string; sizeBytes: number } | null
  thumbnail: { id: string; url: string; storagePath: string; bucket: string; mimeType: string; sizeBytes: number } | null
}

export function parseJobPayload(json: string): JobPayload | null {
  try {
    return JSON.parse(json) as JobPayload
  } catch {
    return null
  }
}

/** Extract hashtags not already part of the caption body (for previews). */
export function extractHashtags(hashtags: string): string[] {
  return normalizeHashtags(hashtags).split(' ').filter(Boolean)
}

export function assertPlatform(value: string): Platform {
  if (!isPlatform(value)) throw new Error(`Unknown platform: ${value}`)
  return value
}
