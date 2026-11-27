/**
 * Deterministic visual composition for Stickman 2 Image Presenter.
 *
 * This module is renderer-agnostic: it turns validated scene intent into
 * normalized frame geometry, image crops, presenter anchors and annotation
 * positions. It does not mutate the legacy Stickman timeline or renderer.
 */
import type {
  DiagramExplanationScene,
  ImagePresenterAspectRatio,
  ImagePresenterScene,
  MultiImageSequenceScene,
  PresenterPosition,
  PresenterCue,
} from './types';

export interface NormalizedRect { x: number; y: number; width: number; height: number }
export interface PixelRect extends NormalizedRect {}
export interface ImagePlacement {
  id: string;
  assetId: string;
  source: 'main' | 'left' | 'right' | 'sequence';
  frame: PixelRect;
  fit: 'contain' | 'cover';
  label?: string;
  order?: number;
}
export interface PresenterPlacement {
  characterId: string;
  position: PresenterPosition;
  /** Presenter anchor in normalized frame coordinates. */
  anchor: { x: number; y: number };
  /** Optional normalized image point to point/present toward. */
  target?: { x: number; y: number };
  gesture: PresenterCue['gesture'];
  /** Maximum normalized footprint reserved for the presenter. */
  bounds: NormalizedRect;
}
export interface AnnotationPlacement {
  id: string;
  label: string;
  /** Original image-space normalized rectangle, mapped into the placed image. */
  imageRegion: NormalizedRect;
  frameRegion: NormalizedRect;
  narration?: string;
}
export interface ImagePresenterCompositionPlan {
  width: number;
  height: number;
  aspectRatio: ImagePresenterAspectRatio;
  background: string;
  layout: 'hero-portrait' | 'hero-landscape' | 'hero-square' | 'comparison-stacked' |
    'comparison-columns' | 'sequence-vertical' | 'sequence-horizontal' | 'diagram-focus';
  images: ImagePlacement[];
  presenter: PresenterPlacement;
  annotations: AnnotationPlacement[];
  camera?: { from: number; to: number; focalX: number; focalY: number };
  warnings: string[];
}

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const rect = (x: number, y: number, width: number, height: number): NormalizedRect => ({
  x: clamp(x, 0, 1), y: clamp(y, 0, 1),
  width: clamp(width, 0, 1), height: clamp(height, 0, 1),
});
const imagePlacement = (
  id: string, assetId: string, frame: NormalizedRect,
  source: ImagePlacement['source'], label?: string, order?: number,
): ImagePlacement => ({ id, assetId, frame, source, fit: 'contain', label, order });

function canvas(aspect: ImagePresenterAspectRatio): { width: number; height: number } {
  if (aspect === '9:16') return { width: 720, height: 1280 };
  if (aspect === '1:1') return { width: 1080, height: 1080 };
  return { width: 1280, height: 720 };
}
function presenterPosition(cue: PresenterCue, bounds: NormalizedRect): PresenterPlacement {
  const anchors: Record<PresenterPosition, { x: number; y: number }> = {
    'bottom-center': { x: 0.5, y: 0.94 },
    'bottom-left': { x: 0.16, y: 0.94 },
    'bottom-right': { x: 0.84, y: 0.94 },
    left: { x: 0.12, y: 0.55 },
    right: { x: 0.88, y: 0.55 },
  };
  return {
    characterId: cue.characterId, position: cue.position,
    anchor: anchors[cue.position], gesture: cue.gesture, bounds,
    ...(cue.target ? { target: { x: clamp(cue.target.x, 0, 1), y: clamp(cue.target.y, 0, 1) } } : {}),
  };
}
function targetFor(cue: PresenterCue, image: NormalizedRect): PresenterPlacement['target'] {
  if (cue.target) return { x: clamp(cue.target.x, 0, 1), y: clamp(cue.target.y, 0, 1) };
  if (cue.gesture === 'point-left') return { x: image.x + image.width * 0.2, y: image.y + image.height * 0.5 };
  if (cue.gesture === 'point-right') return { x: image.x + image.width * 0.8, y: image.y + image.height * 0.5 };
  if (cue.gesture === 'point-up') return { x: image.x + image.width * 0.5, y: image.y + image.height * 0.2 };
  if (cue.gesture === 'point-down') return { x: image.x + image.width * 0.5, y: image.y + image.height * 0.8 };
  return undefined;
}
function diagramAnnotations(scene: DiagramExplanationScene, image: NormalizedRect): AnnotationPlacement[] {
  return scene.annotations.map((a) => ({
    id: a.id, label: a.label, imageRegion: a.region,
    frameRegion: rect(
      image.x + a.region.x * image.width,
      image.y + a.region.y * image.height,
      a.region.width * image.width,
      a.region.height * image.height,
    ),
    ...(a.narration ? { narration: a.narration } : {}),
  }));
}
function zoomFor(scene: ImagePresenterScene): ImagePresenterCompositionPlan['camera'] {
  if (scene.type !== 'single-image' || !scene.zoom) return undefined;
  return {
    from: clamp(scene.zoom.from, 1, 2.5), to: clamp(scene.zoom.to, 1, 2.5),
    focalX: clamp(scene.zoom.focalX ?? 0.5, 0, 1),
    focalY: clamp(scene.zoom.focalY ?? 0.5, 0, 1),
  };
}

/** Build layout geometry in normalized coordinates for any supported canvas. */
export function composeImagePresenterScene(
  scene: ImagePresenterScene,
  aspectRatio: ImagePresenterAspectRatio,
): ImagePresenterCompositionPlan {
  const { width, height } = canvas(aspectRatio);
  const warnings: string[] = [];
  const images: ImagePlacement[] = [];
  let layout: ImagePresenterCompositionPlan['layout'];
  let presenterBounds = rect(0.72, 0.55, 0.24, 0.4);
  let primaryImage: NormalizedRect = rect(0.08, 0.06, 0.84, 0.68);
  let annotations: AnnotationPlacement[] = [];

  if (scene.type === 'two-image-comparison') {
    if (aspectRatio === '9:16') {
      layout = 'comparison-stacked';
      const left = rect(0.06, 0.07, 0.88, 0.35);
      const right = rect(0.06, 0.47, 0.88, 0.35);
      images.push(imagePlacement(scene.id + '-left', scene.left.image.id, left, 'left', scene.left.label));
      images.push(imagePlacement(scene.id + '-right', scene.right.image.id, right, 'right', scene.right.label));
      primaryImage = left;
      presenterBounds = rect(0.72, 0.83, 0.24, 0.15);
    } else {
      layout = 'comparison-columns';
      const left = rect(0.04, 0.09, 0.43, 0.72);
      const right = rect(0.53, 0.09, 0.43, 0.72);
      images.push(imagePlacement(scene.id + '-left', scene.left.image.id, left, 'left', scene.left.label));
      images.push(imagePlacement(scene.id + '-right', scene.right.image.id, right, 'right', scene.right.label));
      primaryImage = scene.activeSide === 'right' ? right : left;
      presenterBounds = rect(0.42, 0.78, 0.16, 0.2);
    }
  } else if (scene.type === 'multi-image-sequence') {
    const sequence = scene.items;
    if (aspectRatio === '9:16') {
      layout = 'sequence-vertical';
      const gap = 0.025, top = 0.06, available = 0.78;
      const cardH = Math.min(0.22, (available - gap * Math.max(0, sequence.length - 1)) / Math.max(1, sequence.length));
      sequence.forEach((item, index) => {
        const y = top + index * (cardH + gap);
        images.push(imagePlacement(item.id, item.image.id, rect(0.1, y, 0.8, cardH), 'sequence', item.caption?.text || String(index + 1), index));
      });
      primaryImage = images[0]?.frame ?? primaryImage;
      presenterBounds = rect(0.72, 0.85, 0.24, 0.13);
    } else {
      layout = 'sequence-horizontal';
      const gap = 0.025, left = 0.04, available = 0.92;
      const cardW = Math.min(0.28, (available - gap * Math.max(0, sequence.length - 1)) / Math.max(1, sequence.length));
      sequence.forEach((item, index) => {
        const x = left + index * (cardW + gap);
        images.push(imagePlacement(item.id, item.image.id, rect(x, 0.12, cardW, 0.66), 'sequence', item.caption?.text || String(index + 1), index));
      });
      primaryImage = images[0]?.frame ?? primaryImage;
      presenterBounds = rect(0.42, 0.79, 0.16, 0.19);
    }
    if (sequence.length > 8) warnings.push('Only the first eight sequence cards fit the composition grid; split longer sequences into multiple scenes.');
  } else if (scene.type === 'diagram-explanation') {
    layout = 'diagram-focus';
    if (aspectRatio === '9:16') {
      primaryImage = rect(0.05, 0.06, 0.9, 0.72);
      presenterBounds = rect(0.73, 0.81, 0.22, 0.17);
    } else {
      primaryImage = rect(0.05, 0.07, 0.7, 0.84);
      presenterBounds = rect(0.78, 0.58, 0.18, 0.32);
    }
    images.push(imagePlacement(scene.id + '-diagram', scene.image.id, primaryImage, 'main'));
    annotations = diagramAnnotations(scene, primaryImage);
  } else {
    if (aspectRatio === '9:16') {
      layout = 'hero-portrait';
      primaryImage = rect(0.06, 0.05, 0.88, 0.69);
      presenterBounds = rect(0.72, 0.76, 0.24, 0.21);
    } else if (aspectRatio === '16:9') {
      layout = 'hero-landscape';
      primaryImage = rect(0.04, 0.07, 0.67, 0.84);
      presenterBounds = rect(0.75, 0.55, 0.2, 0.36);
    } else {
      layout = 'hero-square';
      primaryImage = rect(0.07, 0.05, 0.86, 0.72);
      presenterBounds = rect(0.72, 0.77, 0.22, 0.2);
    }
    images.push(imagePlacement(scene.id + '-main', scene.image.id, primaryImage, 'main'));
  }

  const presenter = presenterPosition(scene.presenter, presenterBounds);
  presenter.target = targetFor(scene.presenter, primaryImage);
  return {
    width, height, aspectRatio, background: '#f4f7fa', layout, images,
    presenter, annotations, camera: zoomFor(scene), warnings,
  };
}

/** Compose all ordered cards in a sequence scene as a single deterministic layout. */
export function composeImagePresenterSequence(
  scene: MultiImageSequenceScene,
  aspectRatio: ImagePresenterAspectRatio,
): ImagePresenterCompositionPlan {
  return composeImagePresenterScene(scene, aspectRatio);
}
