// Narration: per-scene TTS with MEASURED duration (WAV header) and
// proportional word timings (same philosophy as whiteboard-engine's
// proportionalWords fallback — but measured, not estimated).
import fs from "fs";
import path from "path";
import { synthesizeSpeech } from "./zai";
import type { WordTiming } from "../engine/types";

const MEDIA_ROOT = path.join(process.cwd(), "media");

export function wavDurationSeconds(buf: Buffer): number {
  // RIFF WAV: find "data" chunk
  if (buf.length < 44 || buf.toString("ascii", 0, 4) !== "RIFF") {
    // fallback: assume 24kHz 16-bit mono from z-ai
    return buf.length / 48000;
  }
  let pos = 12;
  while (pos + 8 <= buf.length) {
    const id = buf.toString("ascii", pos, pos + 4);
    const size = buf.readUInt32LE(pos + 4);
    if (id === "data") {
      const byteRate = buf.readUInt32LE(28) || 48000; // fmt byteRate
      return size / byteRate;
    }
    pos += 8 + size + (size % 2);
  }
  return buf.length / 48000;
}

/** Proportional word alignment: split measured duration across words,
 * weighted by word length (better than uniform split for lip-sync feel). */
export function proportionalWords(text: string, duration: number, lead = 0.25): WordTiming[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const speechDur = Math.max(0.4, duration - lead - 0.1);
  const weights = words.map((w) => Math.max(2, w.replace(/[^\w]/g, "").length) + 1.2);
  const total = weights.reduce((a, b) => a + b, 0);
  const out: WordTiming[] = [];
  let t = lead;
  for (let i = 0; i < words.length; i++) {
    const d = (weights[i] / total) * speechDur;
    out.push({ word: words[i], start: +t.toFixed(3), end: +(t + d).toFixed(3) });
    t += d;
  }
  return out;
}

export interface NarrationResult {
  sceneId: string;
  audioPath: string;
  audioUrl: string;
  durationSeconds: number;
  words: WordTiming[];
}

export async function synthesizeScene(opts: {
  projectId: string;
  sceneId: string;
  text: string;
  voice?: string;
  speed?: number;
}): Promise<NarrationResult> {
  // Static-served location: works in the Next Player (/cartoon-media/...)
  // AND inside the Remotion render bundle (publicDir is bundled at render
  // time). In the sbaskills port this path becomes the Supabase Storage URL.
  const dir = path.join(process.cwd(), "public", "cartoon-media", opts.projectId);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${opts.sceneId}.wav`);
  const buf = await synthesizeSpeech(opts.text, opts.voice || "tongtong", opts.speed ?? 1.0);
  fs.writeFileSync(file, buf);
  const duration = Math.max(0.8, wavDurationSeconds(buf));
  return {
    sceneId: opts.sceneId,
    audioPath: file,
    audioUrl: `/cartoon-media/${opts.projectId}/${opts.sceneId}.wav`,
    durationSeconds: +duration.toFixed(3),
    words: proportionalWords(opts.text, duration),
  };
}

export function deleteProjectAudio(projectId: string) {
  const dir = path.join(process.cwd(), "public", "cartoon-media", projectId);
  fs.rmSync(dir, { recursive: true, force: true });
}
// v2: static-served narration
