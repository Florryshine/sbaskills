import { bundle } from "@remotion/bundler";
import path from "path";
const ROOT = "/home/z/my-project";
const loc = await bundle({ entryPoint: path.join(ROOT, "remotion/index.jsx"), publicDir: path.join(ROOT, "public"), onProgress: () => {} });
console.log("BUNDLE:", loc);
