// src/render/cli.ts — engine CLI.
//
//   bun src/render/cli.ts --job render-job.json --public-dir <dir> --out out.mp4
//   bun src/render/cli.ts --selftest [--out out.mp4]
//
// The render-job.json carries the validated script, narration + image
// manifests (paths relative to the public dir), and the music file. The CLI
// builds the deterministic timeline, copies fonts into the public dir, packs
// the bundle (publicDir = job dir so staticFile() resolves every asset) and
// renders H.264 with the platform Chrome. Exposed env: CHROME_PATH,
// REMOTION_CONCURRENCY.

import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { cp, mkdir, readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import type { EpisodeScript, ImageManifest, NarrationManifest, VLJobSpec, VLTimeline } from '../types';
import { validateScript } from '../script/schema';
import { buildTimeline } from '../timeline/builder';

interface RenderJob {
  spec: VLJobSpec;
  script: EpisodeScript;
  narration: NarrationManifest;
  images: ImageManifest;
  musicFile: string | null;
}

function findChrome(): string | null {
  const fromEnv = process.env.CHROME_PATH;
  if (fromEnv && existsSync(fromEnv)) return fromEnv;
  const candidates = [
    '/home/z/.cache/puppeteer/chrome-headless-shell/linux-157.0.8103.78/chrome-headless-shell-linux64/chrome-headless-shell',
    '/home/z/.cache/puppeteer/chrome/linux-157.0.8103.78/chrome-linux64/chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return null;
}

/** sceneIndex -> {main, right, shots} map from the image manifest. */
function imagesMap(images: ImageManifest): Record<number, { main?: string; right?: string; shots: string[] }> {
  const map: Record<number, { main?: string; right?: string; shots: string[] }> = {};
  for (const asset of images.assets) {
    const entry = map[asset.sceneIndex] ?? (map[asset.sceneIndex] = { shots: [] });
    if (/-b\.jpg$/.test(asset.file)) entry.right = asset.file;
    else if (/-a\.jpg$/.test(asset.file)) entry.main = asset.file;
    else if (/-s(\d+)\.(?:jpg|mp4)$/.test(asset.file)) {
      const idx = Number(asset.file.match(/-s(\d+)\.(?:jpg|mp4)$/)![1]);
      entry.shots[idx] = asset.file;
      if (!entry.main) entry.main = asset.file;
    } else if (!entry.main) entry.main = asset.file;
  }
  // Compact the shot arrays (holes would break the carousel).
  for (const entry of Object.values(map)) {
    entry.shots = (entry.shots || []).filter(Boolean);
  }
  return map;
}

async function renderJob(jobPath: string, publicDir: string, outPath: string): Promise<void> {
  const raw = JSON.parse(await readFile(jobPath, 'utf8')) as RenderJob;
  // Re-validate (cheap, catches drifted/pasted scripts).
  const script = validateScript(raw.script, raw.spec);
  const narration = raw.narration;
  const timeline: VLTimeline = buildTimeline({
    script,
    narration,
    aspect: raw.spec.aspect,
    musicFile: raw.musicFile,
    subtitles: raw.spec.subtitles,
    watermark: raw.spec.watermark,
    images: raw.images,
  });

  // Fonts must be inside the public dir for staticFile() resolution.
  const fontsDir = path.join(publicDir, 'fonts');
  await mkdir(fontsDir, { recursive: true });
  const engineFonts = path.resolve(__dirname, '..', '..', 'assets', 'fonts');
  if (existsSync(engineFonts)) {
    await cp(engineFonts, fontsDir, { recursive: true });
  }

  const shotCount = timeline.scenes.reduce((a, s) => a + s.shots.length, 0);
  console.log(`[vl] timeline: ${timeline.scenes.length} scenes, ${(timeline.totalFrames / timeline.fps).toFixed(1)}s, ${timeline.width}x${timeline.height}, ${shotCount} image shots`);
  console.log('[vl] bundling…');
  const entryPoint = path.resolve(__dirname, 'index.ts');
  const bundleLocation = await bundle({
    entryPoint,
    publicDir,
    webpackOverride: (c) => c,
  });

  const comps = await selectComposition({
    serveUrl: bundleLocation,
    id: 'VLVideo',
    inputProps: { script, timeline, images: imagesMap(raw.images), accent: raw.spec.accent || undefined } as unknown as Record<string, unknown>,
  });

  const chromePath = findChrome();
  if (!chromePath) {
    throw new Error('No Chrome/Chromium found. Set CHROME_PATH or install chromium.');
  }
  console.log(`[vl] rendering ${(timeline.totalFrames / timeline.fps).toFixed(1)}s with chrome ${path.basename(chromePath)}…`);
  await renderMedia({
    composition: comps,
    serveUrl: bundleLocation,
    codec: 'h264',
    outputLocation: outPath,
    inputProps: { script, timeline, images: imagesMap(raw.images), accent: raw.spec.accent || undefined } as unknown as Record<string, unknown>,
    browserExecutable: chromePath,
    concurrency: Math.max(1, Math.min(8, Number(process.env.REMOTION_CONCURRENCY || 2))),
    imageFormat: 'jpeg',
    jpegQuality: 92,
    x264Preset: 'medium',
    crf: 18,
    overwrite: true,
  });
  console.log(`[vl] wrote ${outPath}`);
}

/** Fully offline mini-episode — proves the render path end-to-end. */
async function selftest(outPath: string): Promise<void> {
  const { architectScript } = await import('../script/architect');
  const { prepareNarration, prepareImages, prepareMusic } = await import('../prepare');
  const workDir = await mkdtemp(path.join(tmpdir(), 'vl-selftest-'));
  const publicDir = path.join(workDir, 'public');
  await mkdir(publicDir, { recursive: true });

  const spec: VLJobSpec = {
    title: 'Visual Learning Engine Self-Test',
    topic: 'spaced repetition',
    audience: 'students',
    tone: 'warm and curious',
    targetSeconds: 40,
    aspect: '16:9',
    style: 'cartoon',
    voice: 'warm_male',
    accent: '',
    music: true,
    subtitles: true,
    seed: 42,
    narrationProvider: 'silent',
    imageProvider: 'placeholder',
    watermark: 'Shiney Brain Academy',
  };
  const script = architectScript(spec);
  const narration = await prepareNarration(script, spec, { publicDir, narrationProvider: 'silent' });
  const images = await prepareImages(script, spec, { publicDir, imageProvider: 'placeholder', imageConcurrency: 2 });
  const musicFile = await prepareMusic(spec, script, narration, { publicDir });

  const jobPath = path.join(workDir, 'render-job.json');
  const job: RenderJob = { spec, script, narration, images, musicFile };
  await writeFile(jobPath, JSON.stringify(job));
  try {
    await renderJob(jobPath, publicDir, outPath);
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const get = (flag: string): string | undefined => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const has = (flag: string): boolean => args.includes(flag);

  if (has('--selftest')) {
    const out = get('--out') || path.join(process.cwd(), 'vl-selftest.mp4');
    console.log(`[vl] self-test → ${out}`);
    await selftest(out);
    console.log('[vl] SELF-TEST OK');
    return;
  }

  const jobPath = get('--job');
  const out = get('--out');
  if (!jobPath || !out) {
    console.error('Usage: bun src/render/cli.ts --job render-job.json --public-dir <dir> --out out.mp4 | --selftest --out out.mp4');
    process.exit(1);
  }
  const publicDir = get('--public-dir') || path.join(path.dirname(path.resolve(jobPath)), 'public');
  await mkdir(path.dirname(path.resolve(out)), { recursive: true });
  await renderJob(jobPath, publicDir, path.resolve(out));
}

if (import.meta.main) {
  main().catch((err) => {
    console.error('[vl] render failed:', err);
    process.exit(1);
  });
}
