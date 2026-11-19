// Probe: bundle the remotion app, start the internal server, and check
// how static URLs resolve for visual-assets files (audio works, images didn't).
import { bundle } from "@remotion/bundler";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

const bundleLoc = await bundle({
  entryPoint: path.join(ROOT, "remotion", "index.jsx"),
  publicDir: path.join(ROOT, "public"),
  onProgress: () => {},
});
console.log("bundle at:", bundleLoc);
console.log("bundle dir listing (top):", fs.readdirSync(bundleLoc).slice(0, 20).join(", "));
const va = path.join(bundleLoc, "visual-assets");
console.log("visual-assets in bundle:", fs.existsSync(va) ? `${fs.readdirSync(va).length} files` : "MISSING");
const cm = path.join(bundleLoc, "cartoon-media");
console.log("cartoon-media in bundle:", fs.existsSync(cm) ? `${fs.readdirSync(cm).length} entries` : "MISSING");
process.exit(0);
