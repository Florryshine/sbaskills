import {
  IMAGE_PRESENTER_VERSION,
  type ImagePresenterProject,
  type ImagePresenterScene,
  type ImagePresenterValidationIssue,
  type ImagePresenterValidationResult,
  type PresenterImageAsset,
} from './types';

const MODES = new Set([
  'single-image',
  'two-image-comparison',
  'multi-image-sequence',
  'diagram-explanation',
]);
const ASPECT_RATIOS = new Set(['9:16', '16:9', '1:1']);
const GESTURES = new Set([
  'point-left', 'point-right', 'point-up', 'point-down',
  'explain', 'think', 'surprised', 'neutral',
]);

function isNonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function collectSceneImages(scene: ImagePresenterScene): PresenterImageAsset[] {
  switch (scene.type) {
    case 'single-image':
    case 'diagram-explanation':
      return [scene.image];
    case 'two-image-comparison':
      return [scene.left.image, scene.right.image];
    case 'multi-image-sequence':
      return scene.items.map((item) => item.image);
  }
}

/**
 * Pure, deterministic validation. Comparison scenes must use two distinct
 * assets (both IDs and canonical media URLs are checked), preventing the
 * accidental reuse of one fetched image for two different concepts.
 */
export function validateImagePresenterProject(
  input: unknown,
): ImagePresenterValidationResult {
  const issues: ImagePresenterValidationIssue[] = [];
  const add = (path: string, code: ImagePresenterValidationIssue['code'], message: string) =>
    issues.push({ path, code, message });

  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { valid: false, issues: [{ path: '$', code: 'required', message: 'Project must be an object.' }] };
  }

  const project = input as Partial<ImagePresenterProject>;
  if (project.version !== IMAGE_PRESENTER_VERSION) add('version', 'invalid-value', 'Unsupported Image Presenter project version.');
  if (!isNonEmpty(project.id)) add('id', 'required', 'Project id is required.');
  if (!isNonEmpty(project.title)) add('title', 'required', 'Project title is required.');
  if (!isNonEmpty(project.subject)) add('subject', 'required', 'Project subject is required.');
  if (!isNonEmpty(project.presenterId)) add('presenterId', 'required', 'A presenter character must be selected.');
  if (!ASPECT_RATIOS.has(String(project.aspectRatio))) add('aspectRatio', 'invalid-value', 'Aspect ratio must be 9:16, 16:9 or 1:1.');
  if (!MODES.has(String(project.mode))) add('mode', 'invalid-value', 'Unknown Image Presenter production mode.');
  if (!Array.isArray(project.scenes) || project.scenes.length === 0) {
    add('scenes', 'required', 'At least one scene is required.');
    return { valid: false, issues };
  }

  project.scenes.forEach((rawScene, index) => {
    const path = `scenes[${index}]`;
    if (!rawScene || typeof rawScene !== 'object') {
      add(path, 'invalid-value', 'Scene must be an object.');
      return;
    }
    const scene = rawScene as ImagePresenterScene;
    if (!isNonEmpty(scene.id)) add(`${path}.id`, 'required', 'Scene id is required.');
    if (!isNonEmpty(scene.title)) add(`${path}.title`, 'required', 'Scene title is required.');
    if (!isNonEmpty(scene.narration)) add(`${path}.narration`, 'required', 'Scene narration is required.');
    if (!scene.presenter || !isNonEmpty(scene.presenter.characterId)) {
      add(`${path}.presenter.characterId`, 'required', 'Presenter character id is required.');
    } else if (!GESTURES.has(scene.presenter.gesture)) {
      add(`${path}.presenter.gesture`, 'invalid-value', 'Unsupported presenter gesture.');
    }

    if (scene.caption?.highlight && !scene.caption.text.includes(scene.caption.highlight)) {
      add(`${path}.caption.highlight`, 'invalid-highlight', 'Caption highlight must be part of the caption text.');
    }

    if (scene.type === 'two-image-comparison') {
      if (!isNonEmpty(scene.left?.label)) add(`${path}.left.label`, 'required', 'Left comparison label is required.');
      if (!isNonEmpty(scene.right?.label)) add(`${path}.right.label`, 'required', 'Right comparison label is required.');
      const left = scene.left?.image;
      const right = scene.right?.image;
      if (!left || !right) add(path, 'required', 'Comparison requires an independent image for each side.');
      else if (left.id === right.id || canonicalUrl(left.mediaUrl) === canonicalUrl(right.mediaUrl)) {
        add(path, 'duplicate-image', 'Comparison sides must use two different image assets.');
      }
    }

    if (scene.type === 'multi-image-sequence' && (!Array.isArray(scene.items) || scene.items.length === 0)) {
      add(`${path}.items`, 'empty-sequence', 'A multi-image scene must contain at least one image item.');
    }

    if (scene.type === 'diagram-explanation') {
      (scene.annotations ?? []).forEach((annotation, annotationIndex) => {
        const r = annotation.region;
        if (!r || [r.x, r.y, r.width, r.height].some((n) => !Number.isFinite(n)) ||
          r.x < 0 || r.y < 0 || r.width <= 0 || r.height <= 0 ||
          r.x + r.width > 1 || r.y + r.height > 1) {
          add(`${path}.annotations[${annotationIndex}].region`, 'invalid-region', 'Diagram regions must be positive normalized rectangles within the image.');
        }
      });
    }

    collectSceneImages(scene).forEach((asset, assetIndex) => {
      const assetPath = `${path}.images[${assetIndex}]`;
      if (!asset || !isNonEmpty(asset.id) || !isNonEmpty(asset.subject) || !isNonEmpty(asset.mediaUrl)) {
        add(assetPath, 'required', 'Every image requires an id, subject and media URL.');
        return;
      }
      try {
        const url = new URL(asset.mediaUrl);
        if (url.protocol !== 'https:' && url.protocol !== 'http:') {
          add(`${assetPath}.mediaUrl`, 'invalid-url', 'Image URL must use HTTP or HTTPS.');
        }
      } catch {
        add(`${assetPath}.mediaUrl`, 'invalid-url', 'Image URL must be an absolute URL.');
      }
    });
  });

  return { valid: issues.length === 0, issues };
}

function canonicalUrl(value: string | undefined): string {
  if (!value) return '';
  try {
    const url = new URL(value);
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return value.trim();
  }
}
