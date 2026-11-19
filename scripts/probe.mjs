import { bundle } from "@remotion/bundler";
import { selectComposition, renderStill } from "@remotion/renderer";
import path from "path";
import fs from "fs";
const ROOT = "/home/z/my-project";
const spec = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts/test-spec.json"), "utf-8"));
const bundleLoc = await bundle({ entryPoint: path.join(ROOT, "remotion/index.jsx"), publicDir: path.join(ROOT, "public"), onProgress: () => {} });
const inputProps = { spec, narration: {}, orientation: "9:16" };
const comp = await selectComposition({ serveUrl: bundleLoc, id: "CartoonVideo", inputProps });
console.log("selected:", comp.id, comp.durationInFrames);
try {
  await renderStill({ composition: comp, serveUrl: bundleLoc, frame: 30, output: "/tmp/probe.png", inputProps, imageFormat: "png" });
  console.log("STILL OK with full composition object");
} catch (e) {
  console.log("STILL FAIL:", e.message?.slice(0, 200));
}
