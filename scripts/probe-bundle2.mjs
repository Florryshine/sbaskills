import { bundle } from "@remotion/bundler";
import path from "path";
const ROOT = "/home/z/my-project";
const loc = await bundle({ entryPoint: path.join(ROOT, "remotion/index.jsx"), publicDir: path.join(ROOT, "public"), onProgress: () => {} });
console.log("bundle:", loc);
const { execSync } = await import("child_process");
console.log(execSync(`ls ${loc}`).toString());
console.log(execSync(`ls ${loc}/public 2>/dev/null | head`).toString() || "no public dir");
console.log(execSync(`ls ${loc}/cartoon-media 2>/dev/null | head`).toString() || "no cartoon-media at root");
