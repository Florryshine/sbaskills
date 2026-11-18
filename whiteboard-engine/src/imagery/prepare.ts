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
    // The planner is instructed to include a real image in every scene. Keep
    // that guarantee even for older scripts and manually pasted lessons.
    // This is a fetch attempt, not a fabricated/local substitute: if no
    // suitable free image exists, the normal warning/fallback path reports it.
    if (!scene.elements.some((el) => !!el.image)) {
      const query = [scene.heading || spec.title, spec.subject, 'educational diagram'].filter(Boolean).join(' ');
      scene.elements.push({
        id: `auto-image-${scene.id}`,
        type: 'illustration',
        image: query,
        colorize: true,
        sync: { kind: 'fraction', fraction: 0.42 },
        at: 'right',
        scale: 0.65,
      });
      notes.push(`Scene "${scene.id}": added an automatic educational-image search because the script supplied no image: directive.`);
    }
    const kept = [];
    let fetchedRealImage = false;
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
          // Do not keep a process-global promise cache here: it bypasses the
          // per-job duplicate-image set and can silently reuse one image in
          // every scene/video. loadImage has its own byte cache and honours
          // usedHashes while selecting a distinct source.
          const prepared = await buildSpec(el.image, colorize, usedHashes, notes);
          registerIllustration(prepared.spec);
          const credit = prepared.credit;
          if (credit) credits.push(`${el.image}: ${credit}`);
          el.asset = prepared.spec.id;
          fetchedRealImage = true;
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

    // If the requested search/direct image failed, make one independent
    // educational-image attempt before accepting a scene with no real image.
    if (!fetchedRealImage) {
      const fallbackQuery = `${scene.heading || spec.title} ${spec.subject} real educational reference`;
      try {
        const fallback = await buildSpec(fallbackQuery, true, usedHashes, notes);
        registerIllustration(fallback.spec);
        if (fallback.credit) credits.push(`${fallbackQuery}: ${fallback.credit}`);
        kept.push({
          id: `fallback-image-${scene.id}`,
          type: 'illustration',
          asset: fallback.spec.id,
          image: fallbackQuery,
          colorize: true,
          sync: { kind: 'fraction', fraction: 0.58 },
          at: 'right',
          scale: 0.6,
        });
        notes.push(`Scene "${scene.id}": used a fallback educational image search after the requested image was unavailable.`);
      } catch (err) {
        warnings.push(`Scene "${scene.id}": no suitable real educational image could be fetched after fallback — ${(err as Error).message}`);
      }
    }
    scene.elements = kept;
  }
  return { warnings, credits, notes };
}
