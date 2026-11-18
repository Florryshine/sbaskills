/**
 * Scene compiler: SceneScript (+ narration audio map) -> deterministic
 * Timeline. All FK/IK, camera easing, transitions and caption word timing
 * are resolved HERE, so the Remotion composition only draws.
 * Pure function: same inputs always produce the same timeline.
 */
import { clamp, lerp, easeInOut } from '../rig/geometry';
import {
  SceneScript, Scene, Timeline, CharacterTrack, PropTrack, CameraKeyframe,
  ShakeEvent, OverlayTrack, CaptionTrack, AudioTrackItem, Transition,
  CaptionWord, STYLES, CharStyle, SceneOverlay,
} from '../rig/character';
import { buildFrame, blendInto } from '../motion/poses';
import { makeIdle } from '../motion/idle';
import { makeWalk } from '../motion/walk';
import {
  pushStream, aimStream, waveStream, reactSurprise, cheerStream,
  laughStream, stumbleStream, sitStream, talkStream,
} from '../motion/actions';
import { jumpStream, landStream, clapStream, danceStream, pullStream, pickupStream, carryStream, throwStream, fallStream, getUpStream, turnStream } from '../motion/advanced';
import { leanInStream, recoilStream } from '../motion/advanced';
import { autoDirector } from '../motion/director';
import { reactionsForDialogue } from '../motion/reactions';

export type NarrationMap = Record<string, { file: string; dur: number }>;

type CharState = { x: number; facing: 1 | -1; style: CharStyle; z: number };
type FrameBuf = ReturnType<typeof makeIdle>;

const FPS_DEFAULT = 30;

function wordsFor(text: string, dur: number, fps: number): CaptionWord[] {
  const tokens = text.split(/\s+/).filter(Boolean);
  const weights = tokens.map((w) =>
    Math.max(2, w.replace(/[.,!?…]/g, '').length) +
    (/[,;:]$/.test(w) ? 2 : 0) + (/[.!?]$/.test(w) ? 2.5 : 0));
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  let t = 0;
  return tokens.map((w, i) => {
    const d = (weights[i] / total) * dur;
    const seg = { w, start: Math.round(t * fps), end: Math.round((t + d * 0.92) * fps) };
    t += d;
    return seg;
  });
}

function twoShotScale(dx: number, W: number): number {
  return clamp((W * 0.78) / Math.max(140, dx + 250), 1.1, 2.4);
}

/** Keep the ground line at ~70% of frame height for a given camera scale. */
function camY(scale: number, H: number, dy = 0): number {
  return -0.20 * (H / scale) + dy;
}

function parkedFrame(s: CharStyle) {
  return buildFrame(s, {
    x: -2600, y: -(s.thigh + s.shin + s.ankleH), lean: 1.5, headTilt: 0, facing: 1,
    armL: { mode: 'fk', sh: 4, el: 5 }, armR: { mode: 'fk', sh: 4, el: 5 },
    legL: { mode: 'ik', foot: [-2611, 0] }, legR: { mode: 'ik', foot: [-2589, 0] },
  });
}

function copyInto(buf: FrameBuf, from: FrameBuf, at: number) {
  for (let i = 0; i < from.length && at + i < buf.length; i++) buf[at + i] = from[i];
}

function latestPropX(p: PropTrack, frame: number): number {
  let x = p.frames[0]?.x ?? 0;
  for (const k of p.frames) {
    if (k.frame > frame) break;
    x = k.x;
  }
  return x;
}

function staticProp(id: string, type: 'easel' | 'lamppost' | 'bench' | 'plant', x: number): PropTrack {
  const dims = {
    easel: { w: 90, h: 110, color: '#6b4f33', color2: '#4e3a26' },
    lamppost: { w: 10, h: 210, color: '#3c4650', color2: '#2c343c' },
    bench: { w: 130, h: 34, color: '#7a5a3a', color2: '#5d4229' },
    plant: { w: 44, h: 60, color: '#3f7d4e', color2: '#2f5f3a' },
  }[type];
  return {
    id, type, ...dims, z: type === 'lamppost' ? -1 : 1,
    frames: [{ frame: 0, x, y: 0, rot: 0 }],
  };
}

export function compile(script: SceneScript, narration: NarrationMap): Timeline {
  const fps = script.fps ?? FPS_DEFAULT;
  const W = script.width ?? 720;
  const H = script.height ?? 1280;
  const cast: Record<string, CharState> = {};
  for (const [id, c] of Object.entries(script.cast)) {
    cast[id] = { x: 0, facing: 1, style: STYLES[c.style] ?? STYLES.ben, z: 0 };
  }

  // ---- pass 1: dialogue timing (seconds) ----
  script.scenes.forEach((sc) => {
    let t = 0.35;
    (sc.dialogue ?? []).forEach((line) => {
      const n = narration[`${script.scenes.indexOf(sc)}:${(sc.dialogue ?? []).indexOf(line)}`];
      const dur = n ? n.dur : (line.duration ?? Math.max(1.6, line.text.length * 0.055));
      line.duration = dur;
      (line as any)._t0 = line.t0 ?? t;
      t = (line as any)._t0 + dur + 0.4;
    });
  });

  // ---- pass 2: scene durations -> frame allocation ----
  const sceneStartFrame: number[] = [];
  let cursor = 0;
  script.scenes.forEach((sc, si) => {
    let d = sc.duration ?? 0;
    (sc.dialogue ?? []).forEach((line) => {
      const end = ((line as any)._t0 ?? 0) + (line.duration ?? 3);
      d = Math.max(d, end + 0.8);
    });
    for (const a of sc.actions ?? []) {
      const aEnd = (a.t0 ?? 0) + ('dur' in a && a.dur ? a.dur : 1.2);
      d = Math.max(d, aEnd + 0.4);
    }
    sceneStartFrame.push(cursor);
    cursor += Math.round(Math.max(d, 4.2) * fps);
  });
  const durationFrames = cursor;

  // ---- accumulators (function-local: pure compile) ----
  const characters: CharacterTrack[] = [];
  const props: PropTrack[] = [];
  const overlays: OverlayTrack[] = [];
  const captions: CaptionTrack[] = [];
  const audio: AudioTrackItem[] = [];
  const transitions: Transition[] = [];
  const shakeEvents: ShakeEvent[] = [];
  const cameraKeys: CameraKeyframe[] = [];
  const sceneSpans: { id: string; start: number; end: number }[] = [];
  const environmentByScene: Record<string, Timeline['environment']> = {};

  script.scenes.forEach((sc, si) => {
    const sf0 = sceneStartFrame[si];
    const sfN = sf0 + Math.round((sceneStartFrame[si + 1] !== undefined
      ? (sceneStartFrame[si + 1] - sf0) / fps
      : (durationFrames - sf0) / fps) * fps);
    sceneSpans.push({ id: sc.id, start: sf0, end: sfN });
    environmentByScene[sc.id] = sc.env ?? script.environment;

    for (const [id, c] of Object.entries(sc.cast ?? {})) {
      if (!cast[id]) continue;
      cast[id].x = c.x;
      if (c.facing) cast[id].facing = c.facing;
    }

    // ---- per-scene dense streams per character ----
    const streams: Record<string, FrameBuf> = {};
    const events: Record<string, { frame: number; emo: any }[]> = {};
    for (const id of Object.keys(cast)) {
      streams[id] = makeIdle(cast[id].style, {
        x: cast[id].x, facing: cast[id].facing, startFrame: sf0, frames: sfN - sf0, fps,
      });
      events[id] = [];
    }

    const actions = [...(sc.actions ?? [])].sort((a, b) => (a.t0 ?? 0) - (b.t0 ?? 0));
    for (const act of actions) {
      const st = cast[act.char];
      if (!st) continue;
      const a0 = sf0 + Math.round((act.t0 ?? 0) * fps);
      switch (act.do) {
        case 'face': {
          const after = makeIdle(st.style, { x: st.x, facing: act.facing, startFrame: a0, frames: sfN - a0, fps });
          const pre = makeIdle(st.style, { x: st.x, facing: st.facing, startFrame: 0, frames: 8, fps });
          blendInto(after, pre, 0, 6);
          copyInto(streams[act.char], after, a0 - sf0);
          st.facing = act.facing;
          break;
        }
        case 'walk':
        case 'run': {
          const speed = act.speed ?? (act.do === 'run' ? 260 : 120);
          // optional push-while-walking: hands IK to the moving prop's handles
          let handTargets: [(x: number, t: number) => [number, number], (x: number, t: number) => [number, number]] | null = null;
          if ('pushProp' in act && act.pushProp) {
            const prop = props.find((p) => p.id === act.pushProp);
            const boxSpec = (sc.props ?? []).find((p) => p.id === act.pushProp && 'moving' in p && p.moving);
            const mspec = boxSpec && 'moving' in boxSpec ? boxSpec.moving : undefined;
            if (prop && mspec) {
              const w = prop.w, h = prop.h;
              const aT0 = act.t0 ?? 0;
              handTargets = [
                (_x, t) => {
                  const st2 = aT0 + t;
                  const k = clamp((st2 - mspec.t0) / Math.max(0.01, mspec.t1 - mspec.t0), 0, 1);
                  const bx = st2 < mspec.t0 ? mspec.from : mspec.from + (mspec.to - mspec.from) * easeInOut(k);
                  return [bx - w / 2 - 4, -h + 16];
                },
                (_x, t) => {
                  const st2 = aT0 + t;
                  const k = clamp((st2 - mspec.t0) / Math.max(0.01, mspec.t1 - mspec.t0), 0, 1);
                  const bx = st2 < mspec.t0 ? mspec.from : mspec.from + (mspec.to - mspec.from) * easeInOut(k);
                  return [bx - w / 2 + 2, -h + 10];
                },
              ];
            }
          }
          const w = makeWalk(st.style, {
            from: st.x, to: act.to, speed, startFrame: a0, frames: sfN - a0, fps,
            handTargets,
          });
          blendInto(streams[act.char], w.frames, a0 - sf0, 6);
          st.x = act.to;
          st.facing = act.to >= act.from ? 1 : -1;
          break;
        }
        case 'push': {
          const prop = props.find((p) => p.id === act.prop);
          const specX = (sc.props ?? []).find((p) => p.id === act.prop)?.x ?? st.x + 60 * st.facing;
          const propX = prop ? latestPropX(prop, a0) : specX;
          const res = pushStream({
            style: st.style, startFrame: a0, frames: sfN - a0, fps,
            x: st.x,   // author positions the character at the box
            facing: st.facing, propX, propW: prop?.w ?? 64, propH: prop?.h ?? 64,
            strain: true,
          });
          blendInto(streams[act.char], res.frames, a0 - sf0, 6);
          events[act.char].push(...res.events);
          if (!act.moving) {
            shakeEvents.push({ frame: a0 + Math.round(fps * 0.25), amp: 6, dur: 0.28 });
            shakeEvents.push({ frame: a0 + Math.round(fps * 1.35), amp: 5, dur: 0.24 });
          }
          break;
        }
        case 'point':
        case 'present': {
          const res = aimStream({
            style: st.style, startFrame: a0, frames: sfN - a0, fps,
            x: st.x, facing: st.facing,
            target: act.at, arm: 'R', support: act.do === 'present',
          });
          blendInto(streams[act.char], res.frames, a0 - sf0, 6);
          events[act.char].push(...res.events);
          break;
        }
        case 'wave': {
          const res = waveStream({
            style: st.style, startFrame: a0, frames: sfN - a0, fps,
            x: st.x, facing: st.facing, arm: 'R',
          });
          blendInto(streams[act.char], res.frames, a0 - sf0, 6);
          events[act.char].push(...res.events);
          break;
        }
        case 'reactSurprise': {
          const res = reactSurprise({
            style: st.style, startFrame: a0, frames: Math.min(sfN - a0, Math.round(fps * 1.4)), fps,
            x: st.x, facing: st.facing,
          });
          blendInto(streams[act.char], res.frames, a0 - sf0, 4);
          events[act.char].push(...res.events);
          break;
        }
        case 'cheer': {
          const res = cheerStream({
            style: st.style, startFrame: a0, frames: sfN - a0, fps,
            x: st.x, facing: st.facing,
          });
          blendInto(streams[act.char], res.frames, a0 - sf0, 6);
          events[act.char].push(...res.events);
          break;
        }
        case 'laugh': {
          const res = laughStream({
            style: st.style, startFrame: a0, frames: sfN - a0, fps,
            x: st.x, facing: st.facing,
          });
          blendInto(streams[act.char], res.frames, a0 - sf0, 6);
          events[act.char].push(...res.events);
          break;
        }
        case 'stumble': {
          const res = stumbleStream({
            style: st.style, startFrame: a0, frames: Math.min(sfN - a0, Math.round(fps * 1.5)), fps,
            x: st.x, facing: st.facing,
          });
          blendInto(streams[act.char], res.frames, a0 - sf0, 4);
          events[act.char].push(...res.events);
          shakeEvents.push(...(res.shake ?? []));
          break;
        }
        case 'sit': {
          const bench = props.find((p) => p.type === 'bench');
          const res = sitStream({
            style: st.style, startFrame: a0, frames: sfN - a0, fps,
            x: st.x, facing: st.facing,
            seatX: bench ? latestPropX(bench, a0) : st.x,
            seatY: -34,
          });
          blendInto(streams[act.char], res.frames, a0 - sf0, 6);
          events[act.char].push(...res.events);
          break;
        }
        case 'jump':
        case 'land': {
          const opts = { style: st.style, startFrame: a0, frames: Math.min(sfN-a0, Math.round((act.dur ?? 1.15)*fps)), fps, x: st.x, facing: st.facing, height: act.height };
          const res = act.do === 'jump' ? jumpStream(opts) : landStream(opts);
          blendInto(streams[act.char], res.frames, a0-sf0, 7); events[act.char].push(...res.events); break;
        }
        case 'clap': {
          const res = clapStream({ style: st.style, startFrame:a0, frames:Math.min(sfN-a0,Math.round((act.dur??1.8)*fps)), fps, x:st.x, facing:st.facing });
          blendInto(streams[act.char],res.frames,a0-sf0,7); events[act.char].push(...res.events); break;
        }
        case 'dance': {
          const res = danceStream({ style:st.style,startFrame:a0,frames:Math.min(sfN-a0,Math.round((act.dur??3)*fps)),fps,x:st.x,facing:st.facing });
          blendInto(streams[act.char],res.frames,a0-sf0,8); events[act.char].push(...res.events); break;
        }
        case 'pull':
        case 'pickUp':
        case 'throw': {
          const spec=(sc.props??[]).find(p=>p.id===act.prop);
          const propX=spec?.x ?? st.x+60*st.facing, propH=spec && 'h' in spec ? (spec.h??64) : 64;
          const opts={style:st.style,startFrame:a0,frames:Math.min(sfN-a0,Math.round((act.dur??1.5)*fps)),fps,x:st.x,facing:st.facing,propX,propH};
          const res=act.do==='pull'?pullStream(opts):act.do==='pickUp'?pickupStream(opts):throwStream(opts);
          blendInto(streams[act.char],res.frames,a0-sf0,7); events[act.char].push(...res.events); break;
        }
        case 'carry': {
          const res=carryStream({style:st.style,startFrame:a0,frames:Math.min(sfN-a0,Math.round((act.dur??2)*fps)),fps,x:st.x,facing:st.facing});
          blendInto(streams[act.char],res.frames,a0-sf0,7); events[act.char].push(...res.events); break;
        }
        case 'drop': {
          const res=throwStream({style:st.style,startFrame:a0,frames:Math.min(sfN-a0,Math.round((act.dur??.8)*fps)),fps,x:st.x,facing:st.facing});
          blendInto(streams[act.char],res.frames,a0-sf0,5); events[act.char].push(...res.events); break;
        }
        case 'fall':
        case 'getUp':
        case 'stand': {
          const res=act.do==='fall'
            ? fallStream({style:st.style,startFrame:a0,frames:Math.min(sfN-a0,Math.round((act.dur??1.1)*fps)),fps,x:st.x,facing:st.facing})
            : getUpStream({style:st.style,startFrame:a0,frames:Math.min(sfN-a0,Math.round((act.dur??1.4)*fps)),fps,x:st.x,facing:st.facing});
          blendInto(streams[act.char],res.frames,a0-sf0,6); events[act.char].push(...res.events); shakeEvents.push(...(res.shake??[])); break;
        }
        case 'turn': {
          const res=turnStream({style:st.style,startFrame:a0,frames:Math.min(sfN-a0,Math.round((act.dur??.55)*fps)),fps,x:st.x,facing:act.facing,fromFacing:st.facing});
          blendInto(streams[act.char],res.frames,a0-sf0,6); st.facing=act.facing; break;
        }
        case 'expression': {
          events[act.char].push({ frame: a0, emo: act.emotion });
          if (act.dur) events[act.char].push({ frame: a0 + Math.round(act.dur * fps), emo: 'neutral' });
          break;
        }
        case 'talkGestures': {
          const info = act as any;
          const li = info.line ?? 0;
          const every = info.stressEvery ?? 3;
          const line = (sc.dialogue ?? [])[li];
          if (line) {
            const lineT0 = (line as any)._t0 ?? 0;
            const words = wordsFor(line.text, line.duration ?? 3, fps);
            const times: number[] = [];
            words.forEach((w, idx) => {
              if (idx % every === 0 || idx === words.length - 1) times.push(lineT0 + w.start / fps);
            });
            const res = talkStream({
              style: st.style, startFrame: a0, frames: sfN - a0, fps,
              x: st.x, facing: st.facing, wordTimes: times,
            });
            blendInto(streams[act.char], res.frames, a0 - sf0, 6);
            events[act.char].push(...res.events);
          }
          break;
        }
        case 'approach': {
          const target = cast[(act as any).target];
          if (!target) break;
          const gap = 60;
          const to = target.x - Math.sign(target.x - st.x || 1) * gap;
          const w = makeWalk(st.style, {
            from: st.x, to, speed: 90,
            startFrame: a0, frames: sfN - a0, fps,
          });
          blendInto(streams[act.char], w.frames, a0 - sf0, 8);
          st.x = to;
          st.facing = (target.x - to) > 0 ? 1 : -1;
          break;
        }
        case 'retreat': {
          const target = cast[(act as any).target];
          if (!target) break;
          const dir = target.x > st.x ? -1 : 1;
          const to = st.x + dir * 60;
          const w = makeWalk(st.style, {
            from: st.x, to, speed: 100,
            startFrame: a0, frames: sfN - a0, fps,
          });
          blendInto(streams[act.char], w.frames, a0 - sf0, 8);
          st.x = to;
          break;
        }
        case 'faceToward': {
          const target = cast[(act as any).target];
          if (!target) break;
          st.facing = (target.x - st.x) > 0 ? 1 : -1;
          break;
        }
        case 'leanIn': {
          const target = cast[(act as any).target];
          if (!target) break;
          const res = leanInStream({
            style: st.style, startFrame: a0,
            frames: Math.min(sfN - a0, Math.round(((act as any).dur ?? 1) * fps)),
            fps, x: st.x,
            facing: ((target.x - st.x) > 0 ? 1 : -1) as 1 | -1,
            targetX: target.x,
          });
          blendInto(streams[act.char], res.frames, a0 - sf0, 6);
          events[act.char].push(...res.events);
          break;
        }
        case 'recoil': {
          const target = cast[(act as any).target];
          if (!target) break;
          const res = recoilStream({
            style: st.style, startFrame: a0,
            frames: Math.min(sfN - a0, Math.round(((act as any).dur ?? 0.7) * fps)),
            fps, x: st.x,
            facing: ((target.x - st.x) > 0 ? 1 : -1) as 1 | -1,
            awayFrom: target.x,
          });
          blendInto(streams[act.char], res.frames, a0 - sf0, 6);
          events[act.char].push(...res.events);
          st.x = res.exitX ?? st.x;
          break;
        }
      }
    }

    // ---- talk faces, captions, audio ----
    (sc.dialogue ?? []).forEach((line, li) => {
      const t0 = (line as any)._t0 ?? 0;
      const dur = line.duration ?? 3;
      const f0 = sf0 + Math.round(t0 * fps);
      const f1 = f0 + Math.round(dur * fps);
      if (line.who !== 'narr' && events[line.who]) {
        events[line.who].push({ frame: f0, emo: 'talk' });

    // ---- dialogue-driven facial reactions ----
    // Overlay short emotion flashes driven by what is being said, on top of
    // the base talk/neutral cycle. Fires only for characters actually on
    // stage; the narrator line (who='narr') never affects a character's face.
    (sc.dialogue ?? []).forEach((line) => {
      if (!line.who || line.who === 'narr') return;
      if (!cast[line.who] || !events[line.who]) return;
      const startF = sf0 + Math.round(((line as any)._t0 ?? 0) * fps);
      const durF = Math.round((line.duration ?? 2) * fps);
      const base = 'talk' as const;
      const reactions = reactionsForDialogue(line.text, base, startF, durF, fps);
      if (reactions.length) events[line.who].push(...reactions);
    });
        events[line.who].push({ frame: f1 + 4, emo: 'neutral' });
      }
      const n = narration[`${si}:${li}`];
      const words = wordsFor(line.text, dur, fps).map((w) => ({
        w: w.w, start: w.start + f0, end: w.end + f0,
      }));
      captions.push({ who: line.who, text: line.text, frameStart: f0, frameEnd: f1 + 8, words });
      if (n) audio.push({ file: n.file, frameStart: f0, who: line.who });
    });

    // ---- props ----
    for (const p of sc.props ?? []) {
      if (p.type === 'box') {
        const w = p.w ?? 64, h = p.h ?? 64;
        const existingTrack = props.find((q) => q.id === p.id && q.type === 'box');
        const frames = existingTrack?.frames ?? Array.from({ length: durationFrames }, (_, frame) => ({ frame, x: p.x, y: 0, rot: 0 }));
        for (let i = 0; i < sfN - sf0; i++) {
          const t = i / fps;
          let x = p.x, y = 0, rot = 0;
          if (p.moving && t >= p.moving.t0) {
            const k = clamp((t - p.moving.t0) / Math.max(0.01, p.moving.t1 - p.moving.t0), 0, 1);
            x = p.moving.from + (p.moving.to - p.moving.from) * easeInOut(k);
            rot = k > 0 && k < 1 ? Math.sin(t * 2 * Math.PI * 5) * 0.8 : 0;
          }

          // Object ownership is resolved from the same character hand joints
          // used by the renderer. Pickup blends from the floor into the grip;
          // carry remains attached until a throw/drop release event.
          const objectActions = actions.filter((a: any) => a.prop === p.id && ['pickUp','carry','throw','drop'].includes(a.do));
          let interaction: any = null;
          for (const candidate of objectActions) if ((candidate.t0 ?? 0) <= t) interaction = candidate;
          if (interaction) {
            const charFrames = streams[interaction.char];
            const actionStart = interaction.t0 ?? 0;
            const actionDur = interaction.dur ?? (interaction.do === 'carry' ? 2 : 1.5);
            const releaseAt = actionStart + actionDur * 0.62;
            const handAt = (seconds: number) => {
              const idx = clamp(Math.round(seconds * fps), 0, Math.max(0, (charFrames?.length ?? 1) - 1));
              const sk = charFrames?.[idx];
              return sk ? { x: (sk.haL[0] + sk.haR[0]) / 2, y: (sk.haL[1] + sk.haR[1]) / 2 + h } : { x: p.x, y: 0 };
            };
            if (interaction.do === 'pickUp') {
              const grip = handAt(t);
              const k = easeInOut(clamp((t - actionStart) / Math.max(0.2, actionDur), 0, 1));
              x = lerp(p.x, grip.x, k); y = lerp(0, grip.y, k);
            } else if (interaction.do === 'carry') {
              const grip = handAt(t); x = grip.x; y = grip.y;
            } else if (t < releaseAt) {
              const grip = handAt(t); x = grip.x; y = grip.y;
            } else {
              const release = handAt(releaseAt);
              const dt = t - releaseAt;
              const facing = cast[interaction.char]?.facing ?? 1;
              if (interaction.do === 'throw') {
                x = release.x + facing * 250 * dt;
                y = Math.min(0, release.y - 250 * dt + 260 * dt * dt);
                rot = facing * dt * 220;
              } else {
                x = release.x;
                y = Math.min(0, release.y + 520 * dt * dt);
                rot = 0;
              }
            }
          }
          frames[sf0 + i] = { frame: sf0 + i, x, y, rot };
        }
        if (existingTrack) {
          existingTrack.w = w; existingTrack.h = h; existingTrack.frames = frames;
          existingTrack.handles = [{ x: -w / 2 + 8, y: -h + 12 }, { x: -w / 2 + 22, y: -h + 14 }];
        } else {
          props.push({ id: p.id, type: 'box', w, h, color: '#b9814a', color2: '#8f5f30', z: 1, frames, handles: [
            { x: -w / 2 + 8, y: -h + 12 }, { x: -w / 2 + 22, y: -h + 14 },
          ] });
        }
      } else {
        if (!props.find((q) => q.id === p.id)) {
          props.push(staticProp(p.id, p.type, p.x));
        }
      }
    }

    // ---- overlays (seconds -> frames) ----
    for (const o of sc.overlays ?? []) {
      const ov = o as SceneOverlay;
      const f0 = sf0 + Math.round(ov.t0 * fps);
      const dur = Math.max(1, Math.round((ov.t1 - ov.t0) * fps));
      if (ov.type === 'arrows') {
        overlays.push({ type: 'arrows', frame: f0, dur, arrows: ov.arrows });
      } else if (ov.type === 'formula') {
        overlays.push({ type: 'formula', frame: f0, dur, text: ov.text });
      } else {
        overlays.push({ type: 'title', frame: f0, dur, text: ov.text, sub: ov.sub });
      }
    }

    // ---- transitions ----
    if (sc.enter?.type === 'wipe') {
      transitions.push({ type: 'wipe', frame: sf0, dur: Math.round((sc.enter.dur ?? 0.5) * fps) });
    }

    // ---- camera ----
    buildCamera(sc, {
      sf0, sfN, fps, W, H, cast, streams,
      onShake: (e) => shakeEvents.push(e),
      onCam: (k) => cameraKeys.push(k),
    });

    // ---- concatenate character tracks ----
    for (const id of Object.keys(cast)) {
      let track = characters.find((c) => c.id === id);
      if (!track) {
        track = { id, style: cast[id].style, z: cast[id].z, frames: [], faceEvents: [] };
        characters.push(track);
      }
      while (track.frames.length < sf0) track.frames.push(parkedFrame(cast[id].style));
      track.frames.push(...streams[id]);
      track.faceEvents.push(...events[id]);
    }
  });

  // Face events must be chronological: action cues and dialogue cues are collected in separate passes.
  for (const t of characters) t.faceEvents.sort((a, b) => a.frame - b.frame);

  // pad to duration
  for (const t of characters) {
    while (t.frames.length < durationFrames) t.frames.push(parkedFrame(t.style));
  }
  shakeEvents.sort((a, b) => a.frame - b.frame);

  return {
    version: '1.0',
    fps, width: W, height: H,
    durationFrames,
    groundY: 0,
    camera: cameraKeys,
    shakeEvents,
    characters,
    props,
    environment: script.environment,
    environmentByScene,
    sceneSpans,
    overlays,
    captions,
    audio,
    transitions,
  };
}

// ---------------- camera builder ----------------

function buildCamera(
  sc: Scene,
  ctx: {
    sf0: number; sfN: number; fps: number; W: number; H: number;
    cast: Record<string, CharState>; streams: Record<string, FrameBuf>;
    onShake: (e: ShakeEvent) => void;
    onCam: (k: CameraKeyframe) => void;
  },
) {
  const { sf0, sfN, fps, W, H } = ctx;
  const intents = (sc.camera && sc.camera.length > 0) ? sc.camera : autoDirector(sc, cast, sc.actions ?? []);
  type Seg = { f0: number; f1: number; kind: string; p: any };
  const segs: Seg[] = [];
  intents.forEach((it, idx) => {
    if (it.do === 'shake') {
      ctx.onShake({ frame: sf0 + Math.round(it.at * fps), amp: it.amp ?? 6, dur: it.dur ?? 0.3 });
      return;
    }
    const at = Math.round((it.at ?? idx * 2.6) * fps);
    const dur = Math.round(('dur' in it && it.dur ? it.dur : 2.4) * fps);
    segs.push({ f0: clamp(at, 0, sfN - 1), f1: clamp(at + dur, 0, sfN), kind: it.do, p: it as any });
  });
  segs.sort((a, b) => a.f0 - b.f0);
  if (segs.length === 0 || segs[0].f0 > 0) {
    segs.unshift({ f0: 0, f1: segs[0]?.f0 ?? sfN, kind: 'establish', p: { do: 'establish' } });
  }

  const exitZoom = sc.exit?.type === 'zoomThrough';
  const enterZoom = sc.enter?.type === 'zoomThrough';
  const exitFrames = exitZoom ? Math.round(0.45 * fps) : 0;
  const enterFrames = enterZoom ? Math.round(0.55 * fps) : 0;

  const charXAt = (id: string, abs: number): number => {
    const buf = ctx.streams[id];
    const i = abs - sf0;
    if (buf && i >= 0 && i < buf.length) return buf[i].pel[0];
    return ctx.cast[id]?.x ?? 0;
  };

  let prev = { cx: 0, scale: 1.75 };
  for (let i = 0; i < sfN - sf0; i++) {
    const abs = sf0 + i;
    const seg = [...segs].reverse().find((s) => i >= s.f0) ?? segs[0];
    const p = seg.p;
    let cx = prev.cx, scale = prev.scale, dy = 0;
    if (seg.kind === 'establish') {
      const xs = Object.values(ctx.cast).filter((c) => Math.abs(c.x) < 500).map((c) => c.x);
      const baseX = xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
      cx = baseX + (p.drift ?? 0) * (i / (sfN - sf0));
      scale = p.scale ?? 1.75;
    } else if (seg.kind === 'focus') {
      cx = p.point[0];
      scale = p.scale ?? 2.7;
      dy = p.point[1] > -170 ? -36 : 0;
    } else if (seg.kind === 'follow') {
      cx = charXAt(p.target, abs);
      scale = p.scale ?? 1.95;
    } else if (seg.kind === 'twoShot') {
      const x1 = charXAt(p.targets[0], abs);
      const x2 = charXAt(p.targets[1], abs);
      cx = (x1 + x2) / 2;
      scale = p.scale ?? twoShotScale(Math.abs(x2 - x1), W);
    }
    const k = clamp((i - seg.f0) / 14, 0, 1);
    const e = easeInOut(k);
    cx = lerp(prev.cx, cx, e);
    scale = lerp(prev.scale, scale, e);

    let extra = 1;
    if (exitZoom && i >= sfN - sf0 - exitFrames) {
      const zz = easeInOut((i - (sfN - sf0 - exitFrames)) / exitFrames);
      extra = 1 + zz * 1.3;
    }
    if (enterZoom && i < enterFrames) {
      const zz = easeInOut(1 - i / enterFrames);
      extra = 1 - (1 - zz) * 0.62;
    }
    ctx.onCam({ cx, cy: camY(scale * extra, H, dy), scale: scale * extra, rot: 0 });
    prev = { cx, scale };
  }
}
