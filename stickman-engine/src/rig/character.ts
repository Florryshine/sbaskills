/**
 * Character skeleton configuration and style presets.
 * World units: pixels at camera scale 1. Ground line is y = 0, y grows down.
 * A character stands with its pelvis at y = -(thigh + shin + ankleH).
 */

export type CharStyle = {
  id: string;
  headR: number;
  neck: number;
  torso: number;
  upperArm: number;
  foreArm: number;
  handR: number;
  thigh: number;
  shin: number;
  ankleH: number;
  strokeW: number;
  headFill: string;      // 'none' keeps the classic line circle
  ink: string;
  garment?: {
    type: 'hoodie';
    color: string;
    shade: string;
  };
};

export const STYLES: Record<string, CharStyle> = {
  ben: {
    id: 'ben', headR: 42, neck: 6, torso: 72, upperArm: 40, foreArm: 36,
    handR: 10, thigh: 46, shin: 42, ankleH: 12, strokeW: 10.5,
    headFill: '#ffffff', ink: '#1a1a1a',
    garment: { type: 'hoodie', color: '#e8862e', shade: '#c96d1c' },
  },
  maya: {
    id: 'maya', headR: 42, neck: 6, torso: 72, upperArm: 40, foreArm: 36,
    handR: 10, thigh: 46, shin: 42, ankleH: 12, strokeW: 10.5,
    headFill: '#ffffff', ink: '#1a1a1a',
    garment: { type: 'hoodie', color: '#3e7fae', shade: '#2e638c' },
  },
  // Classic minimal black stickman (reference-video style) for narrator cameos
  prof: {
    id: 'prof', headR: 46, neck: 6, torso: 74, upperArm: 42, foreArm: 38,
    handR: 10, thigh: 48, shin: 44, ankleH: 12, strokeW: 11,
    headFill: '#1a1a1a', ink: '#1a1a1a',
  },
};

export const legTotal = (s: CharStyle) => s.thigh + s.shin + s.ankleH;

/**
 * A dense skeleton keyframe: every joint position pre-computed by the
 * compiler (FK + IK resolved there), so the renderer only draws.
 * All coordinates are world-space [x, y].
 */
export type SkeletonFrame = {
  pel: [number, number];        // pelvis
  neck: [number, number];
  head: [number, number];       // head center
  shL: [number, number]; shR: [number, number];
  elL: [number, number]; elR: [number, number];
  haL: [number, number]; haR: [number, number];   // hands
  hipL: [number, number]; hipR: [number, number]; // == pelvis (kept for clarity)
  knL: [number, number]; knR: [number, number];
  ftL: [number, number]; ftR: [number, number];   // ankles (feet)
};

export type Emotion =
  | 'neutral' | 'talk' | 'happy' | 'bigsmile' | 'worried'
  | 'strain' | 'surprised' | 'proud' | 'sad' | 'crying' | 'angry' | 'fear' | 'confused' | 'wink' | 'focused';

export type FaceEvent = { frame: number; emo: Emotion };

export type CharacterTrack = {
  id: string;
  style: CharStyle;
  z: number;
  frames: SkeletonFrame[];   // dense, length == timeline duration
  faceEvents: FaceEvent[];
};

export type PropKeyframe = { frame: number; x: number; y: number; rot: number };

export type PropTrack = {
  id: string;
  type: 'box' | 'easel' | 'lamppost' | 'bench' | 'plant';
  w: number; h: number;
  color: string; color2: string;
  z: number;
  frames: PropKeyframe[];
  /** hand attachment offsets (world, relative to prop origin at ground center) */
  handles?: { x: number; y: number }[];
};

export type CameraKeyframe = { cx: number; cy: number; scale: number; rot: number };
export type ShakeEvent = { frame: number; amp: number; dur: number };

export type OverlayArrow = {
  from: [number, number]; to: [number, number];
  color: string; label: string;
};
export type OverlayTrack =
  | { type: 'arrows'; frame: number; dur: number; arrows: OverlayArrow[] }
  | { type: 'formula'; frame: number; dur: number; text: string }
  | { type: 'title'; frame: number; dur: number; text: string; sub?: string };

export type CaptionWord = { w: string; start: number; end: number };
export type CaptionTrack = {
  who: string; text: string;
  frameStart: number; frameEnd: number;
  words: CaptionWord[];
};

export type AudioTrackItem = { file: string; frameStart: number; who: string };

export type Transition = {
  type: 'cut' | 'wipe' | 'zoomThrough';
  frame: number;   // frame at which the next scene starts
  dur: number;
};

export type EnvironmentSpec =
  | { type: 'street'; seed: number; time: 'day' }
  | { type: 'abstract'; seed: number; accent: string }
  | { type: 'classroom'; seed: number };

export type Timeline = {
  version: string;
  fps: number;
  width: number;
  height: number;
  durationFrames: number;
  groundY: number;
  camera: CameraKeyframe[];
  shakeEvents: ShakeEvent[];
  characters: CharacterTrack[];
  props: PropTrack[];
  environment: EnvironmentSpec;
  environmentByScene?: Record<string, EnvironmentSpec>;
  sceneSpans: { id: string; start: number; end: number }[];
  overlays: OverlayTrack[];
  captions: CaptionTrack[];
  audio: AudioTrackItem[];
  transitions: Transition[];
};

// ---------------- SceneScript (authoring format) ----------------

export type DialogueLine = {
  who: string;                     // character id or 'narr'
  text: string;
  audio?: string;                  // path to generated audio (absolute or static-relative)
  t0?: number;                     // explicit scene-relative start (seconds); default sequential
  duration?: number;               // fallback seconds if no audio measured
  words?: { w: string; start: number; end: number }[]; // seconds, absolute from video start
};

export type SceneAction =
  // ---- locomotion ----
  | { char: string; do: 'walk'; from: number; to: number; speed?: number; t0?: number; pushProp?: string }
  | { char: string; do: 'run'; from: number; to: number; speed?: number; t0?: number }
  | { char: string; do: 'turn'; facing: 1 | -1; t0?: number; dur?: number }
  // ---- single-character actions ----
  | { char: string; do: 'push'; prop?: string; moving?: boolean; at?: number; t0?: number; dur?: number }
  | { char: string; do: 'point'; at: [number, number]; t0?: number; dur?: number }
  | { char: string; do: 'present'; at: [number, number]; t0?: number; dur?: number }
  | { char: string; do: 'wave'; t0?: number; dur?: number }
  | { char: string; do: 'reactSurprise'; t0?: number }
  | { char: string; do: 'cheer'; t0?: number; dur?: number }
  | { char: string; do: 'laugh'; t0?: number; dur?: number }
  | { char: string; do: 'stumble'; t0?: number }
  | { char: string; do: 'face'; facing: 1 | -1; t0?: number }
  | { char: string; do: 'sit'; t0?: number }
  | { char: string; do: 'stand'; t0?: number; dur?: number }
  | { char: string; do: 'talkGestures'; line?: number; stressEvery?: number; t0?: number; dur?: number }
  // ---- Phase A: physical actions ----
  | { char: string; do: 'jump'; height?: number; t0?: number; dur?: number }
  | { char: string; do: 'land'; t0?: number; dur?: number }
  | { char: string; do: 'fall'; t0?: number; dur?: number }
  | { char: string; do: 'getUp'; t0?: number; dur?: number }
  | { char: string; do: 'clap'; t0?: number; dur?: number }
  | { char: string; do: 'dance'; t0?: number; dur?: number }
  | { char: string; do: 'pull'; prop?: string; t0?: number; dur?: number }
  // ---- Phase A: object interactions ----
  | { char: string; do: 'pickUp'; prop: string; t0?: number; dur?: number }
  | { char: string; do: 'carry'; prop: string; t0?: number; dur?: number }
  | { char: string; do: 'throw'; prop: string; t0?: number; dur?: number }
  | { char: string; do: 'drop'; prop: string; t0?: number; dur?: number }
  // ---- Phase A: emotion ----
  | { char: string; do: 'expression'; emotion: string; t0?: number; dur?: number }
  // ---- Phase C: inter-character interactions ----
  | { char: string; do: 'approach'; target: string; t0?: number; dur?: number }
  | { char: string; do: 'retreat'; target: string; t0?: number; dur?: number }
  | { char: string; do: 'faceToward'; target: string; t0?: number }
  | { char: string; do: 'leanIn'; target: string; t0?: number; dur?: number }
  | { char: string; do: 'recoil'; target: string; t0?: number; dur?: number };

/** Authoring-format overlay (scene-relative seconds); compiled to OverlayTrack. */
export type SceneOverlay =
  | { type: 'arrows'; t0: number; t1: number; arrows: OverlayArrow[] }
  | { type: 'formula'; t0: number; t1: number; text: string }
  | { type: 'title'; t0: number; t1: number; text: string; sub?: string };

export type CameraIntent =
  | { do: 'establish'; at?: number; scale?: number; dur?: number; drift?: number }
  | { do: 'focus'; point: [number, number]; at?: number; scale?: number; dur?: number; ease?: string }
  | { do: 'follow'; target: string; at?: number; scale?: number; dur?: number; dy?: number }
  | { do: 'twoShot'; targets: [string, string]; at?: number; scale?: number; dur?: number }
  | { do: 'shake'; at: number; amp?: number; dur?: number };

export type ScenePropSpec =
  | { id: string; type: 'box'; x: number; w?: number; h?: number; moving?: { from: number; to: number; t0: number; t1: number; accel?: number } }
  | { id: string; type: 'easel'; x: number }
  | { id: string; type: 'lamppost'; x: number }
  | { id: string; type: 'bench'; x: number }
  | { id: string; type: 'plant'; x: number };

export type Scene = {
  id: string;
  env?: EnvironmentSpec;                    // defaults to top-level environment
  duration?: number;                        // seconds; inferred from dialogue/audio if omitted
  enter?: { type: 'zoomThrough' | 'wipe'; dur?: number };
  exit?: { type: 'zoomThrough' | 'wipe'; dur?: number };
  dialogue?: DialogueLine[];
  actions?: SceneAction[];
  camera?: CameraIntent[];
  props?: ScenePropSpec[];
  overlays?: SceneOverlay[];
  cast?: Record<string, { x: number; facing?: 1 | -1; style?: string }>; // initial positions
};

export type SceneScript = {
  title: string;
  fps?: number;
  width?: number;
  height?: number;
  environment: EnvironmentSpec;
  cast: Record<string, { style: string }>;
  scenes: Scene[];
};
