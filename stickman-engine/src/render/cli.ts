/**
 * Render CLI for the stickman engine (mirrors the whiteboard engine's
 * render entry). Runs under Bun or Node:
 *   bun src/render/cli.ts --job job.json
 *   node dist-cli.js --job job.json
 *
 * job.json: { script: <SceneScript>, narration: {...}, out: "out.mp4",
 *             browserExecutable?: "..." }
 */
import path from 'path';
import fs from 'fs';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { SceneScript } from '../rig/character';
import { compile, NarrationMap } from '../scene/compiler';

const arg = (name: string): string | undefined => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

async function main() {
  const jobPath = arg('job');
  if (!jobPath) throw new Error('usage: cli.ts --job job.json [--out out.mp4]');
  const job = JSON.parse(fs.readFileSync(jobPath, 'utf-8'));
  const script: SceneScript = job.script;
  const narration: NarrationMap = job.narration ?? {};
  const out = arg('out') ?? job.out ?? 'stickman-out.mp4';

  const t0 = Date.now();
  const timeline = compile(script, narration);
  console.log(`[stickman] compiled: ${timeline.durationFrames} frames, ${timeline.characters.length} characters, ${timeline.audio.length} audio items, ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  const engineRoot = path.resolve(__dirname, '..', '..');
  const entryPoint = path.join(engineRoot, 'src', 'render', 'index.tsx');

  console.log('[stickman] bundling remotion project...');
  const serveUrl = await bundle({
    entryPoint,
    onProgress: (p: number) => {
      if (p % 20 === 0) process.stdout.write(`\r[stickman] bundle ${p}%`);
    },
    ...(job.publicDir ? { publicDir: job.publicDir } : {}),
  });
  if (process.stdout.isTTY) process.stdout.write('\n');

  const inputProps = { timeline, ...(job.imagePresenter ? { imagePresenter: job.imagePresenter } : {}) };
  const composition = await selectComposition({
    serveUrl, id: 'StickmanVideo', inputProps,
  });

  console.log(`[stickman] rendering ${composition.durationInFrames} frames @ ${composition.fps} fps ${composition.width}x${composition.height}...`);
  await renderMedia({
    composition,
    serveUrl,
    inputProps,
    codec: 'h264',
    outputLocation: path.resolve(out),
    ...(job.browserExecutable || arg('browser')
      ? { browserExecutable: arg('browser') || job.browserExecutable }
      : {}),
    onProgress: ({ progress }: { progress: number }) => {
      const pct = Math.floor(progress * 100);
      if (pct % 10 === 0) process.stdout.write(`\r[stickman] render ${pct}%`);
    },
    ...(job.concurrency ? { concurrency: job.concurrency } : {}),
    ...(arg('frames') ? {
      frameRange: (() => {
        const [a, b] = (arg('frames') as string).split('-').map(Number);
        return [a, Number.isNaN(b) ? a : b] as [number, number];
      })(),
    } : {}),
  });
  if (process.stdout.isTTY) process.stdout.write('\n');
  console.log(`[stickman] done: ${out} (${((Date.now() - t0) / 1000).toFixed(0)}s total)`);
}

main().catch((e) => {
  console.error('[stickman] render failed:', e);
  process.exit(1);
});
