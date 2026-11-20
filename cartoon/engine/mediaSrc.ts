// URL resolution for media inside the engine.
// Works in BOTH the Next.js Player (public root served at /) and the
// server render bundle (files under the bundle's /public prefix).
// Absolute URLs (Supabase Storage, stock CDN) pass through unchanged.
import { staticFile } from "remotion";

export function mediaSrc(url: string): string {
  if (/^(https?:|blob:|data:)/.test(url)) return url;
  return staticFile(url.replace(/^\//, ""));
}
