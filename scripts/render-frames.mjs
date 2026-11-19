// Visual QA harness: renders specific frames of a CartoonVideo spec to PNG stills,
// then tiles them into contact sheets so quality can be inspected efficiently.
// Usage: node scripts/render-frames.mjs <spec-json-file> <out-prefix> [frames-sec-list] [orientation]
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition, ensureBrowser } from "@remotion/renderer";
import path from "path";
import fs from "fs";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const specFile = process.argv[2];
const outPrefix = process.argv[3] || "/tmp/frames/f";
const timesArg = process.argv[4] || "0.8,2,4,6";
const orientation = process.argv[5] || "9:16";

const spec = JSON.parse(fs.readFileSync(specFile, "utf-8"));
const times = timesArg.split(",").map(Number);
const size = orientation === "16:9" ? { w: 1280, h: 720 } : orientation === "1:1" ? { w: 900, h: 900 } : { w: 720, h: 1280 };

fs.mkdirSync(path.dirname(outPrefix), { recursive: true });

console.log("ensuring browser...");
await ensureBrowser();
console.log("bundling...");
const bundleLoc = await bundle({
  entryPoint: path.join(ROOT, "remotion", "index.jsx"),
  publicDir: path.join(ROOT, "public"),
  onProgress: () => {},
});
console.log("bundle at", bundleLoc);

const comp = await selectComposition({
  serveUrl: bundleLoc,
  id: "CartoonVideo",
  inputProps: { spec, narration: {}, orientation },
});
const { durationInFrames, fps, width, height } = comp;
console.log("composition:", width, height, "frames:", durationInFrames);

const outputs = [];
for (let i = 0; i < times.length; i++) {
  const frame = Math.min(durationInFrames - 1, Math.round(times[i] * fps));
  const out = `${outPrefix}-${String(i).padStart(2, "0")}.png`;
  await renderStill({
    composition: comp,
    serveUrl: bundleLoc,
    frame,
    output: out,
    inputProps: { spec, narration: {}, orientation },
    imageFormat: "png",
  });
  outputs.push(out);
  console.log("still", out);
}

// tile into contact sheet (dynamic grid)
const n = outputs.length;
const cols = Math.min(4, n);
const rows = Math.ceil(n / cols);
while (outputs.length < rows * cols) outputs.push(outputs[0]); // pad by repeating first
const rowFilters = [];
for (let r = 0; r < rows; r++) {
  const rowInputs = outputs.slice(r * cols, r * cols + cols).map((_, i) => `[${r * cols + i}]`).join("");
  rowFilters.push(`${rowInputs}hstack=inputs=${cols}[r${r}]`);
}
const stackRows = rowFilters.map((_, r) => `[r${r}]`).join("");
const sheet = `${outPrefix}-sheet.png`;
const filter = `${rowFilters.join(";")};${stackRows}${rows > 1 ? "vstack" : "null"}[v]`;
execSync(`ffmpeg -y -v error ${outputs.map((o) => `-i ${o}`).join(" ")} -filter_complex "${filter}" -map "[v]" ${sheet}`);
console.log("sheet", sheet);
