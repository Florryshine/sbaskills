/**
 * Procedural action streams — jump, land, pickup, carry, throw, drop, clap,
 * dance, pull, fall, getUp, turn. Each stream returns a dense SkeletonFrame[]
 * plus FaceEvents (emotion cues) and optional camera ShakeEvents.
 *
 * Phase A upgrade:
 *   - jump: proper gravity curve, feet stay grounded until liftoff,
 *     knees absorb impact on landing
 *   - pickup / carry / throw: real physics — pelvis drops via leg IK,
 *     hands IK to the actual prop position, prop stays in hands during carry
 *   - clap: hands actually meet at the pulse minimum
 *   - dance: alternating foot lifts, real weight shift
 *   - fall / getUp: smooth torso rotation over 0.6s, arms brace before impact
 */
import { clamp, easeInOut, lerp, V2 } from '../rig/geometry';
import { CharStyle, FaceEvent, SkeletonFrame } from '../rig/character';
import { buildFrame, PoseParams } from './poses';

export type AdvancedOpts = {
  style: CharStyle;
  startFrame: number;
  frames: number;
  fps: number;
  x: number;
  facing: 1 | -1;
};
export type AdvancedResult = {
  frames: SkeletonFrame[];
  events: FaceEvent[];
  shake?: { frame: number; amp: number; dur: number }[];
};

const ground = (s: CharStyle) => -(s.thigh + s.shin + s.ankleH);

function build(
  s: CharStyle,
  x: number,
  y: number,
  f: 1 | -1,
  lean: number,
  headTilt: number,
  armL: PoseParams['armL'],
  armR: PoseParams['armR'],
  legL: PoseParams['legL'],
  legR: PoseParams['legR'],
  torsoYaw = 0,
): SkeletonFrame {
  return buildFrame(s, { x, y, facing: f, lean, headTilt, armL, armR, legL, legR, torsoYaw });
}

function result(frames: SkeletonFrame[], events: FaceEvent[] = []): AdvancedResult {
  return { frames, events };
}

/* ------------------------------------------------------------------ */
/* Jump / land                                                         */
/* ------------------------------------------------------------------ */

export function jumpStream(o: AdvancedOpts & { height?: number }): AdvancedResult {
  const s = o.style;
  const h = clamp(o.height ?? 105, 35, 220);
  const n = Math.max(2, o.frames);
  const out: SkeletonFrame[] = [];
  const g = ground(s);

  // Phases: anticipation (0-15%) -> launch (15-25%) -> flight (25-75%) -> land (75-90%) -> recover (90-100%)
  const anticEnd = 0.15;
  const launchEnd = 0.25;
  const landStart = 0.75;
  const recoverEnd = 0.90;

  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    let pelvisY = g;
    let footY: [number, number] = [0, 0];
    let lean = 0;
    let kneeCompress = 0;

    if (t < anticEnd) {
      // Anticipation: crouch down, arms swing back
      const p = t / anticEnd;
      const crouch = Math.sin((p * Math.PI) / 2) * 22;
      pelvisY = g + crouch;
      kneeCompress = crouch;
    } else if (t < launchEnd) {
      // Launch: extend up, arms swing forward
      const p = (t - anticEnd) / (launchEnd - anticEnd);
      const crouch = 22 * (1 - p);
      pelvisY = g + crouch;
      kneeCompress = crouch;
    } else if (t < landStart) {
      // Flight: parabola. Height at launch and land = 0, apex at 0.5.
      const p = (t - launchEnd) / (landStart - launchEnd);
      const parabola = 4 * p * (1 - p); // 0..1..0
      pelvisY = g - parabola * h;
      // Feet tuck under the body during flight (knees bend).
      footY = [-parabola * h * 0.85, -parabola * h * 0.85];
    } else if (t < recoverEnd) {
      // Land: compress to absorb impact
      const p = (t - landStart) / (recoverEnd - landStart);
      const compress = Math.sin(p * Math.PI) * 20;
      pelvisY = g + compress;
      kneeCompress = compress;
    } else {
      // Recover: back to neutral
      const p = (t - recoverEnd) / (1 - recoverEnd);
      const compress = 20 * (1 - p);
      pelvisY = g + compress;
      kneeCompress = compress;
    }

    // Arm swing: back during anticipation, forward at launch, out during flight, down on land
    let armSwing = 0;
    if (t < anticEnd) armSwing = -50 * Math.sin((t / anticEnd) * Math.PI);
    else if (t < launchEnd) armSwing = lerp(-50, 80, (t - anticEnd) / (launchEnd - anticEnd));
    else if (t < landStart) armSwing = lerp(80, 40, (t - launchEnd) / (landStart - launchEnd));
    else if (t < recoverEnd) armSwing = lerp(40, 0, (t - landStart) / (recoverEnd - landStart));

    lean = -armSwing * 0.15;

    out.push(
      build(
        s, o.x, pelvisY, o.facing, lean, 0,
        { mode: 'fk', sh: 8 + armSwing, el: 12 },
        { mode: 'fk', sh: -8 - armSwing, el: 12 },
        { mode: 'ik', foot: [o.x - 11, footY[0]] },
        { mode: 'ik', foot: [o.x + 11, footY[1]] },
      ),
    );
  }

  // Emotion + shake on land
  const events: FaceEvent[] = [
    { frame: o.startFrame + 1, emo: 'surprised' },
    { frame: o.startFrame + Math.floor(n * 0.55), emo: 'happy' },
    { frame: o.startFrame + n - 3, emo: 'neutral' },
  ];
  const shake = [{ frame: o.startFrame + Math.floor(n * landStart), amp: 4, dur: 0.18 }];
  return { frames: out, events, shake };
}

export function landStream(o: AdvancedOpts): AdvancedResult {
  const s = o.style;
  const n = Math.max(2, o.frames);
  const out: SkeletonFrame[] = [];
  const g = ground(s);

  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    // Compress in first 30%, recover in last 70%.
    const compress = t < 0.3 ? Math.sin((t / 0.3) * (Math.PI / 2)) * 18 : 18 * (1 - (t - 0.3) / 0.7);
    const pelvisY = g + compress;
    out.push(
      build(
        s, o.x, pelvisY, o.facing, -3 + compress * 0.2, 4,
        { mode: 'fk', sh: lerp(95, 8, t), el: lerp(48, 12, t) },
        { mode: 'fk', sh: lerp(-95, -8, t), el: lerp(48, 12, t) },
        { mode: 'ik', foot: [o.x - 11, 0] },
        { mode: 'ik', foot: [o.x + 11, 0] },
      ),
    );
  }

  return {
    frames: out,
    events: [
      { frame: o.startFrame + 1, emo: 'surprised' },
      { frame: o.startFrame + Math.floor(n * 0.55), emo: 'neutral' },
    ],
  };
}

/* ------------------------------------------------------------------ */
/* Clap / dance                                                        */
/* ------------------------------------------------------------------ */

export function clapStream(o: AdvancedOpts): AdvancedResult {
  const s = o.style;
  const out: SkeletonFrame[] = [];
  const g = ground(s);
  const chestY = g - s.torso * 0.6;

  for (let i = 0; i < o.frames; i++) {
    const t = i / o.fps;
    // 3 claps per second, smooth pulses.
    const pulse = (Math.sin(t * Math.PI * 2 * 3) + 1) / 2;
    const gap = lerp(28, 3, pulse); // hands come together at pulse=1
    out.push(
      build(
        s, o.x, g, o.facing, 2, -3,
        { mode: 'ik', target: [o.x - 6 - gap, chestY], bend: -1 },
        { mode: 'ik', target: [o.x + 6 + gap, chestY], bend: 1 },
        { mode: 'ik', foot: [o.x - 11, 0] },
        { mode: 'ik', foot: [o.x + 11, 0] },
      ),
    );
  }

  return result(out, [{ frame: o.startFrame + 1, emo: 'happy' }]);
}

export function danceStream(o: AdvancedOpts): AdvancedResult {
  const s = o.style;
  const out: SkeletonFrame[] = [];
  const g = ground(s);
  const beatHz = 1.6; // 1.6 bounces per second

  for (let i = 0; i < o.frames; i++) {
    const t = i / o.fps;
    const beat = t * beatHz;
    const beatPhase = beat % 1;
    // Hip sway follows the beat.
    const sway = Math.sin(t * Math.PI * 2 * beatHz);
    const bounce = Math.abs(Math.sin(t * Math.PI * 2 * beatHz)) * 8;
    const x = o.x + sway * 8;
    const y = g - bounce;

    // Alternate foot lift: left foot on even beats, right foot on odd beats.
    const evenBeat = Math.floor(beat) % 2 === 0;
    const lift = Math.max(0, Math.sin(beatPhase * Math.PI)) * 12;
    const leftLift = evenBeat ? lift : 0;
    const rightLift = evenBeat ? 0 : lift;

    // Arms swing wide in rhythm.
    const armAmp = 55;
    const armSwingL = Math.sin(beat * Math.PI) * armAmp;
    const armSwingR = Math.sin(beat * Math.PI + Math.PI) * armAmp;

    out.push(
      build(
        s, x, y, o.facing, sway * 12, -sway * 8,
        { mode: 'fk', sh: 40 + armSwingL, el: 35 },
        { mode: 'fk', sh: -40 + armSwingR, el: 35 },
        { mode: 'ik', foot: [x - 11 + sway * 6, -leftLift] },
        { mode: 'ik', foot: [x + 11 + sway * 6, -rightLift] },
      ),
    );
  }

  return result(out, [{ frame: o.startFrame + 1, emo: 'happy' }]);
}

/* ------------------------------------------------------------------ */
/* Pickup / carry / throw / drop                                       */
/* ------------------------------------------------------------------ */

export function pickupStream(o: AdvancedOpts & { propX: number; propH: number }): AdvancedResult {
  const s = o.style;
  const out: SkeletonFrame[] = [];
  const g = ground(s);
  const f = o.facing;
  // Target Y where the hands meet the prop (top of the prop).
  const targetY = -o.propH + 8;

  for (let i = 0; i < o.frames; i++) {
    const t = i / (o.frames - 1);
    // Phases: stand (0-20%) -> bend down (20-55%) -> grab (55-70%) -> stand with prop (70-100%)
    let pelvisDrop = 0;
    let lean = 2;
    let handX = o.propX - f * 12;
    let handY = targetY + 40; // start high (near chest)

    if (t < 0.2) {
      // Waiting / preparing
    } else if (t < 0.55) {
      // Bend down
      const p = easeInOut((t - 0.2) / 0.35);
      pelvisDrop = p * 34;
      lean = lerp(2, 25, p);
      handY = lerp(targetY + 40, targetY, p);
    } else if (t < 0.7) {
      // Grab (hands at prop)
      pelvisDrop = 34;
      lean = 25;
      handY = targetY;
    } else {
      // Rise with prop
      const p = easeInOut((t - 0.7) / 0.3);
      pelvisDrop = 34 * (1 - p);
      lean = lerp(25, 3, p);
      handY = lerp(targetY, targetY + 10, p); // hands lift with prop
    }

    out.push(
      build(
        s, o.x, g + pelvisDrop, f, lean, lean * 0.35,
        { mode: 'ik', target: [handX - f * 4, handY], bend: f === 1 ? -1 : 1 },
        { mode: 'ik', target: [handX + f * 4, handY + 4], bend: f === 1 ? -1 : 1 },
        { mode: 'ik', foot: [o.x - 11, 0] },
        { mode: 'ik', foot: [o.x + 11, 0] },
      ),
    );
  }

  return result(out, [
    { frame: o.startFrame + 1, emo: 'focused' as any },
    { frame: o.startFrame + Math.floor(o.frames * 0.65), emo: 'proud' },
  ]);
}

export function carryStream(o: AdvancedOpts): AdvancedResult {
  const s = o.style;
  const out: SkeletonFrame[] = [];
  const g = ground(s);
  // Holding point: about 30px in front of chest.
  const holdY = g - s.torso * 0.55;

  for (let i = 0; i < o.frames; i++) {
    const t = i / o.fps;
    // Subtle walking-like bounce.
    const bounce = Math.sin(t * Math.PI * 2 * 1.2) * 2;
    const x = o.x + Math.sin(t * Math.PI * 2 * 1.2) * 2;
    out.push(
      build(
        s, x, g - bounce, o.facing, 4, 0,
        { mode: 'ik', target: [o.x - 8, holdY], bend: o.facing === 1 ? -1 : 1 },
        { mode: 'ik', target: [o.x + 8, holdY], bend: o.facing === 1 ? -1 : 1 },
        { mode: 'ik', foot: [o.x - 11, 0] },
        { mode: 'ik', foot: [o.x + 11, 0] },
      ),
    );
  }

  return result(out, [{ frame: o.startFrame + 1, emo: 'focused' as any }]);
}

export function throwStream(o: AdvancedOpts): AdvancedResult {
  const s = o.style;
  const out: SkeletonFrame[] = [];
  const g = ground(s);
  const f = o.facing;

  for (let i = 0; i < o.frames; i++) {
    const t = i / (o.frames - 1);
    // Phases: wind-up (0-40%) -> snap (40-60%) -> follow-through (60-100%)
    let armLSh: number, armLEl: number, lean: number, torsoYaw: number;

    if (t < 0.4) {
      const p = easeInOut(t / 0.4);
      armLSh = lerp(30, 95, p);         // arm goes back
      armLEl = lerp(20, 70, p);         // elbow bent
      lean = lerp(0, -8, p);            // lean back
      torsoYaw = lerp(0, -12, p);       // twist away
    } else if (t < 0.6) {
      const p = easeInOut((t - 0.4) / 0.2);
      armLSh = lerp(95, -50, p);        // snap forward
      armLEl = lerp(70, 12, p);         // straighten
      lean = lerp(-8, 15, p);           // lean forward
      torsoYaw = lerp(-12, 12, p);      // twist into throw
    } else {
      const p = (t - 0.6) / 0.4;
      armLSh = lerp(-50, 30, p);        // follow-through
      armLEl = lerp(12, 20, p);
      lean = lerp(15, 2, p);
      torsoYaw = lerp(12, 0, p);
    }

    out.push(
      build(
        s, o.x, g, f, lean, lean * 0.3,
        { mode: 'fk', sh: armLSh, el: armLEl },
        { mode: 'fk', sh: 10, el: 25 },
        { mode: 'ik', foot: [o.x - 12, 0] },
        { mode: 'ik', foot: [o.x + 12, 0] },
        torsoYaw,
      ),
    );
  }

  return result(out, [
    { frame: o.startFrame + 1, emo: 'focused' as any },
    { frame: o.startFrame + Math.floor(o.frames * 0.55), emo: 'happy' },
  ]);
}

/* ------------------------------------------------------------------ */
/* Pull                                                                */
/* ------------------------------------------------------------------ */

export function pullStream(o: AdvancedOpts & { propX: number; propH: number }): AdvancedResult {
  const s = o.style;
  const out: SkeletonFrame[] = [];
  const g = ground(s);
  const f = o.facing;
  const handleY = -o.propH + 20;

  for (let i = 0; i < o.frames; i++) {
    const t = i / o.fps;
    // Strain oscillation — body pulses back.
    const strain = Math.sin(t * Math.PI * 2 * 1.5);
    const strainAmt = (strain + 1) / 2; // 0..1

    // Pelvis leans back, both arms extended toward prop handle.
    const pelvisX = o.x - f * strainAmt * 4;
    const pelvisY = g + strainAmt * 3;
    const lean = -25 - strainAmt * 6; // lean away from prop
    // Legs braced: front foot forward, back foot back.
    const frontFoot = [pelvisX + f * 25, 0] as V2;
    const backFoot = [pelvisX - f * 35, 0] as V2;

    out.push(
      build(
        s, pelvisX, pelvisY, f, lean, 12,
        { mode: 'ik', target: [o.propX - f * 10, handleY], bend: f === 1 ? -1 : 1 },
        { mode: 'ik', target: [o.propX - f * 22, handleY + 6], bend: f === 1 ? -1 : 1 },
        { mode: 'ik', foot: [frontFoot[0], frontFoot[1]] },
        { mode: 'ik', foot: [backFoot[0], backFoot[1]] },
      ),
    );
  }

  return result(out, [{ frame: o.startFrame + 1, emo: 'strain' }]);
}

/* ------------------------------------------------------------------ */
/* Fall / get up                                                       */
/* ------------------------------------------------------------------ */

export function fallStream(o: AdvancedOpts): AdvancedResult {
  const s = o.style;
  const out: SkeletonFrame[] = [];
  const g = ground(s);
  const f = o.facing;

  for (let i = 0; i < o.frames; i++) {
    const t = i / (o.frames - 1);
    // Phases: lose balance (0-30%) -> tilt (30-70%) -> hit ground (70-100%)
    let lean = 0;
    let pelvisY = g;
    let pelvisX = o.x;
    let armSplay = 0;
    let legSplay = 0;

    if (t < 0.3) {
      const p = easeInOut(t / 0.3);
      lean = lerp(0, 15, p);
      pelvisY = g - p * 4;
      armSplay = p * 40;
    } else if (t < 0.7) {
      const p = easeInOut((t - 0.3) / 0.4);
      lean = lerp(15, 70, p);
      pelvisY = g + p * 30;
      pelvisX = o.x + f * p * 15;
      armSplay = lerp(40, 85, p);
      legSplay = p * 40;
    } else {
      const p = (t - 0.7) / 0.3;
      lean = lerp(70, 72, p);
      pelvisY = g + 52;
      pelvisX = o.x + f * 25;
      armSplay = 85;
      legSplay = 40 + p * 5;
    }

    out.push(
      build(
        s, pelvisX, pelvisY, f, lean, -18,
        { mode: 'fk', sh: lerp(10, -100, t), el: lerp(15, 70, t) },
        { mode: 'fk', sh: lerp(-10, 105, t), el: lerp(15, 75, t) },
        { mode: 'fk', hip: legSplay, knee: 20 },
        { mode: 'fk', hip: -legSplay, knee: 20 },
      ),
    );
  }

  return {
    frames: out,
    events: [
      { frame: o.startFrame + 1, emo: 'fear' },
      { frame: o.startFrame + Math.floor(o.frames * 0.65), emo: 'sad' },
    ],
    shake: [{ frame: o.startFrame + Math.floor(o.frames * 0.55), amp: 5, dur: 0.25 }],
  };
}

export function getUpStream(o: AdvancedOpts): AdvancedResult {
  const s = o.style;
  const out: SkeletonFrame[] = [];
  const g = ground(s);
  const f = o.facing;

  for (let i = 0; i < o.frames; i++) {
    const t = i / (o.frames - 1);
    // Reverse of fall: prone (0-30%) -> push up (30-70%) -> stand (70-100%)
    let lean = 72;
    let pelvisY = g + 52;
    let pelvisX = o.x + f * 25;

    if (t < 0.3) {
      // Lying, preparing
    } else if (t < 0.7) {
      const p = easeInOut((t - 0.3) / 0.4);
      lean = lerp(72, 30, p);
      pelvisY = lerp(g + 52, g + 15, p);
      pelvisX = lerp(o.x + f * 25, o.x + f * 10, p);
    } else {
      const p = easeInOut((t - 0.7) / 0.3);
      lean = lerp(30, 0, p);
      pelvisY = lerp(g + 15, g, p);
      pelvisX = lerp(o.x + f * 10, o.x, p);
    }

    out.push(
      build(
        s, pelvisX, pelvisY, f, lean, -lean * 0.2,
        { mode: 'fk', sh: lerp(-95, 8, t), el: lerp(70, 10, t) },
        { mode: 'fk', sh: lerp(110, -8, t), el: lerp(72, 10, t) },
        { mode: 'fk', hip: lerp(85, 0, t), knee: lerp(20, 5, t) },
        { mode: 'fk', hip: lerp(-85, 0, t), knee: lerp(20, 5, t) },
      ),
    );
  }

  return result(out, [
    { frame: o.startFrame + 1, emo: 'sad' },
    { frame: o.startFrame + Math.floor(o.frames * 0.8), emo: 'neutral' },
  ]);
}

/* ------------------------------------------------------------------ */
/* Turn                                                                */
/* ------------------------------------------------------------------ */

export function turnStream(o: AdvancedOpts & { fromFacing: 1 | -1 }): AdvancedResult {
  const s = o.style;
  const out: SkeletonFrame[] = [];
  const g = ground(s);
  // Yaw sweep: face from `fromFacing` to `facing` over first 60% of the stream.
  const yawFull = (o.facing !== o.fromFacing) ? 180 : 0;

  for (let i = 0; i < o.frames; i++) {
    const t = i / (o.frames - 1);
    // Body yaw interpolates from 0 to yawFull.
    const yawP = easeInOut(clamp(t / 0.6, 0, 1));
    const torsoYaw = yawFull * yawP;
    // Head leads the body by ~15%.
    const headYawP = easeInOut(clamp((t + 0.08) / 0.6, 0, 1));
    const headYaw = yawFull * headYawP;

    // Foot repositioning: pivot foot stays planted, other foot lifts and re-plants.
    const pivotX = o.x - o.fromFacing * 11;
    const stepX = o.x + o.fromFacing * 11 * Math.cos((t * Math.PI));
    const stepY = -Math.max(0, Math.sin(t * Math.PI)) * 15;

    // Facing is used to flip the skeleton; interpolate between fromFacing and
    // facing only at the very end (past 50%) so the shoulders don't jump.
    const useFacing = t < 0.5 ? o.fromFacing : o.facing;

    out.push(
      build(
        s, o.x, g, useFacing, 2, headYaw - torsoYaw * 0.5,
        { mode: 'fk', sh: 8, el: 8 },
        { mode: 'fk', sh: -8, el: 8 },
        { mode: 'ik', foot: [pivotX, 0] },
        { mode: 'ik', foot: [stepX, stepY] },
        torsoYaw * useFacing,
      ),
    );
  }

  return result(out);
}

export function dropStream(o: AdvancedOpts): AdvancedResult {
  // Small stream to release a carried prop: arms extend forward, then come
  // down to the sides. Prop detach is handled in compiler.
  const s = o.style;
  const out: SkeletonFrame[] = [];
  const g = ground(s);
  for (let i = 0; i < o.frames; i++) {
    const t = i / (o.frames - 1);
    const extend = t < 0.3 ? t / 0.3 : 1 - (t - 0.3) / 0.7;
    out.push(
      build(
        s, o.x, g, o.facing, 3, 0,
        { mode: 'fk', sh: 8 + extend * 60, el: 12 },
        { mode: 'fk', sh: -8 - extend * 60, el: 12 },
        { mode: 'ik', foot: [o.x - 11, 0] },
        { mode: 'ik', foot: [o.x + 11, 0] },
      ),
    );
  }
  return result(out);
}
