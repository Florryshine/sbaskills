// lib/publishers/registry.js
import { publishInstagram } from './instagram';
import { publishFacebook } from './facebook';
import { publishTelegram } from './telegram';
import { publishLinkedIn } from './linkedin';
import { publishX } from './x';
import { publishPinterest } from './pinterest';
import { publishYouTube, refreshYouTubeToken } from './youtube';
import { publishTikTok, refreshTikTokToken } from './tiktok';

export const PUBLISHERS = {
  instagram: { publish: publishInstagram },
  facebook: { publish: publishFacebook },
  telegram: { publish: publishTelegram },
  linkedin: { publish: publishLinkedIn },
  x: { publish: publishX },
  pinterest: { publish: publishPinterest },
  youtube: { publish: publishYouTube, refreshToken: refreshYouTubeToken },
  tiktok: { publish: publishTikTok, refreshToken: refreshTikTokToken },
};

export function getPublisher(platform) {
  const adapter = PUBLISHERS[platform];
  if (!adapter) throw new Error(`No publisher adapter registered for platform: ${platform}`);
  return adapter;
}
