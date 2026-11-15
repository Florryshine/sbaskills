// src/imagery/prepare.ts — async pre-pass: turn every `image:` element into a
// registered illustration (strokes + colour layer) BEFORE the sync timeline
// builder runs. Failures never abort the render: the element is dropped and a
// warning is returned.

import type { VideoSpec, IllustrationSpec } from '../types';
import { registerIllustration } from '../illustrations/registry';
import { imageId, loadImage } from './source';
import { traceImage } from './trace';

export interface PrepareResult {
  warnings: string[];
  /** Attribution lines for sourced images (put them in the video description). */
  credits: string[];
}

const traceCache = new Map<string, Promise<IllustrationSpec>>();

async function buildSpec(ref: string, colorize: boolean): Promise<{ spec: IllustrationSpec; credit?: string }> {
  const loaded = await loadImage(ref);
  const traced = await traceImage(loaded.buffer, { noColor: !colorize });
  const id = imageId(ref) + (colorize ? '' : '.nc');
  const spec: IllustrationSpec = {
    id,
    box: traced.box,
    estLength: traced.totalLength,
    strokes: traced.strokes.map((s) => ({ d: s.d, width: 4.2, color: 'ink' })),
    colorLayer: traced.colorLayer,
  };
  return { spec, credit: loaded.credit };
}

export async function prepareImages(spec: VideoSpec): Promise<PrepareResult> {
  const warnings: string[] = [];
  const credits: string[] = [];

  for (const scene of spec.scenes) {
    const kept = [];
    for (const el of scene.elements) {
      if (!el.image) {
        kept.push(el);
        continue;
      }
      const colorize = el.colorize !== false;
      const key = `${el.image}|${colorize}`;
      try {
        let p = traceCache.get(key);
        let credit: string | undefined;
        if (!p) {
          p = buildSpec(el.image, colorize).then((r) => {
            credit = r.credit;
            registerIllustration(r.spec);
            return r.spec;
          });
          traceCache.set(key, p);
        }
        const ill = await p;
        if (credit) credits.push(`${el.image}: ${credit}`);
        el.asset = ill.id;
        kept.push(el);
      } catch (err) {
        warnings.push(`Scene "${scene.id}": image "${el.image}" skipped — ${(err as Error).message}`);
      }
    }
    scene.elements = kept;
  }
  return { warnings, credits };
}
