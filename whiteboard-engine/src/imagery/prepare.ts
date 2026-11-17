// src/imagery/prepare.ts — async pre-pass: turn every `image:` element into a
// registered illustration (strokes + colour layer) BEFORE the sync timeline
// builder runs. Failures never abort the render: the element is dropped and a
// warning is returned.
//
// Routing rules:
//   • "legacy.<id>" refs go straight to the local SBA artwork library.
//   • Plain keyword refs search EXTERNAL free sources first (the planner was
//     promised external images) and fall back to a local legacy match when the
//     network fails — a local drawing beats a dropped scene.
//   • Every image used in the job is hashed; later lookups exclude repeats so
//     scenes never show the same stock photo twice.

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
  /** Key/provider diagnostics (missing API keys, fallbacks used). */
  notes: string[];
}

const traceCache = new Map<string, Promise<{ spec: IllustrationSpec; credit?: string }>>();

async function buildSpec(
  ref: string,
  colorize: boolean,
  avoid?: Set<string>,
  notes?: string[],
): Promise<{ spec: IllustrationSpec; credit?: string }> {
  const loaded = await loadImage(ref, { intent: 'diagram', avoid, notes });
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
  const notes: string[] = [];
  // content hashes of every image used in this job → later lookups avoid them
  const usedHashes = new Set<string>();

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
        // 1. explicit legacy refs resolve locally
        if (/^legacy\./i.test(el.image)) {
          const local = await getLegacyIllustration(el.image, colorize);
          if (!local) throw new Error(`legacy SBA illustration not found: ${el.image}`);
          registerIllustration(local);
          el.asset = local.id;
          kept.push(el);
          continue;
        }

        // 2. everything else: external free sources first
        try {
          let p = traceCache.get(key);
          let credit: string | undefined;
          if (!p) {
            p = buildSpec(el.image, colorize, usedHashes, notes).then((r) => {
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
          continue;
        } catch (extErr) {
          // 3. fallback: a matching local legacy drawing beats a dropped scene
          const legacy = findLegacyAsset(el.image);
          if (!legacy) throw extErr;
          notes.push(`Scene "${scene.id}": external image "${el.image}" failed — using local legacy.${legacy.id}`);
          const local = await getLegacyIllustration(`legacy.${legacy.id}`, colorize);
          if (!local) throw extErr;
          registerIllustration(local);
          el.asset = local.id;
          kept.push(el);
          continue;
        }
      } catch (err) {
        warnings.push(`Scene "${scene.id}": image "${el.image}" skipped — ${(err as Error).message}`);
      }
    }
    scene.elements = kept;
  }
  return { warnings, credits, notes };
}
