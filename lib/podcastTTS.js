// Expressive Gemini TTS with the existing Edge TTS endpoint as a safe fallback.
// Gemini 3.8 uses the Interactions API and returns WAV audio by default.

const TTS_ENDPOINT = process.env.TTS_ENDPOINT || 'https://openai-edge-tts-aqq1.onrender.com';
const GEMINI_KEYS = [
  process.env.GEMINI_API_KEY_1,
  process.env.GEMINI_API_KEY_2,
  process.env.GEMINI_API_KEY,
].filter(Boolean);

const GEMINI_MODEL = process.env.GEMINI_TTS_MODEL || 'gemini-3.8-flash-tts';

export const VOICES = {
  host_a: process.env.GEMINI_TTS_VOICE_A || 'Kore',
  host_b: process.env.GEMINI_TTS_VOICE_B || 'Charon',
};

const EMOTION_STYLE = {
  excited: 'Energetic, genuinely excited, bright and lively; emphasize important words naturally.',
  shocked: 'Surprised and astonished, with a brief expressive reaction; keep it believable.',
  curious: 'Curious, interested and conversational, with natural upward inflection.',
  serious: 'Serious, focused and confident; measured pace and clear articulation.',
  calm: 'Warm, calm, reassuring and gentle; relaxed natural pacing.',
  playful: 'Playful, friendly and lightly humorous; expressive but not exaggerated.',
  emphatic: 'Confident and persuasive; stress key phrases naturally.',
  dramatic: 'Dramatic storytelling delivery; build tension and vary pace naturally.',
  neutral: 'Natural, warm, clear conversational delivery.',
};

function getStyle(emotion, speedOverride) {
  const style = EMOTION_STYLE[emotion] || EMOTION_STYLE.neutral;
  const speed = Number(speedOverride);
  const pace = Number.isFinite(speed) && speed > 0
    ? ` Speak at approximately ${speed.toFixed(2)}x normal speed.`
    : '';
  return `Speak in natural, clear Nigerian English, suitable for an engaging Nigerian educator. ${style}${pace} Do not add, remove, or paraphrase any words.`;
}

function extractGeminiAudio(payload) {
  const interaction = payload?.interaction || payload;
  // The SDK exposes output_audio; raw REST responses expose audio under
  // steps[].content[]. Both response shapes are supported here.
  const stepAudio = (interaction?.steps || payload?.steps || [])
    .filter((step) => step?.type === 'model_output')
    .flatMap((step) => step?.content || [])
    .filter((item) => item?.type === 'audio')
    .at(-1);
  const audio = interaction?.output_audio || interaction?.outputAudio || stepAudio;
  const encoded = audio?.data || audio?.inline_data?.data || audio?.inlineData?.data;
  if (!encoded) {
    const message = interaction?.error?.message || payload?.error?.message || 'Gemini returned no audio data.';
    throw new Error(message);
  }
  const buffer = Buffer.from(encoded, 'base64');
  if (buffer.length < 512) throw new Error('Gemini returned an empty or invalid audio payload.');
  buffer.mimeType = audio.mime_type || audio.mimeType || 'audio/wav';
  return buffer;
}

async function synthesizeWithGemini(text, speaker, emotion, speedOverride) {
  if (!GEMINI_KEYS.length) throw new Error('GEMINI_API_KEY is not configured.');
  let lastError;
  for (const apiKey of GEMINI_KEYS) {
    try {
      const response = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        signal: AbortSignal.timeout(60000),
        body: JSON.stringify({
          model: GEMINI_MODEL,
          input: [{
            type: 'user_input',
            content: [{
              type: 'text',
              text: text.trim(),
              annotations: [{
                type: 'speech_metadata',
                style: getStyle(emotion, speedOverride),
              }],
            }],
          }],
          response_format: { type: 'audio' },
          generation_config: {
            speech_config: [{ voice: VOICES[speaker] || VOICES.host_a }],
          },
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const detail = payload?.error?.message || JSON.stringify(payload);
        throw new Error(`Gemini TTS API error (${response.status}): ${detail}`);
      }
      return extractGeminiAudio(payload);
    } catch (error) {
      lastError = error;
      // Try the next configured key for quota/rate-limit errors.
    }
  }
  throw lastError || new Error('Gemini TTS failed.');
}

async function synthesizeWithEdge(text, speaker, emotion, speedOverride) {
  const voices = {
    host_a: 'en-NG-EzinneNeural',
    host_b: 'en-NG-AbeoNeural',
  };
  const speeds = {
    excited: 1.3, shocked: 1.2, curious: 1.15, serious: 1,
    calm: 0.95, playful: 1.2, emphatic: 1.05, dramatic: 1.05, neutral: 1.1,
  };
  const speed = Number.isFinite(Number(speedOverride)) && speedOverride !== null
    ? Number(speedOverride)
    : (speeds[emotion] || speeds.neutral);
  const response = await fetch(`${TTS_ENDPOINT}/v1/audio/speech`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(30000),
    body: JSON.stringify({
      model: 'tts-1',
      input: text.trim(),
      voice: voices[speaker] || 'en-US-AvaMultilingualNeural',
      speed: Math.max(0.25, Math.min(4, speed)),
      response_format: 'mp3',
    }),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Fallback TTS API error (${response.status}): ${errorText}`);
  }
  const contentType = response.headers.get('content-type') || '';
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length < 512 || /application\/(json|problem\+json)|text\/html/i.test(contentType)) {
    throw new Error(`Fallback TTS returned invalid audio (content-type: ${contentType || 'unknown'}, bytes: ${buffer.length})`);
  }
  buffer.mimeType = 'audio/mpeg';
  return buffer;
}

export async function synthesizeLine(text, speaker, emotion = 'neutral', speedOverride = null) {
  if (typeof text !== 'string' || !text.trim()) throw new Error('TTS input is empty');

  // Gemini is the primary voice when its API key is configured. If it is
  // temporarily unavailable, preserve the existing Edge TTS pipeline.
  if (GEMINI_KEYS.length && process.env.TTS_PROVIDER !== 'edge') {
    try {
      return await synthesizeWithGemini(text, speaker, emotion, speedOverride);
    } catch (error) {
      console.warn('Gemini TTS failed; falling back to Edge TTS:', error.message);
    }
  }
  return synthesizeWithEdge(text, speaker, emotion, speedOverride);
}

export function getAudioMimeType(buffer) {
  return buffer?.mimeType || 'audio/mpeg';
}

export function getAudioExtension(buffer) {
  return getAudioMimeType(buffer) === 'audio/wav' ? 'wav' : 'mp3';
}

export function estimateDurationSeconds(text) {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round((words / 150) * 60));
}


/**
 * Resolve one of the bundled reaction clips for podcast script effects.
 * Returns a public/relative path consumed by podcastGenerate's local-file reader.
 */
export function getRandomEffect(effect) {
  const filesByEffect = {
    laugh_a: ['host_a_laugh.mp3', 'host_a_laugh_2.mp3'],
    laugh_b: ['host_b_laugh.mp3', 'host_b_laugh_2.mp3'],
    wow: ['wow.mp3', 'wow-wow.mp3'],
    oh: ['oh-yeah.mp3'],
  };
  const candidates = filesByEffect[effect];
  if (!candidates) return null;

  // Keep the mapping explicit: a missing clip should be skipped, not cause
  // podcast generation to fail. The selected file is randomized per line.
  const { existsSync } = require('node:fs');
  const { join } = require('node:path');
  const available = candidates.filter((name) =>
    existsSync(join(process.cwd(), 'public', 'audio', 'effects', name))
  );
  if (available.length === 0) return null;
  const selected = available[Math.floor(Math.random() * available.length)];
  return `audio/effects/${selected}`;
}
