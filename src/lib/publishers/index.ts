// SBA Social Publishing — publisher registry.
// Route each platform to its publisher; simulation channels go through the
// simulation publisher regardless of platform (explicitly opt-in per channel).

import type { PlatformPublisher } from './base'
import { simulationPublisher } from './simulation'
import { youtubePublisher } from './youtube'
import { facebookPublisher } from './facebook'
import { instagramPublisher } from './instagram'
import { tiktokPublisher } from './tiktok'
import { linkedinPublisher } from './linkedin'
import { xPublisher } from './x'
import { pinterestPublisher } from './pinterest'
import { telegramPublisher } from './telegram'
import type { Platform } from '../types'

const LIVE_PUBLISHERS: Record<string, PlatformPublisher> = {
  youtube: youtubePublisher,
  facebook: facebookPublisher,
  instagram: instagramPublisher,
  tiktok: tiktokPublisher,
  linkedin: linkedinPublisher,
  x: xPublisher,
  pinterest: pinterestPublisher,
  telegram: telegramPublisher,
}

export function getPublisher(platform: Platform | string, mode: string): PlatformPublisher {
  if (mode === 'simulation') return simulationPublisher
  const p = LIVE_PUBLISHERS[platform]
  if (!p) {
    return {
      async publish() {
        return {
          success: false,
          error: {
            code: 'CHANNEL_MISCONFIGURED',
            message: `No publisher is implemented for platform "${platform}".`,
            guidance: 'Check the channel record — the platform value must be one of: youtube, facebook, instagram, tiktok, linkedin, x, pinterest, telegram.',
            retryable: false,
          },
        }
      },
    }
  }
  return p
}

// Errors that should mark the channel expired so the UI prompts a reconnect
export const TOKEN_ERROR_CODES = ['TOKEN_EXPIRED', 'CREDENTIALS_MISSING']
