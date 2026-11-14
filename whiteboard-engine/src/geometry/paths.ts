// src/geometry/paths.ts — SVG path d-string builders with a hand-drawn feel.
//
// Every illustration in the engine is a set of these strokes. The builders add
// subtle deterministic wobble so straight lines and circles read as marker
// strokes on a board rather than CAD output.

/** Deterministic PRNG (mulberry32) — wobble must be stable across renders. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const f = (n: number) => Math.round(n * 100) / 100;

/** Hand-drawn line: slight bow + endpoint jitter. */
export function sketchLine(x1: number, y1: number, x2: number, y2: number, seed = 1, bow = 4, jitter = 1.6): string {
  const r = rng(seed * 7919 + 13);
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  // perpendicular unit
  const px = -dy / len;
  const py = dx / len;
  const j1 = (r() - 0.5) * 2 * jitter;
  const j2 = (r() - 0.5) * 2 * jitter;
  const midBow = ((r() - 0.5) * 2 * bow * Math.min(1, len / 300)) as number;
  const mx = (x1 + x2) / 2 + px * midBow;
  const my = (y1 + y2) / 2 + py * midBow;
  return `M ${f(x1 + j1)} ${f(y1 + j1 * 0.6)} Q ${f(mx)} ${f(my)} ${f(x2 + j2)} ${f(y2 + j2 * 0.6)}`;
}

/** Hand-drawn polyline through points (each segment gets its own bow). */
export function sketchPolyline(points: Array<[number, number]>, seed = 1, close = false): string {
  const parts: string[] = [];
  const n = points.length;
  const end = close ? n : n - 1;
  for (let i = 0; i < end; i++) {
    const a = points[i];
    const b = points[(i + 1) % n];
    parts.push(sketchLine(a[0], a[1], b[0], b[1], seed + i * 31, 3.2, 1.4));
  }
  return parts.join(' ');
}

/** Hand-drawn polygon (closed polyline). */
export function sketchPolygon(points: Array<[number, number]>, seed = 1): string {
  return sketchPolyline(points, seed, true);
}

/** Hand-drawn circle — delegates to sketchEllipse (bezier control points there are exact). */
export function sketchCircle(cx: number, cy: number, r: number, seed = 1): string {
  return sketchEllipse(cx, cy, r, r, seed, 0);
}

/** Hand-drawn ellipse (rx along x, ry along y, optional rotation in degrees). */
export function sketchEllipse(cx: number, cy: number, rx: number, ry: number, seed = 1, rotDeg = 0): string {
  const rot = (rotDeg * Math.PI) / 180;
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  const P = (px: number, py: number): [number, number] => [cx + px * cos - py * sin, cy + px * sin + py * cos];
  const r0 = rng(seed * 15485863 + 3);
  const wob = () => 1 + (r0() - 0.5) * 0.05;
  const rx1 = rx * wob();
  const ry1 = ry * wob();
  const K = 0.5523;
  const right = P(rx1, 0);
  const bottom = P(0, ry1);
  const left = P(-rx1, 0);
  const top = P(0, -ry1);
  const cRB = P(rx1, ry1 * K);
  const cBR = P(rx1 * K, ry1);
  const cBL = P(-rx1 * K, ry1);
  const cLB = P(-rx1, ry1 * K);
  const cLT = P(-rx1, -ry1 * K);
  const cTL = P(-rx1 * K, -ry1);
  const cTR = P(rx1 * K, -ry1);
  const cRT = P(rx1, -ry1 * K);
  return (
    `M ${f(right[0])} ${f(right[1])}` +
    ` C ${f(cRB[0])} ${f(cRB[1])} ${f(cBR[0])} ${f(cBR[1])} ${f(bottom[0])} ${f(bottom[1])}` +
    ` C ${f(cBL[0])} ${f(cBL[1])} ${f(cLB[0])} ${f(cLB[1])} ${f(left[0])} ${f(left[1])}` +
    ` C ${f(cLT[0])} ${f(cLT[1])} ${f(cTL[0])} ${f(cTL[1])} ${f(top[0])} ${f(top[1])}` +
    ` C ${f(cTR[0])} ${f(cTR[1])} ${f(cRT[0])} ${f(cRT[1])} ${f(right[0])} ${f(right[1])}`
  );
}

/** Simple bezier curve through explicit control points (no wobble). */
export function cubic(x1: number, y1: number, c1x: number, c1y: number, c2x: number, c2y: number, x2: number, y2: number): string {
  return `M ${f(x1)} ${f(y1)} C ${f(c1x)} ${f(c1y)} ${f(c2x)} ${f(c2y)} ${f(x2)} ${f(y2)}`;
}

export function quad(x1: number, y1: number, cx: number, cy: number, x2: number, y2: number): string {
  return `M ${f(x1)} ${f(y1)} Q ${f(cx)} ${f(cy)} ${f(x2)} ${f(y2)}`;
}

/** Smooth wave along a horizontal span (used for water, speech, etc.). */
export function wave(x1: number, y1: number, x2: number, y2: number, waves = 4, amp = 6, seed = 1): string {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const px = -uy;
  const py = ux;
  const r = rng(seed * 2654435 + 11);
  const seg = len / (waves * 2);
  let d = `M ${f(x1)} ${f(y1)}`;
  for (let i = 0; i < waves * 2; i++) {
    const t1 = (i + 0.5) * seg;
    const t2 = (i + 1) * seg;
    const sign = i % 2 === 0 ? 1 : -1;
    const a = amp * sign * (0.85 + r() * 0.3);
    const cx = x1 + ux * t1 + px * a;
    const cy = y1 + uy * t1 + py * a;
    const ex = x1 + ux * t2;
    const ey = y1 + uy * t2;
    d += ` Q ${f(cx)} ${f(cy)} ${f(ex)} ${f(ey)}`;
  }
  return d;
}

/** Arrowhead as two short strokes at (x,y) pointing along angle (radians). */
export function arrowHead(x: number, y: number, angle: number, size = 14, seed = 1): string {
  const a1 = angle + Math.PI * 0.82;
  const a2 = angle - Math.PI * 0.82;
  return (
    sketchLine(x, y, x + Math.cos(a1) * size, y + Math.sin(a1) * size, seed) +
    ' ' +
    sketchLine(x, y, x + Math.cos(a2) * size, y + Math.sin(a2) * size, seed + 5)
  );
}

/** Straight hand-drawn arrow: shaft + head, returns {shaft, head}. */
export function straightArrow(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  seed = 1,
  headSize = 14,
): { shaft: string; head: string; angle: number } {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  // pull shaft back so it doesn't poke through the head
  const back = 3;
  const shaft = sketchLine(x1, y1, x2 - Math.cos(angle) * back, y2 - Math.sin(angle) * back, seed, 3, 1.2);
  const head = arrowHead(x2, y2, angle, headSize, seed + 3);
  return { shaft, head, angle };
}

/** Gentle curved arrow (quadratic bow perpendicular to the line). */
export function curvedArrow(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  seed = 1,
  bow = 0.18,
  headSize = 14,
): { shaft: string; head: string; angle: number } {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const angle = Math.atan2(dy, dx);
  const len = Math.hypot(dx, dy) || 1;
  const px = -dy / len;
  const py = dx / len;
  const r = rng(seed * 6151 + 29);
  const bowAmt = len * bow * (r() > 0.5 ? 1 : 1); // consistent side
  const cx = (x1 + x2) / 2 + px * bowAmt;
  const cy = (y1 + y2) / 2 + py * bowAmt;
  const shaft = `M ${f(x1)} ${f(y1)} Q ${f(cx)} ${f(cy)} ${f(x2 - Math.cos(angle) * 4)} ${f(y2 - Math.sin(angle) * 4)}`;
  const head = arrowHead(x2, y2, angle, headSize, seed + 3);
  return { shaft, head, angle };
}
