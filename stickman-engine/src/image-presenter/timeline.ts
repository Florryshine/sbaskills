/**
 * Phase 5: convert Image Presenter scenes into the existing Stickman timeline
 * plus synchronized visual events. The legacy compiler remains the single
 * source of truth for frame allocation, captions, audio offsets and character
 * motion; this adapter adds image/annotation events alongside that timeline.
 */
import type { SceneAction, SceneScript, Timeline } from '../rig/character';
import { compile, type NarrationMap } from '../scene/compiler';
import type {
  ImagePresenterProject, ImagePresenterScene, PresenterGesture,
  MultiImageSequenceScene, DiagramExplanationScene,
} from './types';
import { composeImagePresenterScene, type ImagePresenterCompositionPlan } from './layout';

export interface ImagePresenterNarrationMap extends NarrationMap {}
export interface ImagePresenterImageEvent {
  frameStart: number;
  frameEnd: number;
  sceneId: string;
  itemId: string;
  assetId: string;
  localFile?: string;
  mediaUrl: string;
  sourceUrl?: string;
  attribution?: string;
  license?: string;
  label?: string;
  order: number;
  region: { x: number; y: number; width: number; height: number };
  fit: 'contain' | 'cover';
}
export interface ImagePresenterAnnotationEvent {
  frameStart: number;
  frameEnd: number;
  sceneId: string;
  annotationId: string;
  label: string;
  narration?: string;
  region: { x: number; y: number; width: number; height: number };
}
export interface ImagePresenterCueEvent {
  frame: number;
  frameEnd: number;
  sceneId: string;
  characterId: string;
  gesture: PresenterGesture;
  target?: { x: number; y: number };
  imageId?: string;
}
export interface ImagePresenterSceneTiming {
  sceneId: string;
  index: number;
  frameStart: number;
  frameEnd: number;
  durationFrames: number;
  composition: ImagePresenterCompositionPlan;
}
export interface CompiledImagePresenterTimeline {
  timeline: Timeline;
  sceneTimings: ImagePresenterSceneTiming[];
  imageEvents: ImagePresenterImageEvent[];
  annotationEvents: ImagePresenterAnnotationEvent[];
  presenterEvents: ImagePresenterCueEvent[];
  warnings: string[];
}

type AcquiredAsset = { localFile?: string; contentHash?: string };
export type ImagePresenterAssetMap = Record<string, AcquiredAsset>;

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const seconds = (n: number | undefined, fallback: number) =>
  Number.isFinite(n) && (n as number) > 0 ? n as number : fallback;
const gestureAction = (gesture: PresenterGesture, at: [number, number]): SceneAction['do'] | null => {
  if (gesture.startsWith('point-')) return 'point';
  if (gesture === 'explain') return 'present';
  if (gesture === 'surprised') return 'reactSurprise';
  if (gesture === 'think') return 'face';
  return null;
};
function worldPoint(target: { x: number; y: number } | undefined, width: number, height: number): [number, number] {
  const x = target?.x ?? 0.5, y = target?.y ?? 0.5;
  // Camera-space world coordinates centered horizontally. The existing
  // compiler camera keeps the ground near 70% frame height.
  return [(x - 0.5) * width, (0.7 - y) * height];
}
function presenterX(position: ImagePresenterScene['presenter']['position'], width: number): number {
  if (position === 'left' || position === 'bottom-left') return -width * 0.34;
  if (position === 'right' || position === 'bottom-right') return width * 0.34;
  return 0;
}
function sceneBeats(scene: ImagePresenterScene): Array<{
  id: string; text: string; duration: number; imageId?: string; label?: string;
  gesture: PresenterGesture; target?: { x: number; y: number };
}> {
  if (scene.type === 'multi-image-sequence') {
    const seq = scene as MultiImageSequenceScene;
    return seq.items.map((item, i) => ({
      id: item.id, text: item.narration, duration: seconds(item.durationSeconds, 2.8),
      imageId: item.image.id, label: item.caption?.text,
      gesture: item.presenter?.gesture ?? (i % 2 ? 'point-left' : 'point-right'),
      target: item.presenter?.target,
    }));
  }
  if (scene.type === 'diagram-explanation') {
    const diagram = scene as DiagramExplanationScene;
    const beats = [{ id: scene.id + '-intro', text: scene.narration, duration: seconds(scene.durationSeconds, 3.2),
      imageId: diagram.image.id, label: scene.caption?.text, gesture: scene.presenter.gesture, target: scene.presenter.target }];
    diagram.annotations.forEach((a) => {
      if (a.narration?.trim()) beats.push({
        id: a.id, text: a.narration, duration: Math.max(1.8, Math.min(5, a.narration.length * 0.055)),
        imageId: diagram.image.id, label: a.label, gesture: 'point-up' as PresenterGesture,
        target: { x: a.region.x + a.region.width / 2, y: a.region.y + a.region.height / 2 },
      });
    });
    return beats;
  }
  const extras = scene.type === 'two-image-comparison'
    ? [scene.left.explanation, scene.right.explanation].filter((v): v is string => !!v?.trim())
    : [];
  return [
    { id: scene.id, text: scene.narration, duration: seconds(scene.durationSeconds, 3.6),
      imageId: scene.type === 'single-image' ? scene.image.id : scene.left.image.id,
      label: scene.caption?.text, gesture: scene.presenter.gesture, target: scene.presenter.target },
    ...extras.map((text, i) => ({
      id: scene.id + (i === 0 ? '-left' : '-right'), text,
      duration: Math.max(1.8, Math.min(5, text.length * 0.055)),
      imageId: scene.type === 'two-image-comparison' ? (i === 0 ? scene.left.image.id : scene.right.image.id) : undefined,
      label: scene.type === 'two-image-comparison' ? (i === 0 ? scene.left.label : scene.right.label) : undefined,
      gesture: (i === 0 ? 'point-left' : 'point-right') as PresenterGesture,
    })),
  ];
}

/**
 * Compile a project into the established character/audio/caption timeline and
 * frame-accurate image/annotation/cue tracks. narration keys use "sceneIndex:lineIndex".
 */
export function compileImagePresenterTimeline(
  project: ImagePresenterProject,
  narration: ImagePresenterNarrationMap = {},
  assets: ImagePresenterAssetMap = {},
): CompiledImagePresenterTimeline {
  if (!project.scenes.length) throw new Error('Image Presenter project must contain at least one scene.');
  const fps = project.fps && project.fps >= 12 && project.fps <= 60 ? project.fps : 30;
  const width = project.aspectRatio === '9:16' ? 720 : project.aspectRatio === '1:1' ? 1080 : 1280;
  const height = project.aspectRatio === '9:16' ? 1280 : project.aspectRatio === '1:1' ? 1080 : 720;
  const warnings: string[] = [];
  const scriptScenes: SceneScript['scenes'] = [];
  const beatLists = project.scenes.map(sceneBeats);
  const resolvedBeatLists = beatLists.map((beats, sceneIndex) => beats.map((beat, lineIndex) => ({
    ...beat,
    duration: seconds(narration[`${sceneIndex}:${lineIndex}`]?.dur, beat.duration),
  })));

  project.scenes.forEach((scene, sceneIndex) => {
    const beats = resolvedBeatLists[sceneIndex];
    const dialogue = beats.map((beat, lineIndex) => ({
      who: 'narr', text: beat.text, duration: beat.duration,
      t0: beats.slice(0, lineIndex).reduce((sum, b) => sum + b.duration + 0.16, 0) + 0.25,
    }));
    const actions: SceneAction[] = [];
    beats.forEach((beat, lineIndex) => {
      const start = dialogue[lineIndex].t0 ?? 0;
      const cue = lineIndex === 0 ? scene.presenter : {
        characterId: scene.presenter.characterId,
        gesture: beat.gesture,
        position: scene.presenter.position,
        ...(beat.target ? { target: beat.target } : {}),
      };
      const doAction = gestureAction(cue.gesture, [0, 0]);
      if (!doAction) return;
      if (doAction === 'point' || doAction === 'present') {
        const target = worldPoint(beat.target ?? cue.target, width, height);
        actions.push({ char: project.presenterId, do: doAction, at: target, t0: start + 0.12, dur: Math.min(1.8, beat.duration * 0.7) });
      } else if (doAction === 'reactSurprise') {
        actions.push({ char: project.presenterId, do: 'reactSurprise', t0: start + 0.12 });
      } else if (doAction === 'face') {
        actions.push({ char: project.presenterId, do: 'expression', emotion: 'focused', t0: start + 0.12, dur: beat.duration * 0.7 });
      }
    });
    const x = presenterX(scene.presenter.position, width);
    scriptScenes.push({
      id: scene.id, duration: Math.max(4.2, dialogue.reduce((sum, line) => sum + (line.duration ?? 0) + 0.6, 0) + 0.8),
      dialogue, actions,
      cast: { [project.presenterId]: { x, facing: x < 0 ? 1 : -1 } },
      camera: [{ do: 'establish', at: 0, scale: project.aspectRatio === '9:16' ? 1.75 : 1.2, dur: 0.3 }],
      ...(scene.transitionIn === 'fade' ? { enter: { type: 'wipe' as const, dur: 0.35 } } : {}),
    });
  });

  const script: SceneScript = {
    title: project.title, fps, width, height,
    environment: { type: 'abstract', seed: 17, accent: '#2285b7' },
    cast: { [project.presenterId]: { style: 'prof' } },
    scenes: scriptScenes,
  };
  const timeline = compile(script, narration);
  const sceneTimings: ImagePresenterSceneTiming[] = [];
  const imageEvents: ImagePresenterImageEvent[] = [];
  const annotationEvents: ImagePresenterAnnotationEvent[] = [];
  const presenterEvents: ImagePresenterCueEvent[] = [];

  project.scenes.forEach((scene, sceneIndex) => {
    const composition = composeImagePresenterScene(scene, project.aspectRatio);
    const beats = resolvedBeatLists[sceneIndex];
    const compiledSpan = timeline.sceneSpans.find(span => span.id === scene.id);
    const frameStart = compiledSpan?.start ?? 0;
    const frameEnd = compiledSpan?.end ?? frameStart;
    sceneTimings.push({ sceneId: scene.id, index: sceneIndex, frameStart, frameEnd,
      durationFrames: frameEnd - frameStart, composition });
    composition.warnings.forEach(w => warnings.push(`${scene.id}: ${w}`));

    composition.images.forEach((placement) => {
      const asset = findAsset(scene, placement.assetId);
      const local = assets[placement.assetId]?.localFile;
      imageEvents.push({
        frameStart, frameEnd, sceneId: scene.id, itemId: placement.id,
        assetId: placement.assetId, ...(local ? { localFile: local } : {}),
        mediaUrl: asset?.mediaUrl ?? '', ...(asset?.sourceUrl ? { sourceUrl: asset.sourceUrl } : {}),
        ...(asset?.attribution ? { attribution: asset.attribution } : {}),
        ...(asset?.license ? { license: asset.license } : {}),
        ...(placement.label ? { label: placement.label } : {}),
        order: placement.order ?? 0, region: placement.frame, fit: placement.fit,
      });
      if (!local) warnings.push(`${scene.id}: asset "${placement.assetId}" has no acquired local file; rendering must resolve it before export.`);
    });
    composition.annotations.forEach((annotation) => {
      const beatIndex = beats.findIndex(b => b.id === annotation.id);
      const beatStart = beatIndex >= 0
        ? frameStart + Math.round((0.25 + beats.slice(0, beatIndex).reduce((s, b) => s + b.duration + 0.16, 0)) * fps)
        : frameStart;
      const beatEnd = beatIndex >= 0
        ? Math.min(frameEnd, beatStart + Math.round(beats[beatIndex].duration * fps))
        : frameEnd;
      annotationEvents.push({
        frameStart: beatStart, frameEnd: beatEnd, sceneId: scene.id,
        annotationId: annotation.id, label: annotation.label,
        ...(annotation.narration ? { narration: annotation.narration } : {}),
        region: annotation.frameRegion,
      });
    });
    beats.forEach((beat, beatIndex) => {
      const startSeconds = 0.25 + beats.slice(0, beatIndex).reduce((s, b) => s + b.duration + 0.16, 0);
      const cueStart = frameStart + Math.round(startSeconds * fps);
      const cueEnd = Math.min(frameEnd, cueStart + Math.round(beat.duration * fps));
      const cue = beatIndex === 0 ? scene.presenter : {
        characterId: scene.presenter.characterId, gesture: beat.gesture,
        position: scene.presenter.position, ...(beat.target ? { target: beat.target } : {}),
      };
      const target = beat.target ?? cue.target;
      presenterEvents.push({
        frame: cueStart, frameEnd: cueEnd, sceneId: scene.id,
        characterId: project.presenterId, gesture: cue.gesture,
        ...(target ? { target } : {}),
        ...(beat.imageId ? { imageId: beat.imageId } : {}),
      });
    });
  });
  return { timeline, sceneTimings, imageEvents, annotationEvents, presenterEvents, warnings };
}

function findAsset(scene: ImagePresenterScene, id: string) {
  if (scene.type === 'single-image' || scene.type === 'diagram-explanation') return scene.image.id === id ? scene.image : undefined;
  if (scene.type === 'two-image-comparison') {
    return [scene.left.image, scene.right.image].find(a => a.id === id);
  }
  return scene.items.find(item => item.image.id === id)?.image;
}
