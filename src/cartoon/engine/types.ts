// Cartoon Animation Studio — engine types.
// Pure visual code only: relative imports, no server dependencies,
// so the same files compile inside Next.js (Player preview) and the
// Remotion server bundle (@remotion/bundler).

export type Orientation = "9:16" | "16:9" | "1:1";

export const ORIENTATION_SIZE: Record<Orientation, { w: number; h: number }> = {
  "9:16": { w: 1080, h: 1920 },
  "16:9": { w: 1920, h: 1080 },
  "1:1": { w: 1080, h: 1080 },
};

// ---- Character DNA ----
export type HairStyle =
  | "short-curls" | "afro-puff" | "braids" | "buzz" | "fade"
  | "ponytail" | "buns" | "long" | "headwrap";

export type Outfit =
  | "hoodie" | "tshirt" | "dress" | "pinafore" | "lab-coat"
  | "sports" | "shirt-trousers" | "skirt-blouse";

export interface CharacterDNA {
  skin: string;
  hairStyle: HairStyle;
  hairColor: string;
  wrapColor?: string; // for headwrap
  outfit: Outfit;
  topColor: string;
  bottomColor: string;
  shoeColor: string;
  accentColor: string;
  height: number;   // 0.9 .. 1.12
  headScale: number; // 0.9 .. 1.15
  bodyWidth: number; // 0.85 .. 1.15
  glasses: boolean;
  earrings: boolean;
  freckles: boolean;
  blush: boolean;
  voice: string;
}

// ---- Expression / action catalogs ----
export type Expression =
  | "neutral" | "happy" | "excited" | "sad" | "angry"
  | "surprised" | "scared" | "confused" | "proud" | "sleepy";

export type Action =
  | "idle" | "talk" | "walk" | "run" | "jump" | "dance"
  | "point" | "wave" | "sit" | "think" | "cheer" | "shrug";

export const EXPRESSIONS: Expression[] = [
  "neutral", "happy", "excited", "sad", "angry",
  "surprised", "scared", "confused", "proud", "sleepy",
];

export const ACTIONS: Action[] = [
  "idle", "talk", "walk", "run", "jump", "dance",
  "point", "wave", "sit", "think", "cheer", "shrug",
];

// ---- Visual concept catalog (what the AI chooses from) ----
export type VisualConcept =
  | "classroom" | "park" | "city" | "bloodstream" | "leaf-world"
  | "chemistry-lab" | "space" | "water-cycle" | "ocean" | "farm"
  | "stage" | "abstract";

export const VISUAL_CONCEPTS: VisualConcept[] = [
  "classroom", "park", "city", "bloodstream", "leaf-world",
  "chemistry-lab", "space", "water-cycle", "ocean", "farm",
  "stage", "abstract",
];

export const CONCEPT_LABELS: Record<VisualConcept, string> = {
  classroom: "Classroom",
  park: "Sunny park",
  city: "City street",
  bloodstream: "Inside the bloodstream",
  "leaf-world": "Inside a plant leaf",
  "chemistry-lab": "Chemistry laboratory",
  space: "Outer space",
  "water-cycle": "Mountain & water cycle",
  ocean: "Under the ocean",
  farm: "Farm field",
  stage: "Presentation stage",
  abstract: "Colourful abstract world",
};

// ---- Props ----
export type PropKind =
  | "book" | "apple" | "heart" | "leaf" | "flask" | "molecule"
  | "star" | "sun" | "cloud" | "blood-cell" | "magnifier" | "bulb"
  | "trophy" | "blackboard" | "droplet" | "rocket" | "backpack"
  | "ruler" | "globe" | "chair" | "speech-plant" | "oxygen-bubble" | "co2-bubble";

export const PROP_KINDS: PropKind[] = [
  "book", "apple", "heart", "leaf", "flask", "molecule",
  "star", "sun", "cloud", "blood-cell", "magnifier", "bulb",
  "trophy", "blackboard", "droplet", "rocket", "backpack",
  "ruler", "globe", "chair", "speech-plant", "oxygen-bubble", "co2-bubble",
];

// ---- Scene layout presets ----
export type SceneLayout =
  | "focus-left" | "focus-right" | "focus-center"
  | "split" | "journey" | "diagram";

export const SCENE_LAYOUTS: SceneLayout[] = [
  "focus-left", "focus-right", "focus-center", "split", "journey", "diagram",
];

export type CameraMove = "none" | "zoom-in" | "zoom-out" | "pan-left" | "pan-right";
export type Transition = "fade" | "slide" | "wipe" | "iris" | "none";

// ---- Spec shape the LLM produces (validated & clamped server-side) ----
export interface SceneCastMember {
  ref: string;        // matches storyboard.characters[].ref
  action: Action;
  expression: Expression;
  x: number;          // 0..1000 = % of width (centre of character)
  y: number;          // 0..1000 = % of height where the FEET stand
  scale: number;      // 0.5..1.6 relative to layout default
  speaking?: boolean; // lip-sync to scene narration
}

export interface SceneProp {
  kind: PropKind;
  x: number; // 0..1000 % of width
  y: number; // 0..1000 % of height (centre)
  scale?: number;
  popAt?: number; // seconds into scene when it pops in (0 = always there)
}

/** Shared Visual Asset Library item placed into a scene (section 7
 * integration). Attached by the auto-discovery pipeline or manually in
 * the studio; `url` must point at a served asset file. */
export interface SceneAssetProp {
  assetId: string;   // VisualAsset.id
  url: string;       // served URL, e.g. /visual-assets/cat-heart.svg
  x: number;         // 0..1000 % of width
  y: number;         // 0..1000 % of height (centre)
  scale?: number;    // 1.0 ≈ 240px on a 1080-wide canvas
  popAt?: number;    // seconds into scene (0 = always visible)
  name?: string;     // display/audit info
  license?: string;  // licence travels with usage (attribution safety)
}

export interface StoryboardScene {
  id: string;
  heading: string;
  narration: string;
  visualConcept: VisualConcept;
  layout: SceneLayout;
  cast: SceneCastMember[];
  props: SceneProp[];
  customAssets?: SceneAssetProp[]; // Shared Visual Asset Library placements
  camera: CameraMove;
  transition: Transition;
  onScreenText?: string;
}

export interface StoryboardCharacter {
  ref: string;
  name: string;
  presetKey?: string; // use an existing preset...
  dna?: CharacterDNA; // ...or fully custom DNA
}

export interface Storyboard {
  title: string;
  description: string;
  caption: string;
  hashtags: string[];
  music: "happy" | "calm" | "curious" | "none";
  characters: StoryboardCharacter[];
  scenes: StoryboardScene[];
}

export interface WordTiming {
  word: string;
  start: number;
  end: number;
}

export interface SceneNarration {
  sceneId: string;
  audioPath: string;   // absolute path on disk
  audioUrl: string;    // served URL
  durationSeconds: number;
  words: WordTiming[];
}

export interface CartoonProjectProps {
  spec: Storyboard;
  narration: Record<string, { audioUrl: string; durationSeconds: number; words: WordTiming[] }>;
  orientation: Orientation;
  brandLine?: string;
  subtitles?: boolean;
}
