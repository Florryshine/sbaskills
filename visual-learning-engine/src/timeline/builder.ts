// src/timeline/builder.ts — deterministic scene → frame timeline.
//
// Everything the renderer plays is decided here, from measurable inputs
// (narration durations, word timings, image paths). No AI and no randomness:
// the same episode inputs always produce the same timeline, so the admin
// studio's @remotion/player preview matches the rendered MP4 frame-for-frame.

import type { EpisodeScript, ImageManifest, NarrationManifest, VLTimeline, SceneTimeline, WordTiming, Aspect } from '../types';

export const FPS = 30;

export function aspectSize(aspect: Aspect): { width: number; height: number } {
  if (aspect === '9:16') return { width: 1080, height: 1920 };
  if (aspect === '1:1') return { width: 1080, height: 1080 };
  return { width: 1920, height: 1080 };
}

const TRANSITION_FRAMES = 14; // crossfade between scenes
const NARRATION_LEAD_FRAMES = 8; // scene breathes before narration starts
const NARRATION_TAIL_FRAMES = 14; // scene breathes after narration ends

/** Minimum frames per scene type (visual readability floor). */
const MIN_FRAMES: Record<string, number> = {
  hook: 60,
  title: 60,
  statement: 60,
  compare: 75,
  list: 60,
  stat: 60,
  process: 75,
  quote: 60,
  recap: 60,
  outro: 70,
};

function captionFor(script: EpisodeScript, index: number): string {
  const sc = script.scenes[index];
  if (sc.caption) return sc.caption;
  // Trim narration to one caption-sized sentence.
  const first = sc.narration.split(/(?<=[.!?])\s+/)[0] || sc.narration;
  return first.length > 140 ? `${first.slice(0, 137)}…` : first;
}

function kenBurnsFor(index: number, sceneType: string): SceneTimeline['kenBurns'] {
  // Alternate drift direction per scene; subtler for stat/quote cards.
  const soft = sceneType === 'stat' || sceneType === 'quote' || sceneType === 'recap';
  const zoomIn = index % 2 === 0;
  const fromScale = zoomIn ? 1.0 : soft ? 1.06 : 1.08;
  const toScale = zoomIn ? (soft ? 1.06 : 1.09) : 1.0;
  const drift = soft ? 0.008 : 0.02;
  const dirX = index % 3 === 0 ? 1 : index % 3 === 1 ? -1 : 0;
  const dirY = index % 2 === 0 ? -1 : 1;
  return {
    fromScale,
    toScale,
    fromX: -drift * dirX,
    toX: drift * dirX,
    fromY: -drift * dirY * 0.7,
    toY: drift * dirY * 0.7,
  };
}

/** Shot image files for one scene, in play order. */
function shotsFor(manifest: ImageManifest | undefined, sceneIndex: number): string[] {
  if (!manifest) return [];
  return manifest.assets
    .filter((a) => a.sceneIndex === sceneIndex)
    .sort((a, b) => a.shot - b.shot || a.file.localeCompare(b.file))
    .map((a) => a.file);
}

export interface BuildTimelineInput {
  script: EpisodeScript;
  narration: NarrationManifest;
  aspect: Aspect;
  musicFile: string | null;
  subtitles: boolean;
  watermark: string;
  images?: ImageManifest;
}

export function buildTimeline(input: BuildTimelineInput): VLTimeline {
  const { script, narration, aspect } = input;
  const { width, height } = aspectSize(aspect);
  const scenes: SceneTimeline[] = [];

  let cursor = 0;
  for (let i = 0; i < script.scenes.length; i++) {
    const clip = narration.clips.find((c) => c.sceneIndex === i);
    const narrationDuration = clip ? Math.max(0.5, clip.duration) : 4;
    const minFrames = MIN_FRAMES[script.scenes[i].type] ?? 60;
    const needed = NARRATION_LEAD_FRAMES + Math.ceil(narrationDuration * FPS) + NARRATION_TAIL_FRAMES;
    const durationFrames = Math.max(minFrames, needed);
    const lead = Math.min(NARRATION_LEAD_FRAMES, durationFrames - 6);
    const shots = shotsFor(input.images, i);
    scenes.push({
      sceneIndex: i,
      type: script.scenes[i].type,
      startFrame: cursor,
      durationFrames,
      narrationDelayFrames: lead,
      narrationFile: clip ? clip.file : '',
      narrationDuration,
      words: clip ? clip.words : [],
      kenBurns: kenBurnsFor(i, script.scenes[i].type),
      shots,
      imageFile: shots[0] ?? null,
      caption: captionFor(script, i),
    });
    cursor += durationFrames;
  }

  // Overlap transitions: pull each scene (except the first) forward so the
  // crossfade reads as a continuous flow rather than hard cuts.
  const overlap = TRANSITION_FRAMES;
  let absolute = 0;
  const narrationSpans: VLTimeline['narrationSpans'] = [];
  for (let i = 0; i < scenes.length; i++) {
    const sc = scenes[i];
    sc.startFrame = i === 0 ? 0 : Math.max(0, absolute - overlap);
    absolute = sc.startFrame + sc.durationFrames;
    const narrationStart = sc.startFrame + sc.narrationDelayFrames;
    narrationSpans.push({
      startFrame: narrationStart,
      endFrame: Math.min(sc.startFrame + sc.durationFrames, narrationStart + Math.ceil(sc.narrationDuration * FPS)),
    });
  }

  return {
    fps: FPS,
    width,
    height,
    totalFrames: absolute,
    scenes,
    narrationSpans,
    musicFile: input.musicFile,
    watermark: input.watermark,
    subtitles: input.subtitles,
    meta: script.meta,
  };
}

/** Frame-accurate music volume envelope: full under narration, base elsewhere. */
export function musicVolumeAtFrame(timeline: VLTimeline, frame: number, base = 0.55): number {
  const ducked = base * 0.35;
  const inSpeech = timeline.narrationSpans.some((s) => frame >= s.startFrame - 6 && frame <= s.endFrame + 10);
  // Smooth 8-frame ramps around boundaries to avoid clicks/steps.
  for (const s of timeline.narrationSpans) {
    const preStart = s.startFrame - 14;
    if (frame >= preStart && frame < s.startFrame - 6) return base - ((frame - preStart) / 8) * (base - ducked);
    if (frame >= s.endFrame + 10 && frame <= s.endFrame + 24) return ducked + ((frame - s.endFrame - 10) / 14) * (base - ducked);
  }
  return inSpeech ? ducked : base;
}

/** Active word at a scene-local frame (for captions). */
export function wordAt(words: WordTiming[], sceneLocalSeconds: number): WordTiming | null {
  for (const w of words) {
    if (sceneLocalSeconds >= w.start && sceneLocalSeconds < w.end) return w;
  }
  return null;
}
