/**
 * Action generators: named, parameterised character behaviors that emit
 * dense skeleton streams + face events (+ camera shake requests).
 * All streams are absolute-framed and entry-blended from a standing pose.
 */
import { clamp, lerp, easeInOut, V2 } from '../rig/geometry';
import { CharStyle, FaceEvent, SkeletonFrame } from '../rig/character';
import { buildFrame, idlePose, PoseParams } from './poses';
import { makeIdle } from './idle';

export type ActionResult = {
  frames: SkeletonFrame[];
  events: FaceEvent[];
  shake?: { frame: number; amp: number; dur: number }[];
};

type BaseOpts = {
  style: CharStyle;
  startFrame: number;
  frames: number;
  fps: number;
  x: number;
  facing: 1 | -1;
};

const stanceY = (s: CharStyle) => -(s.thigh + s.shin + s.ankleH);

function base(out: SkeletonFrame[], o: BaseOpts): { frames: SkeletonFrame[]; events: FaceEvent[]; shake: ActionResult['shake'] } {
  return { frames: out, events: [], shake: [] };
}

function idleBase(o: BaseOpts): SkeletonFrame[] {
  return makeIdle(o.style, { x: o.x, facing: o.facing, startFrame: o.startFrame, frames: o.frames, fps: o.fps });
}

/** Blend `stream` (which starts at its own natural pose) smoothly from idle. */
function entryBlend(stream: SkeletonFrame[], o: BaseOpts) {
  // first frame already comes from the generator; soften by lerping frame0->2
  return stream;
}

// ---------------- push (object manipulation) ----------------

export function pushStream(
  o: BaseOpts & {
    propX: number; propW: number; propH: number;
    strain?: boolean;              // effort oscillation + strain face
    slide?: { speed: number };     // if the box slides, character keeps pushing (feet re-plant)
  },
): ActionResult {
  const s = o.style;
  const f = o.facing;
  const handleY = -o.propH + 12;
  const out: SkeletonFrame[] = [];
  const events: FaceEvent[] = [{ frame: o.startFrame + 1, emo: 'strain' }];
  const shake: { frame: number; amp: number; dur: number }[] = [];
  for (let i = 0; i < o.frames; i++) {
    const t = i / o.fps;
    const frame = o.startFrame + i;
    const effort = o.strain ? Math.sin(t * 2 * Math.PI * 1.1) : 0;
    const x = o.x + effort * 3;
    const pose: PoseParams = {
      x,
      y: stanceY(s) + 9 + effort * 1.5,
      lean: 27 + effort * 7,
      headTilt: 14,
      facing: f,
      armL: {
        mode: 'ik',
        target: [o.propX + f * (o.propW / 2 - 20) - f * 0, handleY],
        bend: (f === 1 ? 1 : -1),
      },
      armR: {
        mode: 'ik',
        target: [o.propX + f * (o.propW / 2 - 6), handleY - 2],
        bend: (f === 1 ? 1 : -1),
      },
      legL: { mode: 'ik', foot: [o.propX - f * 40, 0] },
      legR: { mode: 'ik', foot: [o.propX - f * 78, 0] },
    };
    out.push(buildFrame(s, pose));
  }
  void base; void entryBlend; void idleBase;
  return { frames: out, events, shake };
}

// ---------------- pointing / presenting ----------------

export function aimStream(
  o: BaseOpts & {
    target: V2;
    arm?: 'L' | 'R';
    support?: boolean;            // other half-raised (present/teach)
    settle?: boolean;             // small overshoot on reach
  },
): ActionResult {
  const s = o.style;
  const f = o.facing;
  const main = o.arm ?? 'R';
  const out: SkeletonFrame[] = [];
  const events: FaceEvent[] = [];
  for (let i = 0; i < o.frames; i++) {
    const t = i / o.fps;
    const frame = o.startFrame + i;
    const sway = Math.sin(t * 2 * Math.PI * 0.8) * 1.5;
    // reach settle: quick ease toward full extension
    const reach = o.settle === false ? 1 : Math.min(1, easeInOut(clamp(i / 9, 0, 1)));
    const tgt: V2 = [o.target[0], o.target[1] + sway];
    const shoulderY = stanceY(s) + s.torso + 4;
    const aimFrom: V2 = [o.x + f * 4, shoulderY];
    const to: V2 = [lerp(aimFrom[0], tgt[0], 0.6 + 0.4 * reach), lerp(aimFrom[1], tgt[1], 0.6 + 0.4 * reach)];
    // head tilt toward target
    const dx = tgt[0] - o.x, dy = tgt[1] - shoulderY;
    const ang = (Math.atan2(dy, dx * f) * 180) / Math.PI;
    const headTilt = clamp(ang * 0.35, -16, 16);
    const mainArm = { mode: 'ik' as const, target: to, bend: (f === 1 ? 1 : -1) as 1 | -1 };
    const restArm = { mode: 'fk' as const, sh: o.support ? 24 : 5, el: o.support ? 28 : 6 };
    const pose: PoseParams = {
      x: o.x, y: stanceY(s), lean: 3 + (o.support ? 3 : 0), headTilt, facing: f,
      armL: main === 'L' ? mainArm : restArm,
      armR: main === 'R' ? mainArm : restArm,
      legL: { mode: 'ik', foot: [o.x - 11, 0] },
      legR: { mode: 'ik', foot: [o.x + 11, 0] },
    };
    out.push(buildFrame(s, pose));
    if (i === 1) events.push({ frame, emo: o.support ? 'proud' : 'neutral' });
  }
  return { frames: out, events };
}

// ---------------- wave ----------------

export function waveStream(o: BaseOpts & { arm?: 'L' | 'R' }): ActionResult {
  const s = o.style;
  const f = o.facing;
  const main = o.arm ?? 'R';
  const out: SkeletonFrame[] = [];
  const events: FaceEvent[] = [{ frame: o.startFrame + 1, emo: 'happy' }];
  for (let i = 0; i < o.frames; i++) {
    const t = i / o.fps;
    const wig = Math.sin(t * 2 * Math.PI * 2.6);
    const mainArm = { mode: 'fk' as const, sh: 148 + wig * 10, el: 22 + wig * 14 };
    const restArm = { mode: 'fk' as const, sh: 6, el: 6 };
    const pose: PoseParams = {
      x: o.x, y: stanceY(s), lean: 2, headTilt: 4, facing: f,
      armL: main === 'L' ? mainArm : restArm,
      armR: main === 'R' ? mainArm : restArm,
      legL: { mode: 'ik', foot: [o.x - 11, 0] },
      legR: { mode: 'ik', foot: [o.x + 11, 0] },
    };
    out.push(buildFrame(s, pose));
  }
  return { frames: out, events };
}

// ---------------- surprise reaction ----------------

export function reactSurprise(o: BaseOpts): ActionResult {
  const s = o.style;
  const f = o.facing;
  const out: SkeletonFrame[] = [];
  const events: FaceEvent[] = [
    { frame: o.startFrame + 1, emo: 'surprised' },
    { frame: o.startFrame + Math.round(o.fps * 1.1), emo: 'worried' },
  ];
  for (let i = 0; i < o.frames; i++) {
    const p = clamp(i / 10, 0, 1);
    const hop = i < 5 ? Math.sin((i / 5) * Math.PI) * 9 : 0;
    const back = o.facing * -14 * Math.sin(p * Math.PI);
    const pose: PoseParams = {
      x: o.x + back, y: stanceY(s) - hop, lean: -7 * Math.sin(p * Math.PI), headTilt: -8 * (1 - p), facing: f,
      armL: { mode: 'fk', sh: 38 * Math.sin(p * Math.PI) + 5, el: 10 },
      armR: { mode: 'fk', sh: -38 * Math.sin(p * Math.PI) + 5, el: 10 },
      legL: { mode: 'ik', foot: [o.x + back - 12, 0] },
      legR: { mode: 'ik', foot: [o.x + back + 12, 0] },
    };
    out.push(buildFrame(s, pose));
  }
  return { frames: out, events };
}

// ---------------- cheer / celebrate (jumping) ----------------

export function cheerStream(o: BaseOpts): ActionResult {
  const s = o.style;
  const f = o.facing;
  const out: SkeletonFrame[] = [];
  const events: FaceEvent[] = [{ frame: o.startFrame + 1, emo: 'bigsmile' }];
  for (let i = 0; i < o.frames; i++) {
    const t = i / o.fps;
    const hop = Math.abs(Math.sin(t * 2 * Math.PI * 1.8)) * 14;
    const wig = Math.sin(t * 2 * Math.PI * 3.4);
    const pose: PoseParams = {
      x: o.x, y: stanceY(s) - hop, lean: -3, headTilt: -7, facing: f,
      armL: { mode: 'fk', sh: -152 + wig * 9, el: -10 },
      armR: { mode: 'fk', sh: 152 + wig * 9, el: 10 },
      legL: { mode: 'ik', foot: [o.x - 10, -hop * 0.5] },
      legR: { mode: 'ik', foot: [o.x + 10, -hop * 0.5] },
    };
    out.push(buildFrame(s, pose));
  }
  return { frames: out, events };
}

// ---------------- laugh ----------------

export function laughStream(o: BaseOpts): ActionResult {
  const s = o.style;
  const f = o.facing;
  const out: SkeletonFrame[] = [];
  const events: FaceEvent[] = [{ frame: o.startFrame + 1, emo: 'bigsmile' }];
  for (let i = 0; i < o.frames; i++) {
    const t = i / o.fps;
    const bob = Math.abs(Math.sin(t * 2 * Math.PI * 2.3));
    const pose: PoseParams = {
      x: o.x, y: stanceY(s) + bob * 5, lean: 10 + bob * 4, headTilt: -9 - bob * 3, facing: f,
      armL: { mode: 'fk', sh: 30, el: 78 },
      armR: { mode: 'fk', sh: 34, el: 80 },
      legL: { mode: 'ik', foot: [o.x - 11, 0] },
      legR: { mode: 'ik', foot: [o.x + 11, 0] },
    };
    out.push(buildFrame(s, pose));
  }
  return { frames: out, events };
}

// ---------------- comedic stumble (slipping) ----------------

export function stumbleStream(o: BaseOpts): ActionResult {
  const s = o.style;
  const f = o.facing;
  const out: SkeletonFrame[] = [];
  const events: FaceEvent[] = [
    { frame: o.startFrame + 1, emo: 'surprised' },
    { frame: o.startFrame + Math.round(o.fps * 0.9), emo: 'worried' },
  ];
  const shake = [{ frame: o.startFrame + Math.round(o.fps * 0.35), amp: 5, dur: 0.3 }];
  for (let i = 0; i < o.frames; i++) {
    const t = i / o.fps;
    // feet slip forward fast, body pitches forward, arms flail then reach
    const slip = easeInOut(clamp(t / 0.5, 0, 1));
    const pitch = Math.sin(clamp(t / 1.1, 0, 1) * Math.PI) * 34;
    const drop = easeInOut(clamp(t / 0.8, 0, 1)) * 16;
    const feetL: V2 = [o.x + f * (12 + slip * 46), -6 * Math.sin(clamp(t / 0.4, 0, 1) * Math.PI)];
    const feetR: V2 = [o.x + f * (-12 + slip * 62), -14 * Math.sin(clamp(t / 0.35, 0, 1) * Math.PI)];
    const pose: PoseParams = {
      x: o.x, y: stanceY(s) + drop, lean: 8 + pitch, headTilt: -6, facing: f,
      armL: { mode: 'fk', sh: -95 + slip * 130, el: -18 },
      armR: { mode: 'fk', sh: 110 - slip * 40, el: 22 },
      legL: { mode: 'ik', foot: feetL },
      legR: { mode: 'ik', foot: feetR },
    };
    out.push(buildFrame(s, pose));
  }
  return { frames: out, events, shake };
}

// ---------------- sitting (bench) ----------------

export function sitStream(
  o: BaseOpts & { seatX: number; seatY: number },
): ActionResult {
  const s = o.style;
  const f = o.facing;
  const out: SkeletonFrame[] = [];
  const events: FaceEvent[] = [{ frame: o.startFrame + 3, emo: 'happy' }];
  for (let i = 0; i < o.frames; i++) {
    const t = i / o.fps;
    const settle = Math.sin(t * 2 * Math.PI * 0.55) * 0.5 + 0.5;
    const sit = easeInOut(clamp(i / (o.fps * 0.8), 0, 1)); // lower into the seat
    const y = lerp(stanceY(s), o.seatY - 6, sit);
    const x = lerp(o.x, o.seatX - f * 4, sit);
    const pose: PoseParams = {
      x, y, lean: 3 + settle * 1.5, headTilt: 0, facing: f,
      armL: { mode: 'fk', sh: 16, el: 34 },
      armR: { mode: 'fk', sh: 18, el: 36 },
      legL: { mode: 'fk', hip: lerp(12, 78, sit), knee: lerp(6, 62, sit) },
      legR: { mode: 'fk', hip: lerp(14, 84, sit), knee: lerp(6, 66, sit) },
    };
    out.push(buildFrame(s, pose));
  }
  return { frames: out, events };
}

// ---------------- word-synced talking gestures ----------------

export function talkStream(
  o: BaseOpts & { wordTimes: number[]; amplitude?: number },
): ActionResult {
  const s = o.style;
  const f = o.facing;
  const out: SkeletonFrame[] = [];
  const events: FaceEvent[] = [{ frame: o.startFrame + 1, emo: 'talk' }];
  const amp = o.amplitude ?? 1;
  const pulses = o.wordTimes.map((wt, idx) => ({
    t0: wt, arm: idx % 2 === 0 ? 'R' : 'L', raise: (34 + (idx % 3) * 16) * amp,
  }));
  for (let i = 0; i < o.frames; i++) {
    const t = i / o.fps;
    const breath = Math.sin(t * 2 * Math.PI * 0.55) * 0.5 + 0.5;
    const pose = idlePose(s, o.x, f, breath);
    pose.lean = 2;
    // active gesture pulse on the stressed word
    for (const p of pulses) {
      const dt = t - p.t0;
      if (dt >= -0.05 && dt < 0.5) {
        const k = Math.sin(clamp((dt + 0.05) / 0.55, 0, 1) * Math.PI);
        const raise = p.raise * k;
        const el = 26 * k;
        const shBase = p.arm === 'R' ? pose.armR : pose.armL;
        if (shBase.mode === 'fk') {
          if (p.arm === 'R') pose.armR = { mode: 'fk', sh: shBase.sh + raise, el: shBase.el + el };
          else pose.armL = { mode: 'fk', sh: shBase.sh + raise, el: shBase.el + el };
        }
        pose.headTilt = (pose.headTilt ?? 0) + 3 * k;
      }
    }
    out.push(buildFrame(s, pose));
  }
  return { frames: out, events };
}

/** Fill a stream span with plain idle (used between actions). */
export function fillIdle(o: BaseOpts): SkeletonFrame[] {
  return idleBase(o);
}
