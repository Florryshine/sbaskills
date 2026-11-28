import path from 'node:path';
import fs from 'node:fs/promises';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { compileImagePresenterTimeline } from './timeline';
import type { ImagePresenterProject, PresenterImageAsset } from './types';

const engineRoot = path.resolve(__dirname, '..', '..');
const publicDir = path.join(engineRoot, 'public');
const entryPoint = path.join(engineRoot, 'src', 'render', 'index.tsx');
const outDir = path.join(engineRoot, 'out');
const makeImage = (id: string, subject: string): PresenterImageAsset => ({ id, subject, title: subject, alt: subject, mediaUrl: 'https://example.invalid/' + id + '.svg', provider: 'bundled', mimeType: 'image/svg+xml', license: 'SBA original smoke-test fixture', attribution: 'Shiney Brain Academy' });
const presenter = { characterId: 'prof', gesture: 'point-right' as const, position: 'bottom-right' as const, target: { x: 0.65, y: 0.45 } };
const base = { version: 1 as const, id: 'smoke', title: 'Image Presenter smoke test', subject: 'science', aspectRatio: '9:16' as const, presenterId: 'prof', fps: 30 };
const image = makeImage('fixture-main', 'Main educational image');
const projects: ImagePresenterProject[] = [
  { ...base, mode: 'single-image', scenes: [{ id: 'single', type: 'single-image', title: 'Single image', narration: 'This is the main image.', image, presenter }] },
  { ...base, mode: 'two-image-comparison', scenes: [{ id: 'compare', type: 'two-image-comparison', title: 'Comparison', narration: 'Compare these examples.', left: { label: 'Left', image: makeImage('fixture-left', 'Left example') }, right: { label: 'Right', image: makeImage('fixture-right', 'Right example') }, presenter }] },
  { ...base, mode: 'multi-image-sequence', scenes: [{ id: 'sequence', type: 'multi-image-sequence', title: 'Sequence', narration: 'Follow these steps.', items: [1, 2, 3].map(n => ({ id: 'step-' + n, narration: 'Step ' + n + ' in the process.', image: makeImage('fixture-step-' + n, 'Step ' + n), durationSeconds: 2.8 })), presenter }] },
  { ...base, mode: 'diagram-explanation', scenes: [{ id: 'diagram', type: 'diagram-explanation', title: 'Diagram', narration: 'This diagram shows the main parts.', image, annotations: [{ id: 'label-one', label: 'Important structure', region: { x: 0.3, y: 0.3, width: 0.25, height: 0.2 }, narration: 'This is the important structure.' }], presenter }] },
];

await fs.mkdir(outDir, { recursive: true });
console.log('[image-presenter-smoke] bundling Remotion composition');
const serveUrl = await bundle({ entryPoint, publicDir });
for (const project of projects) {
  const compiled = compileImagePresenterTimeline(project, {}, Object.fromEntries(project.scenes.flatMap(scene => {
    if (scene.type === 'single-image' || scene.type === 'diagram-explanation') return [[scene.image.id, { localFile: 'image-presenter-smoke.svg' }]];
    if (scene.type === 'two-image-comparison') return [[scene.left.image.id, { localFile: 'image-presenter-smoke.svg' }], [scene.right.image.id, { localFile: 'image-presenter-smoke.svg' }]];
    return scene.items.map(item => [item.image.id, { localFile: 'image-presenter-smoke.svg' }]);
  })));
  const imagePresenter = { imageEvents: compiled.imageEvents, annotationEvents: compiled.annotationEvents };
  const inputProps = { timeline: compiled.timeline, imagePresenter };
  const composition = await selectComposition({ serveUrl, id: 'StickmanVideo', inputProps });
  const outputLocation = path.join(outDir, 'image-presenter-' + project.mode + '.mp4');
  await renderMedia({ composition, serveUrl, inputProps, codec: 'h264', outputLocation, concurrency: 2 });
  const stat = await fs.stat(outputLocation);
  if (stat.size < 10000) throw new Error(project.mode + ' render is unexpectedly small (' + stat.size + ' bytes).');
  console.log('[image-presenter-smoke] rendered ' + project.mode + ': ' + stat.size + ' bytes');
}
console.log('[image-presenter-smoke] all four modes rendered successfully');
