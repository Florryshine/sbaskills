// src/render/cli.ts — end-to-end renderer: script → narration → timeline → MP4.
//
// Usage:
//   bun run src/render/cli.ts demos/photosynthesis/script.txt \
//     --out demos/output/photosynthesis.mp4 --provider zai --voice jam
//
// Providers: zai (sandbox) | edge (production, real word timings)

import { parseScript } from '../script/parser';
import { getProvider, type NarrationProvider } from '../narration';
import { buildTimeline } from '../timeline/builder';
import type { WordTiming } from '../types';

function arg(name: string): string | undefined {
  const idx = process.argv.indexOf(name);
  return idx >= 0 ? process.argv[idx + 1] : undefined;
}

async function main() {
  const scriptPath = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : undefined;
  const out = arg('--out') ?? 'demos/output/video.mp4';
  const timelinePath = arg('--timeline');
  const fps = parseInt(arg('--fps') ?? '30', 10);

  // Mode 2: render a prebuilt timeline (used by the local whiteboard worker —
  // narration + timeline already produced by the admin API route).
  if (timelinePath) {
    console.log(`[whiteboard-engine] rendering timeline ${timelinePath} → ${out}`);
    const timeline = (await Bun.file(timelinePath).json()) as import('../types').Timeline;
    // The job directory acts as the public dir (it contains narration/).
    // Fonts must be present there for staticFile() resolution.
    const pathMod = await import('node:path');
    const jobPublicDir = pathMod.dirname(pathMod.resolve(timelinePath));
    const fontsDir = pathMod.join(jobPublicDir, 'fonts');
    if (!(await Bun.file(pathMod.join(fontsDir, 'Caveat-Bold.ttf')).exists())) {
      await Bun.write(Bun.file(pathMod.join(fontsDir, 'Caveat-Bold.ttf')), Bun.file('assets/fonts/Caveat-Bold.ttf'));
      await Bun.write(Bun.file(pathMod.join(fontsDir, 'PatrickHand-Regular.ttf')), Bun.file('assets/fonts/PatrickHand-Regular.ttf'));
      await Bun.write(Bun.file(pathMod.join(fontsDir, 'Kalam-Regular.ttf')), Bun.file('assets/fonts/Kalam-Regular.ttf'));
    }
    await renderTimeline(timeline, out, fps, jobPublicDir);
    return;
  }

  if (!scriptPath) {
    console.error('Usage: bun run src/render/cli.ts <script.txt> --out <file.mp4> [--provider zai|edge] [--voice <name>]');
    console.error('   or: bun run src/render/cli.ts --timeline timeline.json --out <file.mp4>');
    process.exit(1);
  }
  const providerName = arg('--provider') ?? 'zai';
  const voice = arg('--voice') ?? (providerName === 'edge' ? 'en-NG-EzinneNeural' : 'jam');

  console.log(`[whiteboard-engine] rendering "${scriptPath}" → ${out} (provider=${providerName}, voice=${voice})`);
  const t0 = Date.now();

  // 1. Parse script
  const source = await Bun.file(scriptPath).text();
  const spec = parseScript(source);
  console.log(`[1/5] parsed ${spec.scenes.length} scenes for "${spec.title}" (subject: ${spec.subject})`);

  // 2. Narration per scene
  const provider: NarrationProvider = getProvider(providerName);
  const slug = spec.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'lesson';
  const narration: Array<{ audioFile: string; duration: number; words: WordTiming[] }> = [];
  for (let i = 0; i < spec.scenes.length; i++) {
    const scene = spec.scenes[i];
    const res = await provider.synthesize(scene.narration, voice);
    const audioFile = `narration/${slug}-${String(i + 1).padStart(2, '0')}.${res.ext}`;
    await Bun.write(`public/${audioFile}`, res.audio);
    narration.push({ audioFile, duration: res.duration, words: res.words });
    console.log(`[2/5] scene ${i + 1}/${spec.scenes.length} narration: ${res.duration.toFixed(1)}s, ${res.words.length} words`);
  }

  // 3. Build timeline
  const { timeline, warnings } = buildTimeline(spec, narration, { fps });
  for (const w of warnings) console.warn(`[3/5] warning: ${w}`);
  console.log(`[3/5] timeline: ${timeline.scenes.length} scenes, total ${timeline.totalDuration.toFixed(1)}s`);
  await Bun.write('public/timeline.json', JSON.stringify(timeline));

  // 4-5. Bundle + render
  await renderTimeline(timeline, out, fps);
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`[whiteboard-engine] done in ${secs}s → ${out}`);
}

async function renderTimeline(timeline: import('../types').Timeline, out: string, fps: number, publicDir = 'public'): Promise<void> {
  // 4. Bundle Remotion project
  const { bundle } = await import('@remotion/bundler');
  console.log('[4/5] bundling remotion project...');
  const bundleResult = await bundle({
    entryPoint: 'src/remotion/index.tsx',
    publicDir,
    onProgress: (() => null) as never,
  });

  // 5. Render
  const { renderMedia, selectComposition } = await import('@remotion/renderer');
  const inputProps = { timeline };
  const composition = await selectComposition({
    serveUrl: bundleResult,
    id: 'WhiteboardVideo',
    inputProps,
  });
  console.log(`[5/5] rendering ${Math.ceil(timeline.totalDuration * fps)} frames @ ${fps}fps...`);
  let lastProgress = 0;
  await renderMedia({
    composition,
    serveUrl: bundleResult,
    codec: 'h264',
    outputLocation: out,
    inputProps,
    imageFormat: 'jpeg',
    jpegQuality: 92,
    concurrency: Math.max(1, Math.min(4, (await import('node:os')).cpus().length - 1)),
    onProgress: ({ progress }: { progress: number }) => {
      if (progress - lastProgress > 0.1) {
        lastProgress = progress;
        console.log(`  render ${(progress * 100).toFixed(0)}%`);
      }
    },
  });
}

main().catch((err) => {
  console.error('[whiteboard-engine] render failed:', err);
  process.exit(1);
});
