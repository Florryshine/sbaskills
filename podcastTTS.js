// ─── Podcast TTS: free, unlimited, natural-sounding voices via Edge TTS ────
// Uses the same underlying engine as Microsoft Edge's "Read Aloud" feature.
// No API key, no per-character cost, no monthly cap.
//
// npm install edge-tts-universal

import { Communicate } from 'edge-tts-universal';

// ── Default voice pairing ───────────────────────────────────────────────
// Host A stays Ezinne (your existing brand voice, Nigerian, warm).
// Host B uses a "Multilingual Neural" voice — Microsoft's newest generation,
// noticeably more natural/expressive than the older standard voices, and
// still completely free through the same Edge TTS service.
export const VOICES = {
  host_a: 'en-NG-EzinneNeural',
  host_b: 'en-US-AvaMultilingualNeural',
};

// Alternate pairing if you want BOTH hosts Nigerian-accented instead:
// host_b: 'en-NG-AbeoNeural'

// ── Emotion tag → prosody mapping ───────────────────────────────────────
// Edge TTS (via this package) only supports basic <prosody> control
// (rate/pitch/volume), not full SSML emotion styles. We simulate emotional
// range by adjusting these per line based on a tag the LLM assigns.
const EMOTION_PROSODY = {
  neutral: { rate: '+0%', pitch: '+0Hz' },
  curious: { rate: '+4%', pitch: '+15Hz' },
  excited: { rate: '+12%', pitch: '+25Hz' },
  calm: { rate: '-6%', pitch: '-5Hz' },
  emphatic: { rate: '-4%', pitch: '+10Hz' },
  playful: { rate: '+8%', pitch: '+20Hz' },
  serious: { rate: '-8%', pitch: '-10Hz' },
};

/**
 * Synthesize a single line of dialogue.
 * @param {string} text
 * @param {'host_a'|'host_b'} speaker
 * @param {string} emotion - one of the keys in EMOTION_PROSODY
 * @returns {Promise<Buffer>} mp3 audio buffer
 */
export async function synthesizeLine(text, speaker, emotion = 'neutral') {
  const voice = VOICES[speaker] || VOICES.host_a;
  const prosody = EMOTION_PROSODY[emotion] || EMOTION_PROSODY.neutral;

  const communicate = new Communicate(text, {
    voice,
    rate: prosody.rate,
    pitch: prosody.pitch,
  });

  const chunks = [];
  for await (const chunk of communicate.stream()) {
    if (chunk.type === 'audio' && chunk.data) {
      chunks.push(Buffer.from(chunk.data));
    }
  }

  if (chunks.length === 0) {
    throw new Error(`Edge TTS returned no audio for voice ${voice}`);
  }

  return Buffer.concat(chunks);
}

/**
 * Rough duration estimate for a line, used before we have the real audio
 * duration (e.g. for progress UI). ~150 words/minute average speech rate.
 */
export function estimateDurationSeconds(text) {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round((words / 150) * 60));
}
