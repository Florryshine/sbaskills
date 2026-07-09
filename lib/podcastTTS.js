// ─── TTS using openai-edge-tts (Render endpoint) ─────────────────────
// With random effect selection for laughs and exclamations.

const TTS_ENDPOINT = process.env.TTS_ENDPOINT || 'https://openai-edge-tts-aqq1.onrender.com';

export const VOICES = {
  host_a: 'en-NG-EzinneNeural',
  host_b: 'en-NG-AbeoNeural',
};

// Emotion → speed mapping (more expressive)
const EMOTION_CONFIG = {
  excited:   { speed: 1.25, pitch: '+3st' },
  shocked:   { speed: 1.15, pitch: '+4st' },
  curious:   { speed: 1.05, pitch: '+1st' },
  serious:   { speed: 0.88, pitch: '-1st' },
  calm:      { speed: 0.85, pitch: '-2st' },
  playful:   { speed: 1.1,  pitch: '+1.5st' },
  emphatic:  { speed: 0.95, pitch: '+0.5st' },
  dramatic:  { speed: 0.95, pitch: '+2st' },
  neutral:   { speed: 1.0,  pitch: '0st' },
};

// Effect → list of available audio files (random selection)
export const EFFECT_FILES = {
  laugh_a: [
    '/audio/effects/host_a_laugh.mp3',
    '/audio/effects/host_a_laugh_2.mp3',
  ],
  laugh_b: [
    '/audio/effects/host_b_laugh.mp3',
    '/audio/effects/host_b_laugh_2.mp3',
  ],
  wow: [
    '/audio/effects/wow.mp3',
    '/audio/effects/wow-wow.mp3',
  ],
  oh: [
    '/audio/effects/oh.mp3',
    '/audio/effects/oh-yeah.mp3',
  ],
};

/**
 * Get a random effect URL for the given effect type.
 * Returns null if effect type is not recognised.
 */
export function getRandomEffect(effectType) {
  if (!effectType || effectType === 'none') return null;
  const files = EFFECT_FILES[effectType];
  if (!files || files.length === 0) return null;
  return files[Math.floor(Math.random() * files.length)];
}

/**
 * Synthesize a single line using openai-edge-tts.
 */
export async function synthesizeLine(text, speaker, emotion = 'neutral') {
  const voice = VOICES[speaker] || 'en-US-AvaMultilingualNeural';
  const config = EMOTION_CONFIG[emotion] || EMOTION_CONFIG.neutral;
  const speed = config.speed;

  // Add a small pause for natural breathing
  const textWithPause = text + ' <break time="300ms"/>';

  const response = await fetch(`${TTS_ENDPOINT}/v1/audio/speech`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'tts-1',
      input: textWithPause,
      voice: voice,
      response_format: 'mp3',
      speed: speed,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`TTS API error (${response.status}): ${errorText}`);
  }

  const buffer = await response.arrayBuffer();
  return Buffer.from(buffer);
}

/**
 * Rough duration estimate (used before we have real audio duration).
 */
export function estimateDurationSeconds(text) {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round((words / 150) * 60));
}