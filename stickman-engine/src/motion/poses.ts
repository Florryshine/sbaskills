/**
 * Pose construction helpers: convert rig parameters (lean, limb angles,
 * IK targets) into dense SkeletonFrame joint positions.
 */
import { limbDir, solve2Bone, add, mul, V2 } from '../rig/geometry';
import { CharStyle, SkeletonFrame } from '../rig/character';

export type ArmSpec =
  | { mode: 'fk'; sh: number; el: number }
  | { mode: 'ik'; target: V2; bend?: 1 | -1 };

export type LegSpec =
  | { mode: 'fk'; hip: number; knee: number }
  | { mode: 'ik'; foot: V2 };

export type PoseParams = {
  x: number;
  y: number;                    // pelvis position (y usually negative)
  lean: number;                 // torso lean, deg (+ = forward)
  headTilt: number;             // deg relative to torso
  facing: 1 | -1;
  /** Torso yaw in degrees around the neck pivot. Positive rotates the right
   *  shoulder forward (+x when facing=1). Used for walk/run shoulder
   *  counter-rotation and for throwing/dancing twists. */
  torsoYaw?: number;
  armL: ArmSpec;
  armR: ArmSpec;
  legL: LegSpec;
  legR: LegSpec;
};

const kneeBend = (f: 1 | -1): 1 | -1 => (f === 1 ? -1 : 1);
const elbowBend = (f: 1 | -1): 1 | -1 => f;

function solveArm(s: CharStyle, shoulder: V2, spec: ArmSpec, f: 1 | -1): { el: V2; ha: V2 } {
  if (spec.mode === 'fk') {
    const elbowDir = limbDir(spec.sh, f);
    const el = add(shoulder, mul(elbowDir, s.upperArm));
    const ha = add(el, mul(limbDir(spec.sh + spec.el, f), s.foreArm));
    return { el, ha };
  }
  const r = solve2Bone(shoulder, spec.target, s.upperArm, s.foreArm, spec.bend ?? elbowBend(f));
  return { el: r.mid, ha: r.end };
}

function solveLeg(s: CharStyle, hip: V2, spec: LegSpec, f: 1 | -1): { kn: V2; ft: V2 } {
  if (spec.mode === 'fk') {
    const kn = add(hip, mul(limbDir(spec.hip, f), s.thigh));
    const ft = add(kn, mul(limbDir(spec.hip - spec.knee, f), s.shin));
    return { kn, ft };
  }
  // foot is the ground-contact point; the skeleton ankle sits one full
  // ankle segment above it. Using only 45% of ankleH made the target
  // unreachable (thigh + shin were shorter than the pelvis-to-ankle span),
  // so the IK solver silently clamped and the feet drifted under the body.
  const ankle: V2 = [spec.foot[0], spec.foot[1] - s.ankleH];
  const r = solve2Bone(hip, ankle, s.thigh, s.shin, kneeBend(f));
  return { kn: r.mid, ft: r.end };
}

/** Build one skeleton frame from pose parameters. */
export function buildFrame(s: CharStyle, p: PoseParams): SkeletonFrame {
  const f = p.facing;
  const pel: V2 = [p.x, p.y];
  // In SVG/world coordinates, y increases downward: 270° points straight up.
  // 180° points horizontally left, which made every "upright" character's
  // torso lie sideways and created the permanently bent-waist appearance.
  // Positive lean follows the character's facing direction.
  const neck = add(pel, mul(limbDir(270 + p.lean, f), s.torso));
  const head = add(neck, mul(limbDir(270 + p.lean + p.headTilt, f), s.neck + s.headR));

  // Torso yaw rotates the shoulder offsets around the neck pivot.
  const yaw = (p.torsoYaw ?? 0) * (Math.PI / 180) * f;
  const cosY = Math.cos(yaw);
  const sinY = Math.sin(yaw);
  const shL: V2 = [neck[0] - 9 * cosY, neck[1] + 2 - 9 * sinY];
  const shR: V2 = [neck[0] + 9 * cosY, neck[1] + 2 + 9 * sinY];

  const armL = solveArm(s, shL, p.armL, f);
  const armR = solveArm(s, shR, p.armR, f);
  const legL = solveLeg(s, [pel[0] - 6, pel[1]], p.legL, f);
  const legR = solveLeg(s, [pel[0] + 6, pel[1]], p.legR, f);
  return {
    pel: [pel[0], pel[1]],
    neck: [neck[0], neck[1]],
    head: [head[0], head[1]],
    shL: [shL[0], shL[1]], shR: [shR[0], shR[1]],
    elL: [armL.el[0], armL.el[1]], elR: [armR.el[0], armR.el[1]],
    haL: [armL.ha[0], armL.ha[1]], haR: [armR.ha[0], armR.ha[1]],
    hipL: [pel[0] - 6, pel[1]], hipR: [pel[0] + 6, pel[1]],
    knL: [legL.kn[0], legL.kn[1]], knR: [legR.kn[0], legR.kn[1]],
    ftL: [legL.ft[0], legL.ft[1]], ftR: [legR.ft[0], legR.ft[1]],
  };
}

/** Standing idle pose at position x. Arms splay slightly so they read
 * separately from the torso (the reference-video look). */
export function idlePose(s: CharStyle, x: number, facing: 1 | -1, breath = 0): PoseParams {
  const y = -(s.thigh + s.shin + s.ankleH) - breath * 1.6;
  return {
    x, y, lean: 1.5, headTilt: 0, facing,
    armL: { mode: 'fk', sh: -9 + breath * 0.8, el: 7 },
    armR: { mode: 'fk', sh: 9 - breath * 0.8, el: 7 },
    legL: { mode: 'ik', foot: [x - 11, 0] },
    legR: { mode: 'ik', foot: [x + 11, 0] },
  };
}

/** Linear cross-fade between two dense skeleton streams (in place on `into`). */
export function blendInto(
  into: SkeletonFrame[],
  from: SkeletonFrame[],
  startFrame: number,
  blendFrames: number,
) {
  const n = Math.min(blendFrames, from.length, into.length - startFrame);
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const a = into[startFrame + i];
    const b = from[i];
    const mix = (p: V2, q: V2): V2 => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
    a.pel = mix(a.pel, b.pel); a.neck = mix(a.neck, b.neck); a.head = mix(a.head, b.head);
    a.shL = mix(a.shL, b.shL); a.shR = mix(a.shR, b.shR);
    a.elL = mix(a.elL, b.elL); a.elR = mix(a.elR, b.elR);
    a.haL = mix(a.haL, b.haL); a.haR = mix(a.haR, b.haR);
    a.knL = mix(a.knL, b.knL); a.knR = mix(a.knR, b.knR);
    a.ftL = mix(a.ftL, b.ftL); a.ftR = mix(a.ftR, b.ftR);
  }
}
