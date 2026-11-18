/**
 * Procedural walk / run cycle generator with pinned stance feet
 * (feet cannot slide by construction - contacts are world-fixed).
 */
import { clamp, easeInOut, lerp, V2 } from '../rig/geometry';
import { CharStyle, SkeletonFrame } from '../rig/character';
import { buildFrame, idlePose, blendInto, PoseParams } from './poses';
import { makeIdle } from './idle';

export type WalkOpts = {
  from: number;
  to: number;
  speed: number;          // world px / second
  startFrame: number;
  frames: number;
  fps: number;
  /** if provided, hands are IK'd to these callbacks each frame (pushing while walking) */
  handTargets?: [(x: number, t: number) => [number, number], (x: number, t: number) => [number, number]] | null;
  lean?: number;
};

/**
 * Dense skeleton frames for a walk or run between two x positions.
 * Whole-step arithmetic keeps every plant inside the distance; a short
 * cross-fade at entry and exit hides the gait <-> stance transitions.
 */
export function makeWalk(s: CharStyle, o: WalkOpts): { frames: SkeletonFrame[]; arrivalFrame: number } {
  const fps = o.fps;
  const facing: 1 | -1 = o.to >= o.from ? 1 : -1;
  const distance = Math.abs(o.to - o.from);
  const running = o.speed > 170;
  const S_target = running ? clamp(o.speed * 0.42, 40, 92) : clamp(o.speed * 0.52, 22, 60);
  const steps = Math.max(1, Math.round(distance / S_target));
  const S = distance / steps;
  const T = S / o.speed;                       // seconds between successive plants
  const arrivalT = steps * T;
  const arrivalFrame = o.startFrame + Math.max(1, Math.round(arrivalT * fps));
  const stepH = running ? 26 : 16;
  const bobAmp = running ? 6 : 3.5;
  const armAmp = running ? 34 : 15;
  const lean = o.lean ?? (running ? 13 : 4);
  const stanceY = -(s.thigh + s.shin + s.ankleH);

  const out: SkeletonFrame[] = [];
  for (let i = 0; i < o.frames; i++) {
    const frame = o.startFrame + i;
    const t = i / fps;
    const x = o.from + facing * o.speed * t;

    if (t >= arrivalT) {
      const breath = Math.sin((frame / fps) * 2 * Math.PI * 0.55) * 0.5 + 0.5;
      out.push(buildFrame(s, idlePose(s, o.to, facing, breath)));
      continue;
    }

    const y = stanceY - Math.abs(Math.sin((Math.PI * t) / T)) * bobAmp;
    const cycle = Math.sin((Math.PI * t) / T);          // + during first half-step
    const feet: [V2, V2] = [[0, 0], [0, 0]];

    for (const f of [0, 1] as const) {
      // contacts for foot f occur at global step index m where m % 2 === f
      let m = Math.floor(t / T + 1e-6);
      if (m % 2 !== f) m -= 1;
      const firstContact = f;                            // foot1 plants at m=1 (t=T)
      if (m < firstContact) {
        // standing start: feet together until this foot's first plant
        feet[f] = [o.from + (f === 0 ? -11 : 11) * facing, 0];
        continue;
      }
      const plantT = m * T;
      const plantX = o.from + facing * m * S;
      const liftT = plantT + 1.22 * T;
      const nextPlantT = plantT + 2 * T;
      const nextPlantX = o.from + facing * (m + 2) * S;
      const finalPlant = nextPlantT >= arrivalT;
      if (t < liftT) {
        feet[f] = [plantX, 0];
      } else {
        const swEnd = finalPlant ? arrivalT : nextPlantT;
        const sw = clamp((t - liftT) / Math.max(0.01, swEnd - liftT), 0, 1);
        const ex = easeInOut(sw);
        const targetX = finalPlant ? o.to + (f === 0 ? -11 : 11) : nextPlantX;
        feet[f] = [lerp(plantX, targetX, ex), -Math.sin(Math.PI * sw) * stepH];
      }
    }

    let armL, armR;
    if (o.handTargets) {
      const [tl, tr] = o.handTargets;
      const bend = (facing === 1 ? 1 : -1) as 1 | -1;
      armL = { mode: 'ik' as const, target: tl(x, t), bend };
      armR = { mode: 'ik' as const, target: tr(x, t), bend };
    } else {
      const swingL = armAmp * cycle;
      const swingR = -armAmp * cycle;
      armL = { mode: 'fk' as const, sh: 3 + swingL, el: 7 + Math.max(0, -cycle) * 12 };
      armR = { mode: 'fk' as const, sh: 3 + swingR, el: 7 + Math.max(0, cycle) * 12 };
    }

    const leanNow = lean + cycle * 1.5;
    const pose: PoseParams = {
      x, y, lean: leanNow, headTilt: -leanNow * 0.35, facing,
      armL, armR,
      legL: { mode: 'ik', foot: [feet[0][0], feet[0][1]] },
      legR: { mode: 'ik', foot: [feet[1][0], feet[1][1]] },
    };
    out.push(buildFrame(s, pose));
  }

  // smooth entry / exit cross-fades
  const entry = makeIdle(s, { x: o.from, facing, startFrame: 0, frames: 8, fps });
  blendInto(out, entry, 0, 6);
  const exitBlend = Math.min(out.length - (arrivalFrame - o.startFrame), Math.round(T * fps * 0.5));
  if (exitBlend > 2) {
    const exitIdle = makeIdle(s, {
      x: o.to, facing, startFrame: arrivalFrame - exitBlend, frames: exitBlend, fps,
    });
    blendInto(out, exitIdle, arrivalFrame - o.startFrame - exitBlend, exitBlend);
  }
  return { frames: out, arrivalFrame };
}
