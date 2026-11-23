// SBA Social Publishing — simulation publisher.
// Used ONLY when a channel's mode = 'simulation'. It exists so the queue, worker,
// retries, per-platform independence and the UI can be tested end-to-end without
// real platform credentials. Simulation channels are clearly labelled in the UI and
// NEVER used when mode = 'live'.

import type { PublishContext, PublishResult, PlatformPublisher } from './base'

const SIM_EXTERNAL_ID_PREFIX = 'sim-'

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function decideOutcome(ctx: PublishContext): { ok: boolean; reason?: string } {
  const { simBehavior, simFailureRate } = ctx.channel
  if (simBehavior === 'always_fail') return { ok: false, reason: 'channel is set to always fail (simulation)' }
  if (simBehavior === 'random_fail') {
    return Math.random() < (simFailureRate || 0.3)
      ? { ok: false, reason: 'random simulation failure' }
      : { ok: true }
  }
  return { ok: true }
}

export const simulationPublisher: PlatformPublisher = {
  async publish(ctx: PublishContext): Promise<PublishResult> {
    await sleep(600) // simulate network latency
    const outcome = decideOutcome(ctx)
    const platformTag = ctx.payload.platform
    const simId = `${SIM_EXTERNAL_ID_PREFIX}${platformTag}-${ctx.jobId.slice(-8)}-${Date.now().toString(36)}`

    if (!outcome.ok) {
      return {
        success: false,
        error: {
          code: 'SIMULATION_FAILURE',
          message: `Simulated publishing failure for ${platformTag} (${outcome.reason}).`,
          guidance: 'This is a TEST failure produced by a simulation channel — no real platform was contacted. Fix by setting the channel behaviour to "success" or switching it to live mode with real credentials.',
          retryable: true,
        },
      }
    }

    const warnings: string[] = []
    let thumbnailError: string | undefined
    let thumbnailApplied = false

    if (ctx.payload.thumbnail) {
      // Simulated thumbnail: 90% success so the UI warning path can be exercised
      if (Math.random() < 0.9) {
        thumbnailApplied = true
      } else {
        thumbnailError = 'Simulated thumbnail upload failed (the video itself was published).'
      }
    }

    await ctx.onEvent?.('simulated', { externalId: simId })
    return {
      success: true,
      externalId: simId,
      externalUrl: null as unknown as string | undefined, // no real URL in simulation
      warnings,
      thumbnailError,
      thumbnailApplied,
    }
  },

  async retryThumbnail(ctx: PublishContext, videoId: string): Promise<PublishResult> {
    await sleep(400)
    if (Math.random() < 0.9) {
      return { success: true, thumbnailApplied: true, externalId: videoId }
    }
    return {
      success: false,
      error: { code: 'SIMULATION_FAILURE', message: 'Simulated thumbnail retry failed.', guidance: 'Try again — this is a simulation channel.', retryable: true },
    }
  },
}
