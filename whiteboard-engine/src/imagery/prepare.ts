// src/imagery/prepare.ts — async pre-pass: turn every `image:` element into a
// registered illustration (strokes + colour layer) BEFORE the sync timeline
// builder runs. Failures never abort the render: the element is dropped and a
// warning is returned.

import type { VideoSpec, IllustrationSpec } from '../types';
import { registerIllustration } from '../illustrations/registry';
import { findLegacyAsset } from '../illustrations/legacy-catalog';
import { getLegacyIllustration } from '../illustrations/legacy';
import { imageId, loadImage } from './source';
import { traceImage } from './trace';

export interface PrepareResult {
  warnings: string[];
  /** Attribution lines for sourced images (put them in the video description). */
  credits: string[];
}

const traceCache = new Map<string, Promise<{ spec: IllustrationSpec; credit?: string }>>();

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
        // Resolve the SBA-authored local vector library before attempting any
        // network image search. Both local legacy SVGs and external images
        // enter the exact same existing trace + colour + hand-draw pipeline.
        const legacyQuery = el.image.replace(/^legacy\\./i, '');
        const legacy = /^legacy\\./i.test(el.image) ? findLegacyAsset(legacyQuery) : findLegacyAsset(el.image);
        if (legacy) {
          const local = await getLegacyIllustration(`legacy.${legacy.id}`);
          if (!local) throw new Error(`legacy SBA illustration not found: ${el.image}`);
          registerIllustration(local);
          el.asset = local.id;
          kept.push(el);
          continue;
        }

        let p = traceCache.get(key);
        let credit: string | undefined;
        if (!p) {
          p = buildSpec(el.image, colorize).then((r) => {
            registerIllustration(r.spec);
            return r;
          });
          traceCache.set(key, p);
        }
        const prepared = await p;
        credit = prepared.credit;
        if (credit) credits.push(`${el.image}: ${credit}`);
        el.asset = prepared.spec.id;
        kept.push(el);
      } catch (err) {
        warnings.push(`Scene "${scene.id}": image "${el.image}" skipped — ${(err as Error).message}`);
      }
    }
    scene.elements = kept;
  }
  return { warnings, credits };
}
