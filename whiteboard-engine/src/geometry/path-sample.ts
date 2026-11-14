// src/geometry/path-sample.ts — build-time SVG path sampling + draw scheduling.
//
// All progressive drawing in the engine is driven by these sampled polylines:
// the Remotion renderer only animates strokeDashoffset against `length` and
// reads `points` for the pen tip — zero runtime geometry.

import pointAtLengthFactory from 'point-at-length';
import type { SampledIllustration, SampledPoint, SampledStroke, StrokeSpec } from '../types';

type PointAtLengthInstance = {
  at(t: number): [number, number];
  length(): number;
};
type PointAtLengthFactory = (d: string) => PointAtLengthInstance;

const pal = pointAtLengthFactory as unknown as PointAtLengthFactory;

/** Sample an SVG path into a dense polyline. */
export function samplePath(d: string, step = 4): { points: SampledPoint[]; length: number } {
  const instance = pal(d);
  const length = instance.length();
  const n = Math.max(2, Math.ceil(length / step));
  const points: SampledPoint[] = [];
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * length;
    const [x, y] = instance.at(t);
    points.push({ x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 });
  }
  return { points, length: Math.round(length * 100) / 100 };
}

/** Sample an illustration's stroke specs into render-ready geometry. */
export function sampleIllustration(
  spec: { id: string; strokes: StrokeSpec[]; labels?: import('../types').LabelSpec[]; box: { w: number; h: number } },
  resolveColor: (c?: string) => string,
): SampledIllustration {
  const strokes: SampledStroke[] = spec.strokes.map((s) => {
    const { points, length } = samplePath(s.d);
    return {
      points,
      length,
      width: s.width ?? 3.5,
      color: resolveColor(s.color),
      fill: s.fill ? resolveColor(s.fill) : undefined,
      fillOpacity: s.fillOpacity ?? 0.14,
      afterStroke: s.afterStroke,
    };
  });
  const totalLength = strokes.reduce((a, s) => a + s.length, 0);
  return {
    id: spec.id,
    strokes,
    labels: spec.labels ?? [],
    totalLength: Math.round(totalLength),
    box: spec.box,
  };
}

/**
 * Schedule strokes within a draw duration.
 * Each stroke gets a time slice proportional to its length, with a tiny
 * gap between strokes (pen lifts). Respects `afterStroke` dependencies.
 */
export function scheduleStrokes(strokes: SampledStroke[], drawDuration: number, gapSeconds = 0.05): void {
  const n = strokes.length;
  if (n === 0) return;
  if (n === 1) {
    strokes[0].start = 0;
    strokes[0].duration = drawDuration;
    return;
  }
  const totalLen = strokes.reduce((a, s) => a + s.length, 0) || 1;
  const gapTotal = gapSeconds * (n - 1);
  const drawTime = Math.max(0.2, drawDuration - gapTotal);
  let t = 0;
  const done = new Array<boolean>(n).fill(false);
  // simple pass — afterStroke chains are shallow (1 level) in our library
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 0; i < n; i++) {
      if (done[i]) continue;
      const dep = strokes[i].afterStroke;
      if (dep !== undefined && !done[dep]) continue;
      const share = strokes[i].length / totalLen;
      const dur = Math.max(0.06, share * drawTime);
      strokes[i].start = t;
      strokes[i].duration = dur;
      t += dur + gapSeconds;
      done[i] = true;
    }
  }
  // anything unscheduled (deep chains) gets appended
  for (let i = 0; i < n; i++) {
    if (!done[i]) {
      const stroke = strokes[i];
      if (!stroke) continue;
      stroke.start = t;
      stroke.duration = Math.max(0.1, (stroke.length / totalLen) * drawTime);
      t += stroke.duration + gapSeconds;
    }
  }
}

/** Point on a sampled stroke at a given length along it. */
export function pointOnStroke(stroke: SampledStroke, alongLength: number): SampledPoint {
  const pts = stroke.points;
  if (pts.length === 0) return { x: 0, y: 0 };
  if (pts.length === 1) return pts[0];
  const clamped = Math.max(0, Math.min(stroke.length, alongLength));
  const step = stroke.length / (pts.length - 1);
  const idx = clamped / step;
  const i0 = Math.min(pts.length - 1, Math.floor(idx));
  const i1 = Math.min(pts.length - 1, i0 + 1);
  const frac = idx - i0;
  return {
    x: pts[i0].x + (pts[i1].x - pts[i0].x) * frac,
    y: pts[i0].y + (pts[i1].y - pts[i0].y) * frac,
  };
}

/**
 * Pen tip for a sampled illustration at a given elapsed time (element-local).
 * Returns null when nothing is being drawn at that moment.
 */
export function penTipAt(ill: SampledIllustration, elapsed: number): SampledPoint | null {
  for (const s of ill.strokes) {
    const st = s.start ?? 0;
    const du = s.duration ?? 0.3;
    if (elapsed >= st && elapsed <= st + du) {
      const p = Math.max(0, Math.min(1, (elapsed - st) / du));
      return pointOnStroke(s, p * s.length);
    }
  }
  return null;
}

/** Render-ready `d` string reconstructed from a sampled polyline. */
export function pointsToD(points: SampledPoint[]): string {
  if (points.length === 0) return '';
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) d += ` L ${points[i].x} ${points[i].y}`;
  return d;
}
