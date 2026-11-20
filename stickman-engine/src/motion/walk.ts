/**
 * Procedural walk / run cycle generator with pinned stance feet
 * (feet cannot slide by construction - contacts are world-fixed).
 *
 * Phase A upgrade:
 *   - lateral hip shift toward the stance foot (fixes the "gliding puppet" look)
 *   - correct two-per-stride vertical bob (was one per full step)
 *   - torso yaw so shoulders counter-rotate against the swing leg
 *   - stance pelvis drop so the knee never fully locks
 *   - longer entry/exit cross-fades so walk <-> idle is invisible
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
  const speed = Math.max(1, Math.abs(o.speed));
  const running = speed > 170;
  const S_target = running ? clamp(speed * 0.42, 40, 92) : clamp(speed * 0.52, 22, 60);
  const steps = Math.max(2, Math.round(distance / S_target));
  const S = distance > 0 ? distance / steps : 1;
  // Speed is the average travel speed. Smoothstep gives the character a
  // readable push-off and deceleration instead of instant start/stop.
  const arrivalT = distance / speed;
  const arrivalFrame = o.startFrame + Math.max(1, Math.round(arrivalT * fps));
  const stepH = running ? 26 : 16;
  const bobAmp = running ? 7 : 4;
  const armAmp = running ? 34 : 15;
  const lean = o.lean ?? (running ? 7 : 2.5);
  const stanceY = -(s.thigh + s.shin + s.ankleH);
  const hipShiftAmp = running ? 4 : 6;         // lateral hip sway toward stance foot
  const torsoYawAmp = running ? 6 : 4;         // shoulder counter-rotation
  // Pelvis drop that flexes the stance knee slightly instead of locking it.
  const stanceKneeFlexDeg = 8;
  const pelvisDropAmp =
    (s.thigh + s.shin) *
    (1 - Math.cos((stanceKneeFlexDeg * Math.PI) / 180)) *
    0.5;

  const out: SkeletonFrame[] = [];
  if (distance < 0.001) {
    return {
      frames: makeIdle(s, { x: o.to, facing, startFrame: o.startFrame, frames: o.frames, fps }),
      arrivalFrame: o.startFrame,
    };
  }
  for (let i = 0; i < o.frames; i++) {
    const frame = o.startFrame + i;
    const t = i / fps;

    if (t >= arrivalT) {
      const breath = Math.sin((frame / fps) * 2 * Math.PI * 0.55) * 0.5 + 0.5;
      out.push(buildFrame(s, idlePose(s, o.to, facing, breath)));
      continue;
    }

    // Distance-based gait phase keeps foot plants tied to the ground even
    // while the body accelerates and decelerates.
    const timeProgress = clamp(t / Math.max(0.001, arrivalT), 0, 1);
    const easedProgress = timeProgress * timeProgress * (3 - 2 * timeProgress);
    const travelled = distance * easedProgress;
    const baseX = o.from + facing * travelled;
    const stepPhase = travelled / S;
    // Two small vertical pulses per step interval, one around each footfall.
    const y = stanceY - Math.abs(Math.sin(2 * Math.PI * stepPhase)) * bobAmp;
    const cycle = Math.sin(Math.PI * stepPhase);
    const feet: [V2, V2] = [[0, 0], [0, 0]];
    let stanceFoot: 0 | 1 = 0;
    let stanceWeight = 0;                               // 0..1, 1 = fully on stance foot

    for (const f of [0, 1] as const) {
      let m = Math.floor(stepPhase + 1e-6);
      if (m % 2 !== f) m -= 1;
      const firstContact = f;
      if (m < firstContact) {
        feet[f] = [o.from + (f === 0 ? -11 : 11) * facing, 0];
        if (f === 0) { stanceFoot = 0; stanceWeight = 1; }
        continue;
      }
      const plantPhase = m;
      const plantX = o.from + facing * m * S;
      const liftPhase = plantPhase + 1.22;
      const nextPlantPhase = plantPhase + 2;
      const nextPlantX = o.from + facing * (m + 2) * S;
      const finalPlant = nextPlantPhase >= steps;
      if (stepPhase < liftPhase) {
        feet[f] = [plantX, 0];
        stanceFoot = f;
        const stanceProgress = (stepPhase - plantPhase) / Math.max(0.01, liftPhase - plantPhase);
        stanceWeight = stanceProgress < 0.75 ? 1 : (1 - stanceProgress) / 0.25;
      } else {
        const swEnd = finalPlant ? steps : nextPlantPhase;
        const sw = clamp((stepPhase - liftPhase) / Math.max(0.01, swEnd - liftPhase), 0, 1);
        const ex = easeInOut(sw);
        const targetX = finalPlant ? o.to + (f === 0 ? -11 : 11) : nextPlantX;
        feet[f] = [lerp(plantX, targetX, ex), -Math.sin(Math.PI * sw) * stepH];
      }
    }

    // Lateral hip shift: hips ride over the stance foot. This is the fix
    // for the "gliding on rails" look.
    const hipShift = hipShiftAmp * stanceWeight * (stanceFoot === 0 ? -1 : 1) * facing;
    const x = baseX + hipShift;

    // Slight pelvis drop during stance so the stance knee flexes.
    const yAdjusted = y + stanceWeight * pelvisDropAmp;

    // Shoulder counter-rotation against swing leg.
    const torsoYaw = -cycle * torsoYawAmp;

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

    const leanNow = lean + cycle * (running ? 1.0 : 0.6);
    const pose: PoseParams = {
      x, y: yAdjusted, lean: leanNow, headTilt: -leanNow * 0.35, facing,
      torsoYaw,
      armL, armR,
      legL: { mode: 'ik', foot: [feet[0][0], feet[0][1]] },
      legR: { mode: 'ik', foot: [feet[1][0], feet[1][1]] },
    };
    out.push(buildFrame(s, pose));
  }

  // Longer entry / exit cross-fades (was 6 frames — visible snap).
  const entry = makeIdle(s, { x: o.from, facing, startFrame: o.startFrame, frames: 12, fps });
  blendInto(out, entry, 0, 10);
  const stepSeconds = distance / steps / speed;
  const exitBlend = Math.min(out.length - (arrivalFrame - o.startFrame), Math.round(stepSeconds * fps * 0.5));
  if (exitBlend > 3) {
    const exitIdle = makeIdle(s, {
      x: o.to, facing, startFrame: arrivalFrame - exitBlend, frames: exitBlend, fps,
    });
    blendInto(out, exitIdle, arrivalFrame - o.startFrame - exitBlend, exitBlend);
  }
  return { frames: out, arrivalFrame };
}
