import { bundle } from "@remotion/bundler";
import { prepareServer } from "@remotion/renderer";
import path from "path";
const ROOT = "/home/z/my-project";
const loc = await bundle({ entryPoint: path.join(ROOT, "remotion/index.jsx"), publicDir: path.join(ROOT, "public"), onProgress: () => {} });
const server = await prepareServer({ webpackConfigOrServeUrl: loc, remotionRoot: ROOT });
console.log("server:", server.url);
for (const p of [`/cartoon-media/cmwichrzl0003m203jyhkkuqf/s1.wav`, `/audio/music-happy.mp3`, `/fonts/baloo2.ttf`]) {
  try {
    const res = await fetch(server.url + p);
    console.log(p, "->", res.status, res.headers.get("content-type"));
  } catch (e) { console.log(p, "ERR", e.message); }
}
process.exit(0);
