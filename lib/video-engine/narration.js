// lib/video-engine/narration.js
//
// Was referenced by local-video-renderer/worker.js but never actually
// committed — this fills that gap. Runs LOCALLY only (via worker.js on
// your laptop), never on Vercel: edge-tts-universal's underlying service
// blocks cloud-datacenter IPs, which is exactly why the podcast engine
// (server-side) had to move to Gemini TTS instead. On a home connection,
// edge-tts-universal works fine.
//
// Uses the same Nigerian-English voice as the local Python video pipeline
// (en-NG-EzinneNeural) so narration sounds consistent across both systems.

import { EdgeTTS } from 'edge-tts-universal';

const VOICE = 'en-NG-EzinneNeural';
const PROSODY = { rate: '+0%', volume: '+0%', pitch: '+0Hz' };

// edge-tts word-boundary offsets/durations come back in 100-nanosecond
// ticks (same convention as the underlying Python edge-tts library).
const TICKS_PER_SECOND = 10_000_000;

async function synthesizeOne(text) {
  const tts = new EdgeTTS(text, VOICE, PROSODY);
  const result = await tts.synthesize();
  const buffer = Buffer.from(await result.audio.arrayBuffer());

  let durationSeconds = null;
  const subtitle = result.subtitle || [];
  if (subtitle.length > 0) {
    const last = subtitle[subtitle.length - 1];
    durationSeconds = (last.offset + last.duration) / TICKS_PER_SECOND;
  }

  // Fallback if no word-boundary data came back (rare): estimate at a
  // natural ~150 words/minute spoken pace, floor at 1.5s so a very short
  // line still gets a real slide instead of a near-instant flash.
  if (!durationSeconds || durationSeconds <= 0) {
    const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
    durationSeconds = Math.max(1.5, (wordCount / 150) * 60);
  }

  return { buffer, durationSeconds };
}

/**
 * Synthesizes one MP3 buffer + duration per script segment.
 *
 * Runs sequentially, not Promise.all — Edge's TTS websocket endpoint is
 * rate-limit-sensitive and segment counts here are small (3-7 per video),
 * so serializing costs a few seconds, not minutes, and avoids getting
 * throttled or blocked mid-batch.
 *
 * @param {Array<{text: string, visual_cue?: string, stock_search?: string}>} segments
 * @returns {Promise<{ segmentAudio: Array<{buffer: Buffer, durationSeconds: number, text: string, visual_cue?: string, stock_search?: string}> }>}
 */
export async function synthesizeLessonNarration(segments) {
  const segmentAudio = [];
  for (const seg of segments) {
    const { buffer, durationSeconds } = await synthesizeOne(seg.text);
    segmentAudio.push({
      buffer,
      durationSeconds,
      text: seg.text,
      visual_cue: seg.visual_cue,
      stock_search: seg.stock_search,
    });
  }
  return { segmentAudio };
}
