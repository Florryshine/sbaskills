// lib/whiteboard/audio.js — small, dependency-free helpers shared by the worker and tests.

/** Retry an async fn with exponential backoff (TTS endpoints on free tiers cold-start / rate-limit). */
export async function withRetry(fn, { attempts = 3, baseMs = 2000, label = 'operation', onRetry } = {}) {
  let lastError;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn(i);
    } catch (err) {
      lastError = err;
      if (i < attempts) {
        onRetry?.(err, i);
        await new Promise((r) => setTimeout(r, baseMs * 2 ** (i - 1)));
      }
    }
  }
  throw new Error(`${label} failed after ${attempts} attempts: ${lastError?.message || lastError}`);
}

/**
 * Gemini TTS may hand back raw 16-bit PCM (mime like "audio/L16;rate=24000") instead of a
 * RIFF/WAV container. Remotion/ffmpeg cannot play headerless PCM, and the duration reader needs
 * the header, so wrap it. Anything already RIFF or MP3 is returned untouched.
 * Returns { buffer, mimeType }.
 */
export function normalizeAudio(buffer, mimeType = '') {
  const mime = String(mimeType || '').toLowerCase();
  const isRiff = buffer.length >= 4 && buffer.toString('latin1', 0, 4) === 'RIFF';
  if (isRiff) return { buffer, mimeType: 'audio/wav' };
  if (mime.includes('mpeg') || mime.includes('mp3')) return { buffer, mimeType: 'audio/mpeg' };
  if (/l16|pcm|raw/.test(mime) || (mime.includes('wav') && !isRiff)) {
    const rate = Number((mime.match(/rate=(\d+)/) || [])[1]) || 24000;
    const channels = Number((mime.match(/channels=(\d+)/) || [])[1]) || 1;
    const header = Buffer.alloc(44);
    header.write('RIFF', 0, 'latin1');
    header.writeUInt32LE(36 + buffer.length, 4);
    header.write('WAVE', 8, 'latin1');
    header.write('fmt ', 12, 'latin1');
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);
    header.writeUInt16LE(channels, 22);
    header.writeUInt32LE(rate, 24);
    header.writeUInt32LE(rate * channels * 2, 28);
    header.writeUInt16LE(channels * 2, 32);
    header.writeUInt16LE(16, 34);
    header.write('data', 36, 'latin1');
    header.writeUInt32LE(buffer.length, 40);
    return { buffer: Buffer.concat([header, buffer]), mimeType: 'audio/wav' };
  }
  return { buffer, mimeType: mimeType || 'audio/mpeg' };
}
