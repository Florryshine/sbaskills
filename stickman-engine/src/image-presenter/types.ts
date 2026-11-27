/**
 * Stickman 2 — Image Presenter domain contracts.
 *
 * This module is deliberately additive: it does not alter SceneScript, Timeline,
 * the original Stickman renderer, or the Visual Learning Engine contracts.
 * Phase 1 establishes the stable boundary that later phases will implement.
 */

export const IMAGE_PRESENTER_VERSION = 1 as const;

export type ImagePresenterMode =
  | 'single-image'
  | 'two-image-comparison'
  | 'multi-image-sequence'
  | 'diagram-explanation';

export type ImagePresenterAspectRatio = '9:16' | '16:9' | '1:1';

export type PresenterGesture =
  | 'point-left'
  | 'point-right'
  | 'point-up'
  | 'point-down'
  | 'explain'
  | 'think'
  | 'surprised'
  | 'neutral';

export type PresenterPosition =
  | 'bottom-center'
  | 'bottom-left'
  | 'bottom-right'
  | 'left'
  | 'right';

export type ImagePresenterTransition = 'cut' | 'fade' | 'slide' | 'zoom';

export type ImageProvider =
  | 'wikimedia'
  | 'openverse'
  | 'pexels'
  | 'pixabay'
  | 'pollinations'
  | 'uploaded'
  | 'bundled'
  | 'placeholder'
  | 'unknown';

/**
 * Provenance is retained from retrieval through rendering so the studio can
 * show attribution and operators can audit where educational imagery came from.
 */
export interface PresenterImageAsset {
  id: string;
  subject: string;
  title: string;
  alt: string;
  mediaUrl: string;
  sourceUrl?: string;
  provider: ImageProvider;
  mimeType?: string;
  width?: number;
  height?: number;
  license?: string;
  attribution?: string;
  attributionRequired?: boolean;
  licenseVerified?: boolean;
  contentHash?: string;
}

export interface PresenterCaption {
  text: string;
  /** Optional phrase to visually emphasise; it must occur in text. */
  highlight?: string;
  style?: 'standard' | 'comparison' | 'label';
}

export interface PresenterCue {
  characterId: string;
  gesture: PresenterGesture;
  position: PresenterPosition;
  /** Optional target in normalized 0..1 frame coordinates. */
  target?: { x: number; y: number };
}

export interface ImagePresenterSceneBase {
  id: string;
  title: string;
  narration: string;
  caption?: PresenterCaption;
  presenter: PresenterCue;
  durationSeconds?: number;
  transitionIn?: ImagePresenterTransition;
}

export interface SingleImageScene extends ImagePresenterSceneBase {
  type: 'single-image';
  image: PresenterImageAsset;
  zoom?: { from: number; to: number; focalX?: number; focalY?: number };
}

export interface ComparisonSide {
  label: string;
  image: PresenterImageAsset;
  explanation?: string;
}

export interface TwoImageComparisonScene extends ImagePresenterSceneBase {
  type: 'two-image-comparison';
  left: ComparisonSide;
  right: ComparisonSide;
  differences?: Array<{
    feature: string;
    leftValue: string;
    rightValue: string;
  }>;
  activeSide?: 'left' | 'right' | 'both';
}

export interface MultiImageSequenceScene extends ImagePresenterSceneBase {
  type: 'multi-image-sequence';
  items: Array<{
    id: string;
    narration: string;
    caption?: PresenterCaption;
    image: PresenterImageAsset;
    presenter?: Partial<PresenterCue>;
    durationSeconds?: number;
  }>;
}

export interface DiagramAnnotation {
  id: string;
  label: string;
  /** Normalized rectangle in the source image coordinate space (0..1). */
  region: { x: number; y: number; width: number; height: number };
  narration?: string;
}

export interface DiagramExplanationScene extends ImagePresenterSceneBase {
  type: 'diagram-explanation';
  image: PresenterImageAsset;
  annotations: DiagramAnnotation[];
}

export type ImagePresenterScene =
  | SingleImageScene
  | TwoImageComparisonScene
  | MultiImageSequenceScene
  | DiagramExplanationScene;

export interface ImagePresenterProject {
  version: typeof IMAGE_PRESENTER_VERSION;
  id: string;
  title: string;
  subject: string;
  aspectRatio: ImagePresenterAspectRatio;
  fps?: number;
  mode: ImagePresenterMode;
  presenterId: string;
  scenes: ImagePresenterScene[];
}

export interface ImagePresenterValidationIssue {
  path: string;
  code:
    | 'required'
    | 'invalid-value'
    | 'invalid-url'
    | 'duplicate-image'
    | 'invalid-region'
    | 'invalid-highlight'
    | 'empty-sequence';
  message: string;
}

export interface ImagePresenterValidationResult {
  valid: boolean;
  issues: ImagePresenterValidationIssue[];
}
