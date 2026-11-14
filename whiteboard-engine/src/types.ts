// src/types.ts — SBA Whiteboard Engine v3 scene schema + timeline types.

export type Subject = 'biology' | 'chemistry' | 'physics' | 'mathematics' | 'general';

/** Color keys resolved against the theme at build time. Raw hex allowed. */
export type InkColor = 'ink' | 'inkSoft' | 'accent' | 'accent2' | 'highlight' | string;

export type FontKind = 'heading' | 'body' | 'label';

// ---------------------------------------------------------------------------
// Illustrations
// ---------------------------------------------------------------------------

export interface StrokeSpec {
  /** SVG path `d` string in asset-local coordinates. */
  d: string;
  /** Stroke width in asset coordinates (default 3.5). */
  width?: number;
  color?: InkColor;
  /** Fill applied (fades in) after this stroke finishes drawing. */
  fill?: InkColor;
  fillOpacity?: number;
  /** Schedule this stroke only after the stroke at this 0-based index finished. */
  afterStroke?: number;
}

export interface LabelSpec {
  text: string;
  x: number;
  y: number;
  size?: number;
  color?: InkColor;
  align?: 'start' | 'middle' | 'end';
  font?: FontKind;
}

export interface IllustrationSpec {
  id: string;
  strokes: StrokeSpec[];
  labels?: LabelSpec[];
  /** Natural size used by the layout engine for fitting. */
  box: { w: number; h: number };
}

// ---------------------------------------------------------------------------
// Precomputed geometry (built in Node, consumed by Remotion)
// ---------------------------------------------------------------------------

export interface SampledPoint {
  x: number;
  y: number;
}

export interface SampledStroke {
  /** Dense polyline samples of the path (local asset coordinates). */
  points: SampledPoint[];
  /** Polyline length in asset units. */
  length: number;
  width: number;
  color: string; // resolved hex
  fill?: string;
  fillOpacity?: number;
  afterStroke?: number;
  /** Filled by the timeline builder: seconds (element-local) until stroke starts. */
  start?: number;
  /** Filled by the timeline builder: seconds this stroke takes to draw. */
  duration?: number;
}

export interface SampledIllustration {
  id: string;
  strokes: SampledStroke[];
  labels: LabelSpec[];
  totalLength: number;
  box: { w: number; h: number };
}

// ---------------------------------------------------------------------------
// Scenes & elements (declarative schema)
// ---------------------------------------------------------------------------

export type SceneLayout = 'title' | 'concept' | 'diagram' | 'list' | 'equation' | 'summary';

export type SyncRef =
  | { kind: 'phrase'; phrase: string }
  | { kind: 'fraction'; fraction: number }
  | { kind: 'word'; index: number }
  | { kind: 'none' };

export interface EquationTerm {
  kind: 'chem' | 'text' | 'arrow';
  text?: string;
  /** Condition label drawn above an arrow, e.g. "light". */
  label?: string;
}

export interface ElementSpec {
  id: string;
  type: 'text' | 'bullet' | 'illustration' | 'arrow' | 'highlight' | 'equation' | 'callout' | 'tick';
  text?: string;
  /** Illustration id, e.g. "biology.plant". */
  asset?: string;
  sync?: SyncRef;
  /** Layout hint: left | right | center | below | above | top-left | top-right | bottom-left | bottom-right */
  at?: string;
  scale?: number;
  /** highlight: circle | underline | box;  arrow: curved | straight */
  style?: string;
  /** Words to render in the accent color. */
  emphasis?: string[];
  /** Arrow endpoints in board coordinates (1920x1080). */
  from?: { x: number; y: number };
  to?: { x: number; y: number };
  label?: string;
  terms?: EquationTerm[];
}

export interface SceneSpec {
  id: string;
  layout: SceneLayout;
  heading?: string;
  sub?: string;
  narration: string;
  elements: ElementSpec[];
  minDuration?: number;
}

export interface VideoSpec {
  title: string;
  subject: Subject;
  voice?: string;
  scenes: SceneSpec[];
}

// ---------------------------------------------------------------------------
// Built timeline (consumed by the Remotion composition)
// ---------------------------------------------------------------------------

export interface WordTiming {
  word: string;
  start: number;
  end: number;
}

export interface WordRect {
  text: string;
  /** index of the wrapped line */
  line: number;
  x: number;
  y: number;
  w: number;
  /** seconds (scene-local) when this word starts writing */
  writeStart: number;
  /** seconds this word takes to write */
  writeDuration: number;
  emphasis: boolean;
}

export interface LaidOutText {
  x: number;
  y: number;
  width: number;
  lines: string[];
  fontSize: number;
  font: FontKind;
  align: 'left' | 'center';
  color: InkColor;
  wordRects: WordRect[];
}

export interface BBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ElementTimeline {
  spec: ElementSpec;
  /** seconds, scene-local */
  start: number;
  /** seconds to complete the whole element */
  drawDuration: number;
  /** laid-out text (text / bullet / callout / tick / heading-ish elements) */
  text?: LaidOutText;
  /** bounding box (arrows, highlights target, illustrations display box) */
  bbox?: BBox;
  illustration?: {
    sampled: SampledIllustration;
    x: number;
    y: number;
    scale: number;
  };
  equation?: {
    terms: Array<
      EquationTerm & {
        x: number;
        w: number;
        start: number;
        duration: number;
        /** Precomputed arrow geometry for `arrow` terms (board coordinates). */
        strokes?: SampledIllustration;
      }
    >;
    y: number;
    fontSize: number;
  };
}

export interface SceneTimeline {
  id: string;
  layout: SceneLayout;
  heading?: LaidOutText;
  sub?: LaidOutText;
  /** absolute seconds in the video */
  start: number;
  /** scene-local duration in seconds (incl. lead-in + tail) */
  duration: number;
  leadIn: number;
  audioFile: string;
  narration: string;
  /** word timings, scene-local seconds */
  words: WordTiming[];
  elements: ElementTimeline[];
  /** deterministic camera motion params */
  camera: { zoomStart: number; zoomEnd: number; panX: number; panY: number };
}

export interface ResolvedTheme {
  board: string;
  boardEdge: string;
  ink: string;
  inkSoft: string;
  accent: string;
  accent2: string;
  highlight: string;
}

export interface Timeline {
  fps: number;
  width: number;
  height: number;
  title: string;
  subject: Subject;
  theme: ResolvedTheme;
  scenes: SceneTimeline[];
  totalDuration: number;
}
