// geometry.ts — 2D vector + trig helpers used by the rig and motion modules.
export type V2 = [number, number];
export const add = (a: V2, b: V2): V2 => [a[0] + b[0], a[1] + b[1]];
export const mul = (v: V2, k: number): V2 => [v[0] * k, v[1] * k];
export const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

/**
 * Short-arc angular interpolation in degrees. Handles wraparound so that
 * lerpAngle(350, 10, 0.5) === 0, not 180. Used by walk.ts for torso yaw
 * across the ±180 boundary, and by future facial animations.
 */
export const lerpAngle = (a: number, b: number, t: number): number => {
  const diff = ((b - a) % 360 + 540) % 360 - 180;
  return a + diff * t;
};

// Convert an angle (deg, 0 = +x) and optional facing (-1 flips x) to a unit vector.
export const limbDir = (angleDeg: number, facing: 1 | -1 = 1): V2 => {
  const r = (angleDeg * Math.PI) / 180;
  return [Math.cos(r) * facing, Math.sin(r)];
};

// 2-bone IK: solve from `start` to `end` with bones of lengths L1, L2.
// `bend` picks which of the two knee/elbow solutions to use (+1 or -1).
export function solve2Bone(start: V2, end: V2, L1: number, L2: number, bend: 1 | -1 = 1): { mid: V2; end: V2; reachable: boolean } {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const dist = Math.hypot(dx, dy);
  const minDist = Math.abs(L1 - L2) + 0.001;
  const maxDist = L1 + L2 - 0.001;
  const reachable = dist <= maxDist && dist >= minDist;
  const d = clamp(dist, minDist, maxDist);
  const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
  const ux = dx / (dist || 1);
  const uy = dy / (dist || 1);
  const px = start[0] + ux * a;
  const py = start[1] + uy * a;
  const mid: V2 = [px + bend * h * -uy, py + bend * h * ux];
  return { mid, end: [start[0] + ux * d, start[1] + uy * d], reachable };
}

/**
 * Create a deterministic pseudo-random number generator for scene decoration.
 * A fresh generator with the same seed produces the same sequence, which keeps
 * Remotion renders reproducible when it evaluates frames out of order.
 */
export function rng(seed: number): () => number {
  let state = (Number.isFinite(seed) ? Math.trunc(seed) : 0) >>> 0;

  return () => {
    // Mulberry32: compact, fast, deterministic 32-bit PRNG.
    state = (state + 0x6D2B79F5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
