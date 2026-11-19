import { bundle } from "@remotion/bundler";
import { prepareServer } from "@remotion/renderer";
import path from "path";
const ROOT = "/home/z/my-project";
const bundleLoc = await bundle({ entryPoint: path.join(ROOT, "remotion/index.jsx"), publicDir: path.join(ROOT, "public"), onProgress: () => {} });
const server = await prepareServer({ serveUrl: bundleLoc, port: 0 });
console.log("serving at", server.url);
for (const p of ["/audio/music-curious.mp3", "/fonts/baloo2.ttf"]) {
  const res = await fetch(server.url + p);
  console.log(p, res.status, res.headers.get("content-type"), (await res.arrayBuffer()).byteLength);
}
await server.close();
process.exit(0);
