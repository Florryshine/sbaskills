// src/geometry/wash.ts — zig-zag marker path used to paint a colour layer in.

import type { SampledPoint } from '../types';

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Zig-zag marker path covering `wash`, used to paint the colour layer in.
 * Returned in box units; `width` is the brush width (slightly > spacing so
 * sweeps overlap and leave no gaps).
 */
export function buildWashPath(
  wash: { x: number; y: number; w: number; h: number },
  spacing = 30,
): { points: SampledPoint[]; length: number; width: number } {
  const rows = Math.max(2, Math.ceil(wash.h / spacing));
  const step = wash.h / rows;
  const pad = 6;
  const pts: SampledPoint[] = [];
  for (let r = 0; r <= rows; r++) {
    const y = wash.y + Math.min(wash.h, r * step);
    const left = wash.x - pad;
    const right = wash.x + wash.w + pad;
    const [a, b] = r % 2 === 0 ? [left, right] : [right, left];
    // sample each sweep so the pen tip moves smoothly
    const n = Math.max(2, Math.ceil(Math.abs(b - a) / 12));
    for (let i = 0; i <= n; i++) {
      pts.push({ x: r2(a + ((b - a) * i) / n), y: r2(y) });
    }
  }
  let length = 0;
  for (let i = 1; i < pts.length; i++) length += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  return { points: pts, length: r2(length), width: spacing * 1.55 };
}
