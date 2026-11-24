// src/types.ts — Visual Learning Engine spec types.
//
// The pipeline speaks JSON at every stage boundary so jobs can be persisted,
// resumed and previewed:
//   VLJobSpec    — what the worker stores on the job row (the "what to make")
//   EpisodeScript — the written episode (scenes, headlines, narration)
//   NarrationManifest — per-scene audio + word timings (measured)
//   ImageManifest     — per-scene resolved visual assets + provenance
//   VLTimeline   — the deterministic frame map consumed by the Remotion render

export type Aspect = '16:9' | '9:16' | '1:1';

export type StylePreset = 'cartoon' | 'photo' | 'sketch';

export type NarrationProviderName = 'gemini' | 'edge' | 'proxy' | 'zai' | 'silent';

export type ImageProviderName = 'pollinations' | 'zai' | 'wikimedia' | 'pexels' | 'pixabay' | 'openverse' | 'pexels-video' | 'pixabay-video' | 'placeholder';

export interface VLJobSpec {
  /** Human episode title (used for the outro card and filenames). */
  title: string;
  topic: string;
  /** Specific lesson concepts supplied by the creator or knowledge base. */
  keyPoints?: string[];
  audience: string;
  /** narrator tone, e.g. "warm and curious", "energetic", "calm documentary" */
  tone: string;
  /** target duration in seconds (clamped 20–900) */
  targetSeconds: number;
  aspect: Aspect;
  style: StylePreset;
  /** narration voice preset id (see VOICE_PRESETS) */
  voice: string;
  /** accent color for headlines/graphics (hex), empty = theme default */
  accent: string;
  music: boolean;
  subtitles: boolean;
  /** deterministic image seeds for reproducibility */
  seed: number;
  /** structured script override; when present the planner is skipped */
  script?: EpisodeScript;
  /** provider overrides (worker sets these from env/availability) */
  narrationProvider?: NarrationProviderName;
  imageProvider?: ImageProviderName;
  /** max seconds a single image may stay on screen (default 3) */
  maxShotSeconds?: number;
  /** watermark text, e.g. brand; empty = none */
  watermark: string;
}

export interface EpisodeScript {
  meta: {
    title: string;
    /** big hook question rendered on the hook card */
    hookHeadline: string;
    subtitle: string;
    style: StylePreset;
    accent: string;
  };
  scenes: SceneSpec[];
}

export type SceneSpec =
  | HookScene
  | TitleScene
  | StatementScene
  | CompareScene
  | ListScene
  | StatScene
  | ProcessScene
  | QuoteScene
  | RecapScene
  | OutroScene;

interface SceneBase {
  /** narration read over this scene (1–6 sentences) */
  narration: string;
  /** optional short caption override; defaults to narration trimmed */
  caption?: string;
}

export interface HookScene extends SceneBase {
  type: 'hook';
  headline: string;
  /** one word inside the headline gets the accent color */
  accentWord?: string;
  image_prompt: string;
}

export interface TitleScene extends SceneBase {
  type: 'title';
  headline: string;
  subtitle?: string;
  image_prompt: string;
}

export interface StatementScene extends SceneBase {
  type: 'statement';
  headline: string;
  accentWord?: string;
  image_prompt: string;
  /** up to 3 small chips popped in next to the illustration */
  badges?: { label: string; emoji?: string }[];
}

export interface CompareScene extends SceneBase {
  type: 'compare';
  left: { label: string; image_prompt: string; tone?: 'bad' | 'good' | 'neutral' };
  right: { label: string; image_prompt: string; tone?: 'bad' | 'good' | 'neutral' };
  versus?: string;
}

export interface ListScene extends SceneBase {
  type: 'list';
  title: string;
  items: { text: string; emoji?: string }[];
}

export interface StatScene extends SceneBase {
  type: 'stat';
  /** numeric portion rendered giant and counted up, e.g. "40", "2x", "90%" */
  number: string;
  headline: string;
  /** Traceable evidence source; required by validation for factual statistics. */
  source?: string;
  image_prompt?: string;
}

export interface ProcessScene extends SceneBase {
  type: 'process';
  title: string;
  steps: { text: string; emoji?: string }[];
}

export interface QuoteScene extends SceneBase {
  type: 'quote';
  text: string;
  author: string;
}

export interface RecapScene extends SceneBase {
  type: 'recap';
  title?: string;
  items: string[];
}

export interface OutroScene extends SceneBase {
  type: 'outro';
  headline: string;
  cta?: string;
}

export interface WordTiming {
  word: string;
  start: number;
  end: number;
}

export interface NarrationClip {
  sceneIndex: number;
  provider: NarrationProviderName;
  /** stored relative to the job's public dir */
  file: string;
  duration: number;
  words: WordTiming[];
  voice: string;
}

export interface NarrationManifest {
  provider: NarrationProviderName;
  voice: string;
  clips: NarrationClip[];
}

export interface ImageAsset {
  sceneIndex: number;
  provider: ImageProviderName;
  /** stored relative to the job's public dir */
  file: string;
  prompt: string;
  seed: number;
  width: number;
  height: number;
  /** shot index within the scene (0 = main shot) */
  shot: number;
}

export interface ImageManifest {
  style: StylePreset;
  assets: ImageAsset[];
}

export interface SceneTimeline {
  sceneIndex: number;
  type: SceneSpec['type'];
  /** absolute start frame in the composition */
  startFrame: number;
  durationFrames: number;
  /** narration enters this many frames after the scene starts */
  narrationDelayFrames: number;
  narrationFile: string;
  narrationDuration: number;
  words: WordTiming[];
  kenBurns: { fromScale: number; toScale: number; fromX: number; toX: number; fromY: number; toY: number };
  /** image shots for this scene, in play order (the carousel advances <= maxShotSeconds) */
  shots: string[];
  imageFile: string | null;
  caption: string;
}

export interface VLTimeline {
  fps: number;
  width: number;
  height: number;
  totalFrames: number;
  scenes: SceneTimeline[];
  /** absolute frames where narration is audible (music ducks there) */
  narrationSpans: { startFrame: number; endFrame: number }[];
  musicFile: string | null;
  watermark: string;
  subtitles: boolean;
  meta: EpisodeScript['meta'];
}
