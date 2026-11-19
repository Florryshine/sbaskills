// Visual asset file storage.
// Sandbox: files live under public/visual-assets/ so Next.js serves them
// directly AND the Remotion render bundle can reach them via staticFile()
// (exactly the same pattern as cartoon narration audio).
// Production (sbaskills): the same relative paths become Supabase Storage
// paths inside the `visual-assets` bucket; only this file changes.
import fs from "fs";
import path from "path";
import crypto from "crypto";

export const ASSETS_PUBLIC_DIR = path.join(process.cwd(), "public", "visual-assets");
export const ASSETS_URL_ROOT = "/visual-assets";

export const MIME_BY_EXT: Record<string, string> = {
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  glb: "model/gltf-binary",
  gltf: "model/gltf+json",
};

export function extFromMime(mime: string): string {
  const found = Object.entries(MIME_BY_EXT).find(([, m]) => m === mime);
  return found ? found[0] : mime.split("/")[1]?.split(";")[0] || "bin";
}

export function sha256(buf: Buffer | string): string {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

export function slugify(name: string): string {
  return name.toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "asset";
}

/** Write an asset file; returns {filePath (public-relative), publicUrl, size}. */
export function writeAssetFile(slug: string, ext: string, data: Buffer): { filePath: string; publicUrl: string; size: number } {
  fs.mkdirSync(ASSETS_PUBLIC_DIR, { recursive: true });
  const fileName = `${slug}.${ext}`;
  fs.writeFileSync(path.join(ASSETS_PUBLIC_DIR, fileName), data);
  return {
    filePath: `visual-assets/${fileName}`,
    publicUrl: `${ASSETS_URL_ROOT}/${fileName}`,
    size: data.length,
  };
}

/** True when the stored file really exists on disk (integrity check). */
export function assetFileExists(filePath: string): boolean {
  return fs.existsSync(path.join(process.cwd(), "public", filePath));
}

export function deleteAssetFile(filePath: string): void {
  const p = path.join(process.cwd(), "public", filePath);
  fs.rmSync(p, { force: true });
}

/** Measure an SVG's intrinsic size from its viewBox/width/height. */
export function svgDimensions(svg: string): { w: number; h: number } | null {
  const vb = svg.match(/viewBox\s*=\s*["']\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i);
  if (vb) return { w: Math.round(+vb[3]), h: Math.round(+vb[4]) };
  const wm = svg.match(/width\s*=\s*["'](\d+)/i);
  const hm = svg.match(/height\s*=\s*["'](\d+)/i);
  if (wm && hm) return { w: +wm[1], h: +hm[1] };
  return null;
}
