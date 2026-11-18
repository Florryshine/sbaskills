/**
 * Geometry, IK and interpolation primitives for the stickman engine.
 * Pure functions, no dependencies - everything downstream is deterministic.
 */

export type V2 = [number, number];

export const rad = (deg: number) => (deg * Math.PI) / 180;

export function add(a: V2, b: V2): V2 { return [a[0] + b[0], a[1] + b[1]]; }
export function sub(a: V2, b: V2): V2 { return [a[0] - b[0], a[1] - b[1]]; }
export function mul(a: V2, s: number): V2 { return [a[0] * s, a[1] * s]; }
export function len(a: V2): number { return Math.hypot(a[0], a[1]); }
export function dist(a: V2, b: V2): number { return Math.hypot(a[0] - b[0], a[1] - b[1]); }
export function norm(a: V2): V2 { const l = len(a) || 1; return [a[0] / l, a[1] / l]; }
export function lerp(a: number, b: number, t: number): number { return a + (b - a) * t; }
export function lerpV2(a: V2, b: V2, t: number): V2 {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
}
export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** Rotate a unit-downward direction by `deg` (positive = toward facing direction). */
export function limbDir(deg: number, facing: 1 | -1): V2 {
  const r = rad(deg);
  return [Math.sin(r) * facing, Math.cos(r)];
}

/**
 * Analytic two-bone IK (law of cosines).
 * Returns the middle joint (knee / elbow) and the chain end clamped to reach.
 * bendSign: +1 puts the middle joint on one side of the root->target line,
 * -1 on the other. For legs (hip->foot) use the sign that pushes the knee
 * forward; for arms choose the sign matching the elbow curl.
 */
export function solve2Bone(
  root: V2,
  target: V2,
  l1: number,
  l2: number,
  bendSign: 1 | -1,
): { mid: V2; end: V2; reachable: boolean } {
  const d = sub(target, root);
  let dl = len(d);
  const reachable = dl <= l1 + l2;
  dl = clamp(dl, Math.abs(l1 - l2) + 0.001, l1 + l2 - 0.001);
  const dir = norm(d);
  // angle at root between (root->target) and the l1 bone
  const cosA = clamp((l1 * l1 + dl * dl - l2 * l2) / (2 * l1 * dl), -1, 1);
  const a = Math.acos(cosA);
  // perpendicular of dir
  const perp: V2 = [-dir[1], dir[0]];
  const mid = add(root, add(mul(dir, l1 * Math.cos(a)), mul(perp, l1 * Math.sin(a) * bendSign)));
  // end recomputed along mid->target at length l2 (guaranteed exact)
  const endDir = norm(sub(target, mid));
  const end = add(mid, mul(endDir, l2));
  return { mid, end, reachable };
}

/** Deterministic seeded PRNG (mulberry32) so environments are reproducible. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------- easing ----------------

export type EaseFn = (t: number) => number;
export const linear: EaseFn = (t) => t;
export const easeIn: EaseFn = (t) => t * t;
export const easeOut: EaseFn = (t) => 1 - (1 - t) * (1 - t);
export const easeInOut: EaseFn = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
export const easeOutBack: EaseFn = (t) => {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
export const easeOutElastic: EaseFn = (t) => {
  const c4 = (2 * Math.PI) / 3;
  if (t === 0 || t === 1) return t;
  return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
};

export function ease(name: string): EaseFn {
  switch (name) {
    case 'in': return easeIn;
    case 'out': return easeOut;
    case 'inOut': return easeInOut;
    case 'back': return easeOutBack;
    case 'elastic': return easeOutElastic;
    default: return easeInOut;
  }
}

/**
 * Critically-damped spring smoothing toward a target - used for camera
 * tracking so follows feel organic without overshoot chaos.
 */
export function springStep(pos: number, vel: number, target: number, dt: number, stiffness = 90, damping = 14): [number, number] {
  const accel = (target - pos) * stiffness - vel * damping;
  const nv = vel + accel * dt;
  return [pos + nv * dt, nv];
}
