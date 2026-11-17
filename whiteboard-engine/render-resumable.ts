// render-resumable.ts — chunked, resumable renderer for the sandbox.
//
// The full CLI render dies when long-running detached processes are reaped,
// so this runner does ONE unit of work per invocation and persists state:
//   1. synthesize any missing narration WAVs (fresh, consistent set)
//   2. build the timeline (with photo-hand sprite embedded)
//   3. bundle the Remotion project once to a persistent dir
//   4. render the next pending 500-frame chunk (skips finished chunks)
//   5. when every chunk exists, concat them into the final MP4
//
// Usage: bun run render-resumable.ts <script.txt> --out <final.mp4> [--chunk 500]

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, statSync } from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const scriptPath = args[0];
const outIdx = args.indexOf('--out');
const OUT = outIdx >= 0 ? args[outIdx + 1] : 'demos/output/final.mp4';
const chunkArg = args.indexOf('--chunk');
const CHUNK = chunkArg >= 0 ? parseInt(args[chunkArg + 1], 10) : 500;
const FPS = 30;
const BUDGET_MS = 8.4 * 60 * 1000;
const START = Date.now();

const { parseScript } = await import('./src/script/parser');
const { buildTimeline } = await import('./src/timeline/builder');
const { proportionalWords } = await import('./src/narration/align');
import type { Timeline, WordTiming } from './src/types';

function wavDuration(p: string): number {
  const buf = readFileSync(p);
  if (buf.length < 44 || buf.toString('latin1', 0, 4) !== 'RIFF') return 0;
  let off = 12;
  let byteRate = 0;
  let dataSize = 0;
  while (off + 8 <= buf.length) {
    const id = buf.toString('latin1', off, off + 4);
    const size = buf.readUInt32LE(off + 4);
    if (id === 'fmt ') byteRate = buf.readUInt32LE(off + 16);
    if (id === 'data') { dataSize = size; break; }
    off += 8 + size + (size % 2);
  }
  return byteRate > 0 ? dataSize / byteRate : 0;
}

const spec = parseScript(readFileSync(scriptPath, 'utf8'));
const slug = spec.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'lesson';
mkdirSync('public/narration', { recursive: true });

// --- 1. narration (fresh consistent set) ---
const narrationFiles: string[] = [];
const narration: Array<{ audioFile: string; duration: number; words: WordTiming[] }> = [];
for (let i = 0; i < spec.scenes.length; i++) {
  const scene = spec.scenes[i];
  const file = `narration/${slug}-${String(i + 1).padStart(2, '0')}.wav`;
  narrationFiles.push(`public/${file}`);
  const full = path.resolve('public', file);
  const need = !existsSync(full) || statSync(full).size < 1000;
  if (need) {
    console.log(`[narr] synthesizing scene ${i + 1}/${spec.scenes.length}...`);
    const res = spawnSync('z-ai', ['tts', '-i', scene.narration.slice(0, 1000), '-o', full, '--voice', 'jam', '--format', 'wav'], { encoding: 'utf8', timeout: 150000 });
    if (res.status !== 0 || !existsSync(full) || statSync(full).size < 1000) {
      console.error(`[narr] scene ${i + 1} TTS failed: ${(res.stderr || res.stdout || '').slice(-200)}`);
      process.exit(2);
    }
  } else {
    console.log(`[narr] scene ${i + 1}/${spec.scenes.length} reused (${file})`);
  }
  const dur = wavDuration(full);
  narration.push({ audioFile: file, duration: dur, words: proportionalWords(scene.narration, dur) });
}

// --- 2. timeline + hand sprite ---
const { timeline, warnings } = buildTimeline(spec, narration, { fps: FPS });
for (const w of warnings) console.warn(`[tl] warning: ${w}`);
{
  const meta = JSON.parse(readFileSync('public/whiteboard/marker-hand.meta.json', 'utf8'));
  const png = readFileSync('public/whiteboard/marker-hand.png');
  timeline.handSprite = {
    dataUri: `data:image/png;base64,${png.toString('base64')}`,
    tipX: meta.tip[0],
    tipY: meta.tip[1],
    width: meta.size[0],
    height: meta.size[1],
  };
  console.log(`[tl] photo hand embedded (${(png.length / 1024).toFixed(0)} KB)`);
}
const totalFrames = Math.ceil(timeline.totalDuration * FPS);
const chunkCount = Math.ceil(totalFrames / CHUNK);
console.log(`[tl] scenes=${timeline.scenes.length} total=${timeline.totalDuration.toFixed(1)}s frames=${totalFrames} chunks=${chunkCount}`);

const statePath = 'demos/output/.render-state.json';
const state = existsSync(statePath)
  ? JSON.parse(readFileSync(statePath, 'utf8'))
  : { slug, totalFrames, chunkCount, done: [] as number[] };
if (state.totalFrames !== totalFrames) {
  // narration set changed → restart chunk bookkeeping
  state.totalFrames = totalFrames;
  state.chunkCount = chunkCount;
  state.done = [];
}
writeFileSync(statePath, JSON.stringify(state));

// --- 3. bundle once (persistent dir) ---
const bundleDir = 'demos/output/.bundle-out';
let serveUrl: string;
if (existsSync(path.join(bundleDir, 'bundle.js'))) {
  console.log('[bundle] reusing cached bundle');
  serveUrl = bundleDir;
} else {
  const { bundle } = await import('@remotion/bundler');
  console.log('[bundle] bundling remotion project...');
  serveUrl = await bundle({ entryPoint: 'src/remotion/index.tsx', publicDir: 'public', onProgress: () => null, outDir: path.resolve(bundleDir) });
  console.log('[bundle] done →', serveUrl);
}
const { renderMedia, selectComposition } = await import('@remotion/renderer');
const inputProps = { timeline };
const composition = await selectComposition({ serveUrl, id: 'WhiteboardVideo', inputProps });

// --- 4/5. render pending chunks within the time budget ---
let renderedAny = false;
for (let c = 0; c < chunkCount; c++) {
  if (state.done.includes(c)) continue;
  if (Date.now() - START > BUDGET_MS) { console.log('[chunk] time budget reached — resume next run'); process.exit(0); }
  const from = c * CHUNK;
  const to = Math.min((c + 1) * CHUNK, totalFrames) - 1;
  const chunkFile = `demos/output/.chunk-${String(c).padStart(3, '0')}.mp4`;
  console.log(`[chunk] rendering chunk ${c + 1}/${chunkCount} (frames ${from}-${to})...`);
  await renderMedia({
    composition,
    serveUrl,
    codec: 'h264',
    outputLocation: chunkFile,
    inputProps,
    imageFormat: 'jpeg',
    jpegQuality: 92,
    crf: 21,
    frames: [from, to],
    concurrency: 1,
    // Muted chunks keep every container duration = video length, so the
    // concat step re-bases cleanly. The full audio track is rendered once
    // and muxed at assemble time.
    muted: true,
    onProgress: ({ progress }: { progress: number }) => {
      if (Math.round(progress * 100) % 25 === 0) console.log(`  chunk ${c + 1}: ${(progress * 100).toFixed(0)}%`);
    },
  });
  state.done.push(c);
  writeFileSync(statePath, JSON.stringify(state));
  renderedAny = true;
  console.log(`[chunk] chunk ${c + 1}/${chunkCount} done`);
}

if (state.done.length < chunkCount) {
  console.log(`[state] ${state.done.length}/${chunkCount} chunks complete — resume with: bun run render-resumable.ts ${scriptPath} --out ${OUT}`);
  process.exit(0);
}

// --- 6. concat + mux full audio ---
console.log('[concat] joining chunks...');
const listFile = 'demos/output/.concat-list.txt';
writeFileSync(listFile, state.done.sort((a, b) => a - b).map((c) => `file '${path.resolve('demos/output', `.chunk-${String(c).padStart(3, '0')}.mp4`)}'`).join('\n'));
const videoOnly = 'demos/output/.video-only.mp4';
const ff = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', videoOnly], { encoding: 'utf8', timeout: 120000 });
if (ff.status !== 0) {
  console.error('[concat] ffmpeg failed:', ff.stderr?.slice(-300));
  process.exit(3);
}
console.log('[mux] adding narration audio...');
const audioFile = 'demos/output/.full-audio.mp3';
const muxArgs = ['-y', '-loglevel', 'error', '-i', videoOnly];
if (existsSync(audioFile)) {
  muxArgs.push('-i', audioFile, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-shortest');
} else {
  console.warn('[mux] no .full-audio.mp3 found — assembling video without audio');
  muxArgs.push('-map', '0:v', '-c:v', 'copy');
}
muxArgs.push('-movflags', '+faststart', OUT);
const mux = spawnSync('ffmpeg', muxArgs, { encoding: 'utf8', timeout: 180000 });
if (mux.status !== 0) {
  console.error('[mux] ffmpeg failed:', mux.stderr?.slice(-300));
  process.exit(3);
}
for (const c of state.done) rmSync(`demos/output/.chunk-${String(c).padStart(3, '0')}.mp4`, { force: true });
rmSync(listFile, { force: true });
rmSync(videoOnly, { force: true });
rmSync(statePath, { force: true });
console.log(`[done] ${OUT} (${(statSync(OUT).size / 1024 / 1024).toFixed(1)} MB)`);
if (renderedAny) console.log('[done] all chunks rendered this session');
