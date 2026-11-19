// Probe the Remotion internal static server: what does it return for an
// .svg file in the bundled public dir — status + content-type?
import { RenderInternals } from "@remotion/renderer";
import fs from "fs";

const bundleLoc = fs.readdirSync("/tmp").filter((d) => d.startsWith("remotion-webpack-bundle-KwH9GO")).map((d) => `/tmp/${d}`)[0];
if (!bundleLoc || !fs.existsSync(bundleLoc)) { console.error("bundle missing"); process.exit(1); }

const { port, close } = await RenderInternals.serveStatic(bundleLoc, { port: "3123" });
const url = `http://localhost:${port}`;
console.log("server on", url);
const targets = ["visual-assets/sunflower.svg", "public/visual-assets/sunflower.svg", "cartoon-media"];
for (const t of targets) {
  const res = await fetch(url + "/" + t);
  const ct = res.headers.get("content-type");
  const body = await res.text();
  console.log(t, "->", res.status, "| content-type:", ct, "| starts:", body.slice(0, 60).replace(/\n/g, " "));
}
await close();
process.exit(0);
