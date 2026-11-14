// src/illustrations/helpers.ts — organic shape builders used by the asset library.

import { sketchLine, sketchPolygon, sketchPolyline, sketchCircle, rng } from '../geometry/paths';

const f = (n: number) => Math.round(n * 100) / 100;

/**
 * Smooth closed organic blob (Catmull-Rom through wobbled ellipse points).
 * Used for canopies, cells, brains, clouds — anything organic.
 */
export function blob(cx: number, cy: number, rx: number, ry: number, seed = 1, bumps = 9, amp = 0.09, rot = 0): string {
  const r = rng(seed * 31337 + 17);
  const pts: Array<[number, number]> = [];
  const cos = Math.cos((rot * Math.PI) / 180);
  const sin = Math.sin((rot * Math.PI) / 180);
  for (let i = 0; i < bumps; i++) {
    const ang = (i / bumps) * Math.PI * 2;
    const w = 1 + (r() - 0.5) * 2 * amp;
    const px = Math.cos(ang) * rx * w;
    const py = Math.sin(ang) * ry * w;
    pts.push([cx + px * cos - py * sin, cy + px * sin + py * cos]);
  }
  // Catmull-Rom to cubic bezier (closed)
  const n = pts.length;
  let d = `M ${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${f(c1x)} ${f(c1y)} ${f(c2x)} ${f(c2y)} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d;
}

/** Leaf shape: outline (two curves base->tip->base) + midrib. */
export function leaf(
  baseX: number,
  baseY: number,
  tipX: number,
  tipY: number,
  halfWidth: number,
  seed = 1,
): { outline: string; midrib: string } {
  const dx = tipX - baseX;
  const dy = tipY - baseY;
  const len = Math.hypot(dx, dy) || 1;
  const px = -dy / len;
  const py = dx / len;
  const mx = (baseX + tipX) / 2;
  const my = (baseY + tipY) / 2;
  const r = rng(seed * 8191 + 5);
  const w1 = halfWidth * (0.9 + r() * 0.25);
  const outline =
    `M ${f(baseX)} ${f(baseY)}` +
    ` Q ${f(mx + px * w1)} ${f(my + py * w1)} ${f(tipX)} ${f(tipY)}` +
    ` Q ${f(mx - px * w1)} ${f(my - py * w1)} ${f(baseX)} ${f(baseY)}`;
  const midrib = sketchLine(baseX, baseY, tipX, tipY, seed + 9, 2.5, 1);
  return { outline, midrib };
}

/** Hand-drawn rectangle (sharp corners, wobbled edges). */
export function rect(x: number, y: number, w: number, h: number, seed = 1): string {
  return sketchPolygon(
    [
      [x, y],
      [x + w, y],
      [x + w, y + h],
      [x, y + h],
    ],
    seed,
  );
}

/** Hand-drawn rounded-ish rect (corners slightly rounded via short diagonals). */
export function rrect(x: number, y: number, w: number, h: number, seed = 1, r = 10): string {
  return sketchPolygon(
    [
      [x + r, y],
      [x + w - r, y],
      [x + w, y + r],
      [x + w, y + h - r],
      [x + w - r, y + h],
      [x + r, y + h],
      [x, y + h - r],
      [x, y + r],
    ],
    seed,
  );
}

/** Radial hatch ticks along a line (used for walls, ground, ceiling). */
export function hatches(x1: number, y1: number, x2: number, y2: number, count = 8, len = 12, seed = 1): string {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = Math.hypot(dx, dy) || 1;
  const ux = dx / len2;
  const uy = dy / len2;
  const px = -uy;
  const py = ux;
  const parts: string[] = [];
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count;
    const bx = x1 + dx * t;
    const by = y1 + dy * t;
    parts.push(sketchLine(bx, by, bx + px * len + ux * len * 0.4, by + py * len + uy * len * 0.4, seed + i, 2, 0.8));
  }
  return parts.join(' ');
}

/** Zigzag spring between two points. */
export function spring(x1: number, y1: number, x2: number, y2: number, coils = 7, amp = 16, seed = 1): string {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const px = -uy;
  const py = ux;
  const pts: Array<[number, number]> = [[x1, y1]];
  for (let i = 0; i < coils * 2; i++) {
    const t = (i + 1) / (coils * 2 + 1);
    const sign = i % 2 === 0 ? 1 : -1;
    pts.push([x1 + dx * t + px * amp * sign, y1 + dy * t + py * amp * sign]);
  }
  pts.push([x2, y2]);
  return sketchPolyline(pts, seed);
}

/** 5-point star as polygon points. */
export function starPoints(cx: number, cy: number, outer: number, inner: number, rotDeg = -90): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const ang = ((rotDeg + i * 36) * Math.PI) / 180;
    pts.push([cx + Math.cos(ang) * r, cy + Math.sin(ang) * r]);
  }
  return pts;
}

/** Arc as a dense polyline (point-at-length gives zero length for `A` commands). */
export function dashedArc(cx: number, cy: number, r: number, a1Deg: number, a2Deg: number, seed = 1, segments = 36): string {
  void seed;
  const a1 = (a1Deg * Math.PI) / 180;
  const a2 = (a2Deg * Math.PI) / 180;
  const n = Math.max(4, segments);
  const pts: Array<[number, number]> = [];
  for (let i = 0; i <= n; i++) {
    const a = a1 + ((a2 - a1) * i) / n;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return sketchPolyline(pts, seed, false);
}

export { sketchCircle, sketchLine, sketchPolygon, sketchPolyline };
