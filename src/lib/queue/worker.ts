// SBA Social Publishing — background worker.
//
// Reliability design (documented in UPGRADE_REPORT.md):
// - Atomic claim: one row at a time via a conditional update (no double claiming).
// - Stale recovery: jobs stuck in 'publishing' past the lock timeout are re-queued
//   (attempts preserved) so a crashed worker never strands a job forever.
// - Backoff: retryable failures re-queue with exponential backoff (1m / 5m / 15m);
//   non-retryable failures go straight to 'failed'.
// - Per-platform independence is structural: one row per (asset, channel) — one
//   platform's failure never touches another's job.
// - Thumbnail fallback: if a thumbnail was attached to the asset AFTER enqueue, the
//   worker picks it up at publish time instead of silently publishing without it.
// - Duplicate protection: a job with externalPostId set is never re-executed.

import { db } from '@/lib/db'
import { getPublisher, TOKEN_ERROR_CODES } from '@/lib/publishers'
import { parseJobPayload, type JobPayload } from '@/lib/platform-content'
import { assertPlatform } from '@/lib/platform-content'

const LOCK_TIMEOUT_MS = 10 * 60 * 1000 // 10 min stale lock
const BACKOFF_MS = [60_000, 300_000, 900_000] // 1m, 5m, 15m

export interface WorkerRunResult {
  claimed: string | null
  outcome?: 'published' | 'retry_scheduled' | 'failed' | 'skipped'
  platform?: string
  jobId?: string
  error?: string
}

async function logEvent(jobId: string, event: string, detail: Record<string, unknown> = {}): Promise<void> {
  await db.publishEvent.create({ data: { jobId, event, detailJson: JSON.stringify(detail) } })
}

/** Claim the next runnable job atomically (queued, past schedule/backoff). */
export async function claimNextJob(): Promise<string | null> {
  const now = new Date()
  const staleCutoff = new Date(now.getTime() - LOCK_TIMEOUT_MS)

  // 1. Recover stale locks first
  const stale = await db.publishJob.updateMany({
    where: { status: 'publishing', lockedAt: { lt: staleCutoff } },
    data: { status: 'queued', lockedAt: null, lockedBy: null },
  })
  if (stale.count > 0) {
    const recovered = await db.publishJob.findMany({ where: { status: 'queued', lockedAt: null }, take: 5, orderBy: { createdAt: 'asc' } })
    for (const j of recovered) {
      await logEvent(j.id, 'stale_recovered', { note: 'job was stuck in publishing; re-queued automatically' })
    }
  }

  // 2. Claim one job: find candidate then flip to publishing only if still queued
  const candidates = await db.publishJob.findMany({
    where: {
      status: 'queued',
      OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
      AND: [{ OR: [{ scheduledAt: null }, { scheduledAt: { lte: now } }] }],
    },
    orderBy: [{ createdAt: 'asc' }],
    take: 10,
  })
  for (const candidate of candidates) {
    // Atomic claim: update only succeeds if the row is still queued
    const claimed = await db.publishJob.updateMany({
      where: { id: candidate.id, status: 'queued' },
      data: { status: 'publishing', lockedAt: new Date(), lockedBy: `worker-${process.pid}`, startedAt: candidate.startedAt || new Date() },
    })
    if (claimed.count === 1) {
      await logEvent(candidate.id, 'claimed', { worker: `worker-${process.pid}` })
      return candidate.id
    }
  }
  return null
}

/** Resolve thumbnail at publish time: payload snapshot, or a thumbnail attached after enqueue. */
async function resolveThumbnail(payload: JobPayload, assetId: string, thumbnailMediaId: string | null): Promise<JobPayload> {
  if (payload.thumbnail) return payload
  if (thumbnailMediaId) {
    const m = await db.mediaFile.findUnique({ where: { id: thumbnailMediaId } })
    if (m) {
      payload.thumbnail = { id: m.id, url: m.publicUrl, storagePath: m.storagePath, bucket: m.bucket, mimeType: m.mimeType, sizeBytes: m.sizeBytes }
      return payload
    }
  }
  const latest = await db.mediaFile.findFirst({ where: { assetId, role: 'thumbnail' }, orderBy: { createdAt: 'desc' } })
  if (latest) {
    payload.thumbnail = { id: latest.id, url: latest.publicUrl, storagePath: latest.storagePath, bucket: latest.bucket, mimeType: latest.mimeType, sizeBytes: latest.sizeBytes }
  }
  return payload
}

/** Execute one claimed job. Accepts 'publishing' (already claimed) or 'queued'
 *  (claims it atomically first — safe for direct invocation and tests). */
export async function processJob(jobId: string): Promise<WorkerRunResult> {
  const job = await db.publishJob.findUnique({ where: { id: jobId }, include: { channel: true } })
  if (!job) return { claimed: null }
  if (job.externalPostId) {
    // Already published — never execute again (duplicate protection)
    await db.publishJob.update({ where: { id: job.id }, data: { status: 'published', completedAt: new Date(), lockedAt: null } })
    return { claimed: jobId, outcome: 'skipped', platform: job.platform, jobId }
  }
  if (job.status === 'queued') {
    const now = new Date()
    const gateOk = (!job.nextAttemptAt || job.nextAttemptAt <= now) && (!job.scheduledAt || job.scheduledAt <= now)
    if (!gateOk) return { claimed: null, outcome: 'skipped', jobId }
    const claim = await db.publishJob.updateMany({
      where: { id: job.id, status: 'queued' },
      data: { status: 'publishing', lockedAt: new Date(), lockedBy: `worker-${process.pid}`, startedAt: job.startedAt || new Date() },
    })
    if (claim.count !== 1) return { claimed: null, outcome: 'skipped', jobId }
    await logEvent(job.id, 'claimed', { worker: `worker-${process.pid}`, direct: true })
  } else if (job.status !== 'publishing') {
    return { claimed: null, outcome: 'skipped', jobId }
  }

  let payload = parseJobPayload(job.payloadJson)
  if (!payload) {
    await db.publishJob.update({
      where: { id: job.id },
      data: { status: 'failed', completedAt: new Date(), lockedAt: null, errorCode: 'PAYLOAD_CORRUPT', errorMessage: 'Stored job payload could not be parsed.', errorGuidance: 'Re-enqueue the content from the preparation screen.' },
    })
    await logEvent(job.id, 'failed', { code: 'PAYLOAD_CORRUPT' })
    return { claimed: jobId, outcome: 'failed', platform: job.platform, jobId, error: 'PAYLOAD_CORRUPT' }
  }

  payload = await resolveThumbnail(payload, job.assetId, job.thumbnailMediaId)
  if (payload.thumbnail) {
    await db.publishJob.update({ where: { id: job.id }, data: { payloadJson: JSON.stringify(payload) } })
  }

  const publisher = getPublisher(assertPlatform(job.platform), job.channel.mode)
  const result = await publisher.publish({
    jobId: job.id,
    channel: {
      id: job.channel.id,
      platform: job.channel.platform,
      name: job.channel.name,
      externalId: job.channel.externalId,
      credentialsJson: job.channel.credentialsJson,
      mode: job.channel.mode,
      simBehavior: job.channel.simBehavior,
      simFailureRate: job.channel.simFailureRate,
    },
    payload,
    onEvent: (event, detail) => logEvent(job.id, event, detail),
  })

  if (result.success) {
    const published = await db.publishJob.update({
      where: { id: job.id },
      data: {
        status: 'published',
        attempts: job.attempts + 1,
        completedAt: new Date(),
        lockedAt: null,
        errorCode: null,
        errorMessage: null,
        errorGuidance: null,
        externalPostId: result.externalId ?? null,
        externalUrl: result.externalUrl ?? null,
        thumbnailError: result.thumbnailError ?? null,
      },
    })
    await logEvent(job.id, 'published', { externalId: result.externalId, thumbnailApplied: result.thumbnailApplied === true })
    if (result.thumbnailError) {
      await logEvent(job.id, 'thumbnail_failed', { error: result.thumbnailError, note: 'video published; thumbnail can be retried separately' })
    }
    if (result.warnings?.length) await logEvent(job.id, 'warnings', { warnings: result.warnings })
    void published
    return { claimed: jobId, outcome: 'published', platform: job.platform, jobId }
  }

  // --- failure path --------------------------------------------------------
  const err = result.error
  await logEvent(job.id, 'failed_attempt', { code: err.code, message: err.message, attempts: job.attempts + 1 })

  if (TOKEN_ERROR_CODES.includes(err.code)) {
    await db.channel.update({ where: { id: job.channelId }, data: { status: 'expired', lastError: `${err.code}: ${err.message}` } }).catch(() => undefined)
  }

  const attempts = job.attempts + 1
  const canRetry = err.retryable && attempts < job.maxAttempts

  if (canRetry) {
    const backoff = BACKOFF_MS[Math.min(attempts - 1, BACKOFF_MS.length - 1)]
    const nextAt = new Date(Date.now() + backoff)
    await db.publishJob.update({
      where: { id: job.id },
      data: { status: 'queued', attempts, nextAttemptAt: nextAt, lockedAt: null, errorCode: err.code, errorMessage: err.message, errorGuidance: err.guidance },
    })
    await logEvent(job.id, 'retry_scheduled', { attempt: attempts, nextAttemptAt: nextAt.toISOString(), code: err.code })
    return { claimed: jobId, outcome: 'retry_scheduled', platform: job.platform, jobId }
  }

  await db.publishJob.update({
    where: { id: job.id },
    data: { status: 'failed', attempts, completedAt: new Date(), lockedAt: null, errorCode: err.code, errorMessage: err.message, errorGuidance: err.guidance },
  })
  await logEvent(job.id, 'failed', { code: err.code, message: err.message, guidance: err.guidance, platformResponse: err.platformResponse })
  return { claimed: jobId, outcome: 'failed', platform: job.platform, jobId, error: err.code }
}

/** Process up to `max` jobs in this run (cron tick / manual trigger). */
export async function runWorkerBatch(max = 5): Promise<WorkerRunResult[]> {
  const results: WorkerRunResult[] = []
  for (let i = 0; i < max; i++) {
    const jobId = await claimNextJob()
    if (!jobId) break
    results.push(await processJob(jobId))
  }
  return results
}

/** Manually retry a failed/cancelled job. A published job can NEVER be retried. */
export async function retryJob(jobId: string): Promise<{ ok: boolean; message: string }> {
  const job = await db.publishJob.findUnique({ where: { id: jobId } })
  if (!job) return { ok: false, message: 'Job not found.' }
  if (job.status === 'published') {
    return { ok: false, message: 'This job already published successfully — retrying would create a duplicate post. Nothing was re-run.' }
  }
  if (job.status === 'publishing') {
    return { ok: false, message: 'This job is currently being published. If it appears stuck, it will be auto-recovered within 10 minutes.' }
  }
  await db.publishJob.update({
    where: { id: jobId },
    data: { status: 'queued', attempts: 0, nextAttemptAt: null, lockedAt: null, errorCode: null, errorMessage: null, errorGuidance: null, completedAt: null },
  })
  await logEvent(jobId, 'retry_scheduled', { manual: true })
  return { ok: true, message: 'Job re-queued. The worker will run it on the next tick — use "Run worker now" for immediate execution.' }
}

/** Retry ONLY the thumbnail of an already-published YouTube job. */
export async function retryThumbnail(jobId: string): Promise<{ ok: boolean; message: string }> {
  const job = await db.publishJob.findUnique({ where: { id: jobId }, include: { channel: true } })
  if (!job) return { ok: false, message: 'Job not found.' }
  if (job.status !== 'published') return { ok: false, message: 'Thumbnail retry is only available on published jobs.' }
  if (job.platform !== 'youtube') return { ok: false, message: 'Custom thumbnail retry applies to YouTube jobs.' }

  const payload = parseJobPayload(job.payloadJson)
  if (!payload?.thumbnail) return { ok: false, message: 'No thumbnail is attached to this job — upload one in the preparation screen first.' }

  const publisher = getPublisher('youtube', job.channel.mode)
  if (!publisher.retryThumbnail) return { ok: false, message: 'This publisher does not support thumbnail retry.' }

  const videoId = job.externalPostId
  if (!videoId) return { ok: false, message: 'No external video id recorded — cannot target the thumbnail.' }

  const result = await publisher.retryThumbnail(
    {
      jobId: job.id,
      channel: {
        id: job.channel.id,
        platform: job.channel.platform,
        name: job.channel.name,
        externalId: job.channel.externalId,
        credentialsJson: job.channel.credentialsJson,
        mode: job.channel.mode,
        simBehavior: job.channel.simBehavior,
        simFailureRate: job.channel.simFailureRate,
      },
      payload,
    },
    videoId,
  )

  if (result.success) {
    await db.publishJob.update({ where: { id: jobId }, data: { thumbnailError: null } })
    await logEvent(jobId, 'thumbnail_published', { videoId })
    return { ok: true, message: 'Thumbnail applied to the YouTube video.' }
  }
  await db.publishJob.update({ where: { id: jobId }, data: { thumbnailError: `${result.error.message} ${result.error.guidance}`.trim() } })
  await logEvent(jobId, 'thumbnail_failed', { error: result.error.message, code: result.error.code })
  return { ok: false, message: `Thumbnail retry failed: ${result.error.message}` }
}
