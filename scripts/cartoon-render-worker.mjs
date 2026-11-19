// Cartoon render worker — standalone process (NOT bundled into Next).
// Mirrors local-video-renderer/whiteboard-worker.js architecture:
// Next API routes only enqueue jobs; this process does the heavy
// Remotion bundle + Chrome render work and reports progress via a
// JSON file. Run: node scripts/cartoon-render-worker.mjs <jobFile>
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition, ensureBrowser } from "@remotion/renderer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

const jobFile = process.argv[2];
if (!jobFile) {
  console.error("usage: node cartoon-render-worker.mjs <jobFile>");
  process.exit(1);
}
const job = JSON.parse(fs.readFileSync(jobFile, "utf-8"));
const { projectId, props, output, progressFile } = job;

const writeProgress = (data) => {
  try { fs.writeFileSync(progressFile, JSON.stringify(data)); } catch { /* ignore */ }
};

writeProgress({ stage: "browser", progress: 0.01, message: "Preparing renderer..." });

try {
  await ensureBrowser();
  writeProgress({ stage: "bundling", progress: 0.03, message: "Bundling the animation engine..." });

  const bundleLoc = await bundle({
    entryPoint: path.join(ROOT, "remotion", "index.jsx"),
    publicDir: path.join(ROOT, "public"),
    onProgress: () => {},
  });

  writeProgress({ stage: "composing", progress: 0.05, message: "Composing scenes..." });
  const comp = await selectComposition({
    serveUrl: bundleLoc,
    id: "CartoonVideo",
    inputProps: props,
  });

  let last = 0;
  await renderMedia({
    composition: comp,
    serveUrl: bundleLoc,
    codec: "h264",
    outputLocation: output,
    inputProps: props,
    imageFormat: "jpeg",
    jpegQuality: 92,
    crf: 19,
    concurrency: 2,
    onProgress: ({ progress }) => {
      if (progress - last >= 0.02 || progress >= 1) {
        last = progress;
        writeProgress({
          stage: "rendering",
          progress: 0.05 + progress * 0.9,
          message: `Rendering... ${Math.round(progress * 100)}%`,
        });
      }
    },
  });

  const stat = fs.statSync(output);
  writeProgress({
    ok: true,
    stage: "done",
    progress: 1,
    videoPath: output,
    durationSeconds: +(comp.durationInFrames / comp.fps).toFixed(2),
    sizeBytes: stat.size,
  });
  process.exit(0);
} catch (e) {
  writeProgress({ ok: false, error: (e && e.message ? e.message : String(e)).slice(0, 800) });
  process.exit(1);
}
