// ─── Podcast TTS using Google Cloud Text‑to‑Speech (Free Tier) ───
// 1M characters/month free for Neural2 voices.
// Supports Nigerian English voices: Ezinne, Abeo, etc.
// ──────────────────────────────────────────────────────────────────────

import { TextToSpeechClient } from '@google-cloud/text-to-speech';

// Build credentials from environment variable
const credentials = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
if (!credentials) {
  console.warn('⚠️ GOOGLE_APPLICATION_CREDENTIALS_JSON not set – TTS will fail');
}

const client = new TextToSpeechClient({
  credentials: credentials ? JSON.parse(credentials) : undefined,
});

// ── Voice mapping (Nigerian English) ────────────────────────────────
export const VOICES = {
  host_a: 'en-NG-EzinneNeural',   // warm, Nigerian female (your existing voice)
  host_b: 'en-NG-AbeoNeural',     // Nigerian male (or use 'en-US-Neural2-D' as fallback)
};

// ── Emotion → SSML prosody adjustments ──────────────────────────────
const EMOTION_PROSODY = {
  neutral:   { rate: '1.0', pitch: '0' },
  curious:   { rate: '1.05', pitch: '+2st' },
  excited:   { rate: '1.15', pitch: '+3st' },
  calm:      { rate: '0.9', pitch: '-1st' },
  emphatic:  { rate: '0.95', pitch: '+1st' },
  playful:   { rate: '1.1', pitch: '+2st' },
  serious:   { rate: '0.85', pitch: '-2st' },
};

/**
 * Synthesize a single line using Google Cloud TTS.
 * @param {string} text
 * @param {'host_a'|'host_b'} speaker
 * @param {string} emotion – one of EMOTION_PROSODY keys
 * @returns {Promise<Buffer>} MP3 audio buffer
 */
export async function synthesizeLine(text, speaker, emotion = 'neutral') {
  const voiceName = VOICES[speaker] || VOICES.host_a;
  const prosody = EMOTION_PROSODY[emotion] || EMOTION_PROSODY.neutral;

  // Wrap text in SSML with prosody
  const ssml = `<speak>
    <prosody rate="${prosody.rate}" pitch="${prosody.pitch}">
      ${text}
    </prosody>
  </speak>`;

  const [response] = await client.synthesizeSpeech({
    input: { ssml },
    voice: { languageCode: 'en-NG', name: voiceName }, // en-NG for Nigerian English
    audioConfig: { audioEncoding: 'MP3' },
  });

  if (!response.audioContent) {
    throw new Error(`Google TTS returned no audio for voice ${voiceName}`);
  }

  return Buffer.from(response.audioContent);
}

/**
 * Rough duration estimate (used before we have real audio duration).
 */
export function estimateDurationSeconds(text) {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round((words / 150) * 60));
}