// SBA Social Publishing — enqueue logic.
//
// Guarantees (upgraded behaviour, documented in UPGRADE_REPORT.md):
// - Only channels the user SELECTED receive jobs. Excluded platforms get no job at all.
// - One active job per (asset, channel) via a unique idempotency key:
//     assetId:channelId:<revision>   where revision = content "version" hash + max(existing attempts)
//   Retrying re-enqueues with attempts preserved — a successful job is NEVER republished.
// - Platform content is resolved and snapshotted into payloadJson at enqueue time,
//   so retries publish exactly what was approved (plus thumbnail fallback lookup).
// - Per-platform validation errors are reported BEFORE any job is created.

import { db } from '@/lib/db'
import { resolvePlatformContent, type JobPayload } from '@/lib/platform-content'
import { composeCaption, hashtagList, PLATFORM_META, type Platform } from '@/lib/types'
import type { ContentAsset, MediaFile, PlatformContent } from '@prisma/client'

export interface EnqueueProblem {
  platform: Platform
  code: string
  message: string
  guidance: string
}

export interface EnqueueOutcome {
  created: { jobId: string; platform: Platform; scheduledAt: Date | null }[]
  skipped: { platform: Platform; reason: string }[]
  problems: EnqueueProblem[]
}

interface AssetWithMedia extends ContentAsset {
  mediaFiles: MediaFile[]
  platformContent: PlatformContent[]
}

function pickPrimaryMedia(asset: AssetWithMedia): MediaFile | null {
  return (
    asset.mediaFiles.find((m) => m.role === 'primary' && m.mediaType === asset.type) ||
    asset.mediaFiles.find((m) => m.mediaType === asset.type) ||
    null
  )
}

function pickThumbnail(asset: AssetWithMedia): MediaFile | null {
  return asset.mediaFiles.find((m) => m.role === 'thumbnail') || null
}

/** Per-platform pre-flight validation before jobs are created.
 *  `simulation` channels waive media-reachability checks (no real platform is contacted). */
export function validateForPlatform(asset: AssetWithMedia, platform: Platform, resolved: ReturnType<typeof resolvePlatformContent>, channelMode: string = 'live'): EnqueueProblem | null {
  const meta = PLATFORM_META[platform]
  const primary = pickPrimaryMedia(asset)

  if (meta.mediaTypes.includes('video') && !meta.mediaTypes.includes('image')) {
    if (!primary || !/^video\//i.test(primary.mimeType)) {
      return { platform, code: 'MEDIA_TYPE_REQUIRED', message: `${meta.label} requires a video, but this content has no video file attached.`, guidance: 'Attach the video in the content library, or deselect this platform.' }
    }
  }
  if (!primary) {
    return { platform, code: 'MEDIA_MISSING', message: `${meta.label}: no media is attached to this content.`, guidance: 'Attach media in the content library, or deselect this platform.' }
  }

  if (platform === 'youtube' && !resolved.title.trim()) {
    return { platform, code: 'TITLE_MISSING', message: 'YouTube requires a video title.', guidance: 'Fill the main title (or the YouTube-specific title) in the preparation screen.' }
  }
  if (platform === 'youtube' && resolved.title.length > 100) {
    return { platform, code: 'TITLE_TOO_LONG', message: `YouTube title is ${resolved.title.length} chars (max 100).`, guidance: 'Shorten the title.' }
  }
  if (platform === 'instagram' && resolved.description.length > 2200) {
    return { platform, code: 'CAPTION_TOO_LONG', message: `Instagram caption is ${resolved.description.length} chars (max 2200).`, guidance: 'Shorten the Instagram caption in its own tab — other platforms are not affected.' }
  }
  if (meta.hashtagsMax && hashtagList(resolved.hashtags).length > meta.hashtagsMax) {
    return { platform, code: 'TOO_MANY_HASHTAGS', message: `${meta.label} allows at most ${meta.hashtagsMax} hashtags (found ${hashtagList(resolved.hashtags).length}).`, guidance: 'Trim the hashtag list for this platform.' }
  }
  if (meta.tags && resolved.tags.length > meta.tags.maxLength) {
    return { platform, code: 'TAGS_TOO_LONG', message: `${meta.label} tags exceed ${meta.tags.maxLength} chars.`, guidance: 'Shorten the tags field.' }
  }
  if (meta.requiresPublicMediaUrl && channelMode !== 'simulation' && !/^https:\/\//i.test(primary.publicUrl)) {
    return { platform, code: 'MEDIA_URL_NOT_PUBLIC', message: `${meta.label} fetches media server-side and needs a public HTTPS URL; this media is only reachable inside the app.`, guidance: 'Import the media by public URL (production Supabase Storage provides public URLs automatically), or deselect this platform.' }
  }
  return null
}

/** Content revision marker — changes whenever prepared content changes. */
function contentRevision(asset: AssetWithMedia): string {
  const material = JSON.stringify([
    asset.title, asset.description, asset.hashtags, asset.keywords,
    asset.platformContent.map((p) => [p.platform, p.useDefault, p.title, p.description, p.hashtags, p.tags, p.optionsJson]),
  ])
  let h = 0
  for (let i = 0; i < material.length; i++) {
    h = (h * 31 + material.charCodeAt(i)) | 0
  }
  return Math.abs(h).toString(36)
}

export async function enqueueAsset(
  assetId: string,
  channelIds: string[],
  scheduleAt?: Date | null,
): Promise<EnqueueOutcome> {
  const asset = (await db.contentAsset.findUnique({
    where: { id: assetId },
    include: { mediaFiles: true, platformContent: true },
  })) as AssetWithMedia | null
  if (!asset) throw new Error('Content asset not found')
  if (asset.status !== 'approved') {
    throw new Error('Content must be approved before publishing (open it in the library and press Approve).')
  }

  const channels = await db.channel.findMany({ where: { id: { in: channelIds } } })
  if (channels.length === 0) throw new Error('None of the selected channels exist — refresh and try again.')

  const outcome: EnqueueOutcome = { created: [], skipped: [], problems: [] }
  const scheduled = scheduleAt || null

  for (const channel of channels) {
    const platform = channel.platform as Platform
    if (!PLATFORM_META[platform]) {
      outcome.problems.push({ platform, code: 'UNKNOWN_PLATFORM', message: `Channel "${channel.name}" has an unknown platform "${platform}".`, guidance: 'Recreate the channel with a valid platform.' })
      continue
    }

    // Resolve effective platform content (per-platform override or main copy)
    const row = asset.platformContent.find((p) => p.platform === platform) || null
    const resolved = resolvePlatformContent(asset, platform, row)
    const problem = validateForPlatform(asset, platform, resolved, channel.mode)
    if (problem) {
      outcome.problems.push(problem)
      continue
    }

    const primary = pickPrimaryMedia(asset)!
    const thumbnail = pickThumbnail(asset)
    const payload: JobPayload = {
      assetId: asset.id,
      assetType: asset.type as 'video' | 'image',
      platform,
      content: resolved,
      caption: composeCaption(resolved.description, resolved.hashtags),
      media: {
        id: primary.id,
        url: primary.publicUrl,
        storagePath: primary.storagePath,
        bucket: primary.bucket,
        mimeType: primary.mimeType,
        sizeBytes: primary.sizeBytes,
      },
      thumbnail: thumbnail
        ? {
            id: thumbnail.id,
            url: thumbnail.publicUrl,
            storagePath: thumbnail.storagePath,
            bucket: thumbnail.bucket,
            mimeType: thumbnail.mimeType,
            sizeBytes: thumbnail.sizeBytes,
          }
        : null,
    }

    // Idempotency: same asset+channel+content revision never creates a second job;
    // retries preserve attempts (worker re-uses the SAME job row).
    const existing = await db.publishJob.findFirst({
      where: { assetId: asset.id, channelId: channel.id, idempotencyKey: `${asset.id}:${channel.id}:${contentRevision(asset)}` },
    })
    if (existing && existing.status !== 'cancelled') {
      outcome.skipped.push({ platform, reason: `A ${existing.status} job already exists for this content and channel (idempotency). Use Retry to re-run a failed job.` })
      continue
    }

    const jobData = {
      payloadJson: JSON.stringify(payload),
      thumbnailMediaId: thumbnail?.id ?? null,
      status: 'queued',
      maxAttempts: 3,
      scheduledAt: scheduled,
      nextAttemptAt: null as Date | null,
      lockedAt: null as Date | null,
      lockedBy: null as string | null,
      startedAt: null as Date | null,
      completedAt: null as Date | null,
      externalPostId: null as string | null,
      externalUrl: null as string | null,
      errorCode: null as string | null,
      errorMessage: null as string | null,
      errorGuidance: null as string | null,
      thumbnailError: null as string | null,
    }

    const job = existing
      ? await db.publishJob.update({ where: { id: existing.id }, data: jobData }) // re-use cancelled row (unique key)
      : await db.publishJob.create({
          data: {
            assetId: asset.id,
            channelId: channel.id,
            platform,
            idempotencyKey: `${asset.id}:${channel.id}:${contentRevision(asset)}`,
            ...jobData,
          },
        })
    await db.publishEvent.create({
      data: { jobId: job.id, event: 'queued', detailJson: JSON.stringify({ platform, scheduledAt: scheduled?.toISOString() ?? null, simulation: channel.mode === 'simulation' }) },
    })
    outcome.created.push({ jobId: job.id, platform, scheduledAt: scheduled })
  }

  return outcome
}
