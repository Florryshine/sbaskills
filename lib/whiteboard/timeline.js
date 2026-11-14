// lib/whiteboard/timeline.js
//
// Server-side bridge between the Next.js app and the Whiteboard Engine v3
// (whiteboard-engine/). The engine's pure-TS modules (parser, alignment,
// timeline builder) are imported directly — no Remotion is imported here, so
// this stays serverless-safe. Rendering happens in the local worker
// (local-video-renderer/whiteboard-worker.js) where Chrome is available.

import { parseScript } from '../../whiteboard-engine/src/script/parser';
import { buildTimeline } from '../../whiteboard-engine/src/timeline/builder';
import { buildPlannerPrompt } from '../../whiteboard-engine/src/script/planner-prompt';
import { proportionalWords } from '../../whiteboard-engine/src/narration/align';
import { generateWithFallback } from '../llmFallbackChain';
import { parseJsonFromText } from '../robustJsonParse';

/**
 * Duration of a RIFF/WAVE buffer from its header (Gemini TTS returns WAV).
 * Falls back to null for non-WAV data (e.g. Edge MP3) — callers should then
 * use the word-count estimate.
 */
export function wavDurationSeconds(buffer) {
  try {
    if (buffer.length < 44) return null;
    const riff = buffer.toString('latin1', 0, 4);
    if (riff !== 'RIFF') return null;
    // walk chunks to find fmt + data
    let offset = 12;
    let byteRate = null;
    let dataSize = null;
    while (offset + 8 <= buffer.length) {
      const chunkId = buffer.toString('latin1', offset, offset + 4);
      const chunkSize = buffer.readUInt32LE(offset + 4);
      if (chunkId === 'fmt ') {
        byteRate = buffer.readUInt32LE(offset + 16);
      } else if (chunkId === 'data') {
        dataSize = chunkSize;
        break;
      }
      offset += 8 + chunkSize + (chunkSize % 2);
    }
    if (byteRate && dataSize) {
      const seconds = dataSize / byteRate;
      if (isFinite(seconds) && seconds > 0.2 && seconds < 600) return seconds;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Produce the per-scene narration + timeline for a job.
 * narrationResults: [{ buffer, mimeType, audioFile }]
 */
export function buildTimelineForJob(scriptText, narrationResults) {
  const spec = parseScript(scriptText);
  if (spec.scenes.length !== narrationResults.length) {
    throw new Error(`Timeline mismatch: ${spec.scenes.length} scenes vs ${narrationResults.length} narration files`);
  }
  const narration = spec.scenes.map((scene, i) => {
    const res = narrationResults[i];
    const isWav = (res.mimeType || '').includes('wav');
    const duration =
      (isWav ? wavDurationSeconds(res.buffer) : null) ??
      Math.max(1.5, (scene.narration.trim().split(/\s+/).filter(Boolean).length / 150) * 60);
    return {
      audioFile: res.audioFile,
      duration,
      words: proportionalWords(scene.narration, duration),
    };
  });
  const { timeline, warnings } = buildTimeline(spec, narration);
  return { spec, timeline, warnings };
}

/**
 * Ask the LLM fallback chain for a lesson script, then validate it by
 * parsing. Returns the script text (may be a repaired retry).
 */
export async function generateScriptWithAI(topic, subject) {
  const prompt = buildPlannerPrompt(topic, subject);

  // JSON mode is the reliable path: ask for {"script": "..."} and validate
  // by actually parsing the DSL.
  const { result } = await generateWithFallback(
    `${prompt}\n\nReturn strict JSON: {"script": "<the full DSL script>"}. Newlines inside the string must be \\n escaped.`,
    (text) => parseJsonFromText(text, 'object'),
    (obj) => obj && typeof obj.script === 'string' && obj.script.includes('scene '),
    8192,
  );
  if (result?.script) return result.script;

  // Fallback: some providers answer with the raw DSL despite instructions.
  const raw = await generateWithFallback(prompt, { maxTokens: 8192 });
  if (raw && typeof raw === 'string' && raw.includes('scene ')) return raw;
  throw new Error('AI script generation failed — no provider returned a usable script.');
}
