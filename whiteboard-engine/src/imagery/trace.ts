// src/imagery/trace.ts — raster image → drawable pen strokes + flat colour layer.
//
// Any picture (clip-art, diagram, even a photo) becomes:
//   1. a set of centre-line strokes that the existing engine draws progressively
//      (same path as hand-authored illustrations, so the pen/hand tracks them), and
//   2. a posterised colour layer that is "painted in" afterwards with a zig-zag
//      marker sweep (see DrawnStrokes.tsx).
//
// Pipeline (build time, Node, uses `sharp` which is already an SBA dependency):
//   decode → fit 480px → ink map (line-art threshold OR Sobel edges for photos)
//   → Zhang-Suen thinning → pixel-chain walk → join + RDP simplify + Chaikin
//   → nearest-neighbour pen ordering → SVG path strings.

import sharp from 'sharp';
import type { SampledPoint } from '../types';

export interface TraceOptions {
  /** Longest side of the working raster (px). Higher = finer but slower. */
  maxDim?: number;
  mode?: 'auto' | 'line' | 'photo';
  /** Longest side of the output asset box (matches the 400-unit library assets). */
  boxSize?: number;
  /** Drop chains shorter than this many pixels. */
  minChain?: number;
  /** Hard cap on strokes after joining (keeps per-stroke pen gaps cheap). */
  maxStrokes?: number;
  /** Palette size for the colour layer. */
  colors?: number;
  /** Skip the colour layer entirely. */
  noColor?: boolean;
}

export interface TracedStroke {
  d: string;
  /** polyline length in box units */
  length: number;
}

export interface TracedImage {
  box: { w: number; h: number };
  strokes: TracedStroke[];
  totalLength: number;
  mode: 'line' | 'photo';
  colorLayer?: {
    href: string; // data URI (PNG)
    w: number;
    h: number;
    /** area worth painting (box units) — tighter than the full image for clip-art */
    wash: { x: number; y: number; w: number; h: number };
  };
}

type Pt = [number, number];

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function otsu(gray: Uint8Array): number {
  const hist = new Array<number>(256).fill(0);
  for (let i = 0; i < gray.length; i++) hist[gray[i]]++;
  const total = gray.length;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0;
  let wB = 0;
  let best = 0;
  let thr = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > best) {
      best = between;
      thr = t;
    }
  }
  return thr;
}

/** Zhang-Suen thinning, in place. `img` is 0/1. */
function thin(img: Uint8Array, w: number, h: number): void {
  const toClear: number[] = [];
  let changed = true;
  let guard = 0;
  while (changed && guard++ < 60) {
    changed = false;
    for (let step = 0; step < 2; step++) {
      toClear.length = 0;
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const i = y * w + x;
          if (!img[i]) continue;
          const p2 = img[i - w];
          const p3 = img[i - w + 1];
          const p4 = img[i + 1];
          const p5 = img[i + w + 1];
          const p6 = img[i + w];
          const p7 = img[i + w - 1];
          const p8 = img[i - 1];
          const p9 = img[i - w - 1];
          const B = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
          if (B < 2 || B > 6) continue;
          const A =
            (!p2 && p3 ? 1 : 0) + (!p3 && p4 ? 1 : 0) + (!p4 && p5 ? 1 : 0) + (!p5 && p6 ? 1 : 0) +
            (!p6 && p7 ? 1 : 0) + (!p7 && p8 ? 1 : 0) + (!p8 && p9 ? 1 : 0) + (!p9 && p2 ? 1 : 0);
          if (A !== 1) continue;
          if (step === 0) {
            if (p2 * p4 * p6 !== 0 || p4 * p6 * p8 !== 0) continue;
          } else {
            if (p2 * p4 * p8 !== 0 || p2 * p6 * p8 !== 0) continue;
          }
          toClear.push(i);
        }
      }
      if (toClear.length) changed = true;
      for (const i of toClear) img[i] = 0;
    }
  }
}

const N8: Array<[number, number]> = [
  [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1],
];

/** Walk a thinned bitmap into ordered pixel chains. */
function walkChains(img: Uint8Array, w: number, h: number): Pt[][] {
  const seen = new Uint8Array(w * h);
  const deg = new Uint8Array(w * h);
  const ink = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && img[y * w + x] === 1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!img[y * w + x]) continue;
      let d = 0;
      for (const [dx, dy] of N8) if (ink(x + dx, y + dy)) d++;
      deg[y * w + x] = d;
    }
  }

  const chains: Pt[][] = [];
  const walk = (sx: number, sy: number) => {
    const chain: Pt[] = [[sx, sy]];
    seen[sy * w + sx] = 1;
    let cx = sx;
    let cy = sy;
    let dirx = 0;
    let diry = 0;
    for (;;) {
      let best = -1;
      let bestScore = -Infinity;
      for (let k = 0; k < 8; k++) {
        const nx = cx + N8[k][0];
        const ny = cy + N8[k][1];
        if (!ink(nx, ny) || seen[ny * w + nx]) continue;
        // prefer straight continuation, then 4-neighbours over diagonals
        const score = (dirx * N8[k][0] + diry * N8[k][1]) - (k % 2 === 1 ? 0.2 : 0);
        if (score > bestScore) {
          bestScore = score;
          best = k;
        }
      }
      if (best < 0) break;
      cx += N8[best][0];
      cy += N8[best][1];
      dirx = N8[best][0];
      diry = N8[best][1];
      seen[cy * w + cx] = 1;
      chain.push([cx, cy]);
    }
    return chain;
  };

  // 1) from endpoints, 2) from anything left (closed loops / junction leftovers)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (img[i] && !seen[i] && deg[i] === 1) chains.push(walk(x, y));
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (img[i] && !seen[i]) chains.push(walk(x, y));
    }
  }
  return chains;
}

function rdp(pts: Pt[], eps: number): Pt[] {
  if (pts.length < 3) return pts;
  // Closed loop (start ≈ end): the chord is degenerate, so split at the point
  // farthest from the start and simplify each half separately.
  const first = pts[0];
  const last = pts[pts.length - 1];
  if (pts.length > 8 && Math.hypot(first[0] - last[0], first[1] - last[1]) < 3) {
    let far = 1;
    let fd = 0;
    for (let i = 1; i < pts.length - 1; i++) {
      const d = Math.hypot(pts[i][0] - first[0], pts[i][1] - first[1]);
      if (d > fd) {
        fd = d;
        far = i;
      }
    }
    const a = rdpOpen(pts.slice(0, far + 1), eps);
    const b = rdpOpen(pts.slice(far), eps);
    return a.concat(b.slice(1));
  }
  return rdpOpen(pts, eps);
}

function rdpOpen(pts: Pt[], eps: number): Pt[] {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = 1;
  keep[pts.length - 1] = 1;
  const stack: Array<[number, number]> = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    let maxD = 0;
    let idx = -1;
    const [ax, ay] = pts[a];
    const [bx, by] = pts[b];
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy) || 1;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((pts[i][0] - ax) * dy - (pts[i][1] - ay) * dx) / len;
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (maxD > eps && idx > 0) {
      keep[idx] = 1;
      stack.push([a, idx], [idx, b]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

function chaikin(pts: Pt[], rounds = 1): Pt[] {
  let cur = pts;
  for (let r = 0; r < rounds; r++) {
    if (cur.length < 3) return cur;
    const out: Pt[] = [cur[0]];
    for (let i = 0; i < cur.length - 1; i++) {
      const [x0, y0] = cur[i];
      const [x1, y1] = cur[i + 1];
      out.push([x0 * 0.75 + x1 * 0.25, y0 * 0.75 + y1 * 0.25]);
      out.push([x0 * 0.25 + x1 * 0.75, y0 * 0.25 + y1 * 0.75]);
    }
    out.push(cur[cur.length - 1]);
    cur = out;
  }
  return cur;
}

function polyLen(pts: Pt[]): number {
  let L = 0;
  for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return L;
}

/** Greedy pen ordering: start top-left, always continue with the nearest chain end (reversing if needed), joining near-touching chains. */
function orderAndJoin(chains: Pt[][], joinDist: number): Pt[][] {
  const rest = chains.slice();
  if (!rest.length) return [];
  // start with the chain whose first point is closest to the top-left corner
  let startIdx = 0;
  let startScore = Infinity;
  rest.forEach((c, i) => {
    for (const p of [c[0], c[c.length - 1]]) {
      const s = p[1] * 1.6 + p[0];
      if (s < startScore) {
        startScore = s;
        startIdx = i;
      }
    }
  });
  const first = rest.splice(startIdx, 1)[0];
  if (first[0][1] * 1.6 + first[0][0] > first[first.length - 1][1] * 1.6 + first[first.length - 1][0]) first.reverse();

  const out: Pt[][] = [];
  let cur = first.slice();
  while (rest.length) {
    const end = cur[cur.length - 1];
    let bi = 0;
    let bd = Infinity;
    let brev = false;
    for (let i = 0; i < rest.length; i++) {
      const c = rest[i];
      const d0 = Math.hypot(c[0][0] - end[0], c[0][1] - end[1]);
      const d1 = Math.hypot(c[c.length - 1][0] - end[0], c[c.length - 1][1] - end[1]);
      if (d0 < bd) {
        bd = d0;
        bi = i;
        brev = false;
      }
      if (d1 < bd) {
        bd = d1;
        bi = i;
        brev = true;
      }
    }
    const next = rest.splice(bi, 1)[0];
    if (brev) next.reverse();
    if (bd <= joinDist) {
      cur = cur.concat(next); // pen keeps going — no lift
    } else {
      out.push(cur);
      cur = next;
    }
  }
  out.push(cur);
  return out;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

function toD(pts: Pt[]): string {
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${r2(p[0])} ${r2(p[1])}`).join(' ');
}

// ---------------------------------------------------------------------------
// public API
// ---------------------------------------------------------------------------

export async function traceImage(input: Buffer, opts: TraceOptions = {}): Promise<TracedImage> {
  const maxDim = opts.maxDim ?? 480;
  const boxSize = opts.boxSize ?? 400;

  const base = sharp(input, { density: 160, failOn: 'none' })
    .flatten({ background: '#ffffff' })
    .resize({ width: maxDim, height: maxDim, fit: 'inside', withoutEnlargement: false });

  const { data: rgb, info } = await base.clone().removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  const gray = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    gray[i] = Math.round(0.299 * rgb[i * 3] + 0.587 * rgb[i * 3 + 1] + 0.114 * rgb[i * 3 + 2]);
  }

  // --- mode detection: mostly-white background + few tones → line art
  let whiteish = 0;
  for (let i = 0; i < gray.length; i++) if (gray[i] > 235) whiteish++;
  const whiteFrac = whiteish / gray.length;
  const mode: 'line' | 'photo' = opts.mode && opts.mode !== 'auto' ? opts.mode : whiteFrac > 0.5 ? 'line' : 'photo';

  // --- ink map
  const ink = new Uint8Array(w * h);
  if (mode === 'line') {
    // Ink = very dark pixels, or dark *neutral* pixels (outlines / pencil).
    // Mid-tone coloured fills must NOT count, or solid fills thin into bogus
    // centre-lines and swallow the real outlines.
    const thr = Math.min(150, Math.max(90, otsu(gray)));
    for (let i = 0; i < w * h; i++) {
      const r = rgb[i * 3];
      const g = rgb[i * 3 + 1];
      const b = rgb[i * 3 + 2];
      const sat = Math.max(r, g, b) - Math.min(r, g, b);
      ink[i] = gray[i] < 80 || (gray[i] < thr && sat < 45) ? 1 : 0;
    }
  } else {
    const { data: blurRaw, info: blurInfo } = await sharp(Buffer.from(gray), { raw: { width: w, height: h, channels: 1 } })
      .blur(1.4)
      .raw()
      .toBuffer({ resolveWithObject: true });
    // sharp may hand back >1 channel; always read channel 0 with the right stride
    const ch = blurInfo.channels;
    const blurred = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) blurred[i] = blurRaw[i * ch];
    const mag = new Float32Array(w * h);
    const sorted: number[] = [];
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        const gx =
          -blurred[i - w - 1] - 2 * blurred[i - 1] - blurred[i + w - 1] +
          blurred[i - w + 1] + 2 * blurred[i + 1] + blurred[i + w + 1];
        const gy =
          -blurred[i - w - 1] - 2 * blurred[i - w] - blurred[i - w + 1] +
          blurred[i + w - 1] + 2 * blurred[i + w] + blurred[i + w + 1];
        const m = Math.hypot(gx, gy);
        mag[i] = m;
        sorted.push(m);
      }
    }
    sorted.sort((a, b) => a - b);
    const thr = sorted[Math.floor(sorted.length * 0.9)] || 1; // keep the strongest ~10% of edges
    for (let i = 0; i < w * h; i++) ink[i] = mag[i] >= thr ? 1 : 0;
  }
  // frame the raster edge so borders do not become strokes
  for (let x = 0; x < w; x++) {
    ink[x] = 0;
    ink[(h - 1) * w + x] = 0;
  }
  for (let y = 0; y < h; y++) {
    ink[y * w] = 0;
    ink[y * w + w - 1] = 0;
  }

  thin(ink, w, h);

  // --- chains → cleaned polylines
  const minChain = opts.minChain ?? (mode === 'line' ? 10 : 16);
  const raw = walkChains(ink, w, h).filter((c) => c.length >= minChain);
  const s = boxSize / Math.max(w, h);
  const boxW = r2(w * s);
  const boxH = r2(h * s);

  let cleaned: Pt[][] = raw.map((c) => chaikin(rdp(c, 1.3), 1).map(([x, y]) => [x * s, y * s] as Pt));
  cleaned = orderAndJoin(cleaned, 26 * s * 1.2);

  // cap stroke count, keeping the longest (but preserving drawing order)
  const maxStrokes = opts.maxStrokes ?? 70;
  if (cleaned.length > maxStrokes) {
    const keepSet = new Set(
      cleaned
        .map((c, i) => ({ i, L: polyLen(c) }))
        .sort((a, b) => b.L - a.L)
        .slice(0, maxStrokes)
        .map((e) => e.i),
    );
    cleaned = cleaned.filter((_, i) => keepSet.has(i));
  }

  const strokes: TracedStroke[] = cleaned.map((c) => ({ d: toD(c), length: r2(polyLen(c)) }));
  const totalLength = Math.round(strokes.reduce((a, b) => a + b.length, 0));

  // --- colour layer
  let colorLayer: TracedImage['colorLayer'];
  if (!opts.noColor) {
    // Preserve the source image's full colour information. Palette quantisation
    // made the paint layer visibly posterised / nearly monochrome on some assets.
    // This changes only colour-layer encoding; the ink detection and tracing
    // pipeline above remains untouched.
    const { data: smooth } = await base.clone().median(3).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const rgba = Buffer.alloc(w * h * 4);
    let minX = w, minY = h, maxX = 0, maxY = 0;
    for (let i = 0; i < w * h; i++) {
      const r = smooth[i * 3];
      const g = smooth[i * 3 + 1];
      const b = smooth[i * 3 + 2];
      const isBg = mode === 'line' && r > 240 && g > 240 && b > 240;
      rgba[i * 4] = r;
      rgba[i * 4 + 1] = g;
      rgba[i * 4 + 2] = b;
      rgba[i * 4 + 3] = isBg ? 0 : 255;
      if (!isBg) {
        const x = i % w;
        const y = (i / w) | 0;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
    if (maxX < minX) {
      minX = 0; minY = 0; maxX = w - 1; maxY = h - 1;
    }
    const png = await sharp(rgba, { raw: { width: w, height: h, channels: 4 } })
      .png({ compressionLevel: 9 })
      .toBuffer();
    colorLayer = {
      href: `data:image/png;base64,${png.toString('base64')}`,
      w: boxW,
      h: boxH,
      wash: {
        x: r2(minX * s),
        y: r2(minY * s),
        w: r2((maxX - minX + 1) * s),
        h: r2((maxY - minY + 1) * s),
      },
    };
  }

  return { box: { w: boxW, h: boxH }, strokes, totalLength, mode, colorLayer };
}
