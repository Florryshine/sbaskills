// ─── TTS using openai-edge-tts (Render endpoint) ────
// No API key required (REQUIRE_API_KEY=false is set on Render)

const TTS_ENDPOINT = process.env.TTS_ENDPOINT || 'https://openai-edge-tts-aqq1.onrender.com';

export const VOICES = {
  host_a: 'en-NG-EzinneNeural',
  host_b: 'en-NG-AbeoNeural',
};

export async function synthesizeLine(text, speaker, emotion = 'neutral') {
  const voice = VOICES[speaker] || 'en-US-AvaMultilingualNeural';

  const speedMap = {
    excited: 1.15,
    calm: 0.9,
    curious: 1.05,
    emphatic: 0.95,
    playful: 1.1,
    serious: 0.85,
    neutral: 1.0,
  };
  const speed = speedMap[emotion] || 1.0;

  const response = await fetch(`${TTS_ENDPOINT}/v1/audio/speech`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'tts-1',
      input: text,
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

export function estimateDurationSeconds(text) {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round((words / 150) * 60));
}