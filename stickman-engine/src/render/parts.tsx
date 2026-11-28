/**
 * SVG drawing primitives for the stickman engine: characters with faces,
 * props, environments, VFX, captions and overlays.
 * Everything draws in world coordinates; the composition wraps layers
 * with the camera transform.
 */
import React from 'react';
import { CharStyle, SkeletonFrame, Emotion, PropTrack, EnvironmentSpec } from '../rig/character';
import { rng } from '../rig/geometry';
import { Viseme, syllableToViseme, visemeAtFrame } from './visemes';

export const INK = '#1c1c1c';


function mouthStateForViseme(v: Viseme): { shape: Viseme; open: number; round: number } {
  const OPEN: Record<Viseme, number> = { closed: 0.02, M: 0.03, FV: 0.15, TH: 0.35, S: 0.20, A: 0.95, E: 0.45, I: 0.25, O: 0.75, U: 0.55 };
  const ROUND: Record<Viseme, number> = { closed: 0.5, M: 0.5, FV: 0.4, TH: 0.5, S: 0.6, A: 0.3, E: 0.2, I: 0.15, O: 0.9, U: 0.95 };
  return { shape: v, open: OPEN[v], round: ROUND[v] };
}

// ---------------- character ----------------

function faceGroup(style: CharStyle, head: [number, number], facing: 1 | -1, emo: Emotion, frame: number, viseme?: Viseme): React.ReactElement {
  const hx = head[0], hy = head[1];
  const r = style.headR;
  const dark = style.headFill === '#ffffff' ? INK : '#ffffff';
  const exL = hx - facing * r * 0.34, exR = hx + facing * r * 0.20;
  const eyeY = hy - r * 0.12;
  const browY = eyeY - r * 0.24;
  const mouthY = hy + r * 0.34;
  const els: React.ReactElement[] = [];
  const key = `${frame}`;

  const eyeDot = (cx: number, rr = 4.6) =>
    <circle key={`e${cx}`} cx={cx} cy={eyeY} r={rr} fill={dark} />;
  const eyeWide = (cx: number) => (
    <g key={`w${cx}`}>
      <circle cx={cx} cy={eyeY} r={7.6} fill={style.headFill === '#ffffff' ? '#ffffff' : '#181818'} stroke={dark} strokeWidth={2.4} />
      <circle cx={cx + facing * 1.4} cy={eyeY + 1} r={3.4} fill={dark} />
    </g>
  );
  const eyeHappyArc = (cx: number) => (
    <path key={`h${cx}`} d={`M ${cx - 7} ${eyeY + 2} Q ${cx} ${eyeY - 7} ${cx + 7} ${eyeY + 2}`}
      stroke={dark} strokeWidth={3.4} fill="none" strokeLinecap="round" />
  );
  const brow = (cx: number, innerUp: number) => {
    const inner = cx + facing * 6, outer = cx - facing * 7;
    return <path key={`b${cx}`} d={`M ${outer} ${browY + (facing > 0 ? innerUp * -0.3 : innerUp * -0.3)} L ${inner} ${browY - innerUp}`}
      stroke={dark} strokeWidth={3.4} fill="none" strokeLinecap="round" />;
  };

  let mouth: React.ReactElement;
  switch (emo) {
    case 'bigsmile':
      mouth = <path d={`M ${hx - facing * 14} ${mouthY - 4} Q ${hx + facing * 2} ${mouthY + 10} ${hx + facing * 16} ${mouthY - 5}`}
        stroke={dark} strokeWidth={3.6} fill="none" strokeLinecap="round" />;
      break;
    case 'happy':
      mouth = <path d={`M ${hx - facing * 11} ${mouthY} Q ${hx + facing * 2} ${mouthY + 8} ${hx + facing * 13} ${mouthY}`}
        stroke={dark} strokeWidth={3.4} fill="none" strokeLinecap="round" />;
      break;
    case 'sad':
    case 'crying':
      mouth = <path d={`M ${hx - facing * 11} ${mouthY + 5} Q ${hx} ${mouthY - 5} ${hx + facing * 11} ${mouthY + 5}`}
        stroke={dark} strokeWidth={3.4} fill="none" strokeLinecap="round" />;
      break;
    case 'angry':
      mouth = <path d={`M ${hx - facing * 10} ${mouthY + 4} L ${hx + facing * 10} ${mouthY - 2}`}
        stroke={dark} strokeWidth={3.6} fill="none" strokeLinecap="round" />;
      break;
    case 'confused':
      mouth = <path d={`M ${hx - facing * 9} ${mouthY + 2} Q ${hx} ${mouthY - 4} ${hx + facing * 10} ${mouthY + 4}`}
        stroke={dark} strokeWidth={3.2} fill="none" strokeLinecap="round" />;
      break;
    case 'worried':
      mouth = <path d={`M ${hx - facing * 9} ${mouthY + 3} Q ${hx + facing * 2} ${mouthY - 3} ${hx + facing * 12} ${mouthY + 2}`}
        stroke={dark} strokeWidth={3.2} fill="none" strokeLinecap="round" />;
      break;
    case 'surprised':
      mouth = <ellipse cx={hx + facing * 2} cy={mouthY + 2} rx={7.5} ry={10} fill={dark} />;
      break;
    case 'strain':
      mouth = <ellipse cx={hx + facing * 2} cy={mouthY + 1} rx={5.5} ry={6.5} fill={dark} />;
      break;
    case 'talk': {
      const open = 4.2 + Math.sin(frame * 0.55) * 2.2;
      mouth = <ellipse cx={hx + facing * 2} cy={mouthY} rx={5.4} ry={open} fill={dark} />;
      break;
    }
    default:
      mouth = <path d={`M ${hx - facing * 8} ${mouthY} L ${hx + facing * 9} ${mouthY}`}
        stroke={dark} strokeWidth={3.2} fill="none" strokeLinecap="round" />;
  }

  // If a viseme is provided (character is speaking), override the emotion mouth
  // with the current mouth shape. Between-words silence falls through to
  // 'closed' so the mouth rests between syllables, like real speech.
  if (viseme !== undefined) {
    const mv = mouthStateForViseme(viseme);
    if (mv.shape === 'closed' || mv.shape === 'M') {
      mouth = <path d={`M ${hx - facing * 9} ${mouthY} Q ${hx + facing * 2} ${mouthY + 1.5} ${hx + facing * 10} ${mouthY}`}
        stroke={dark} strokeWidth={3.2} fill="none" strokeLinecap="round" />;
    } else {
      const rx = 5.4 * (0.4 + 0.9 * (1 - mv.round));
      const ry = 4.2 + mv.open * 8.5;
      mouth = <ellipse cx={hx + facing * 2} cy={mouthY} rx={rx} ry={ry} fill={dark} />;
    }
  }

  // A deterministic blink cycle adds life without storing redundant face tracks.
  // Irregular blink: three sine waves at incommensurate frequencies beat
  // against each other so blinks feel organic instead of metronomic.
  // Seeded by the head X position so each character blinks independently.
  const seed = head[0] * 0.013;
  const t = frame / 30;
  const wave = Math.sin(t * 1.3 + seed) + Math.sin(t * 0.7 + seed * 1.7) + Math.sin(t * 2.1 + seed * 3.1);
  const blinking = wave > 1.85;
  const eyeChoice = (emo === 'surprised' || emo === 'fear') ? eyeWide : (emo === 'bigsmile' || emo === 'proud' || emo === 'happy') ? eyeHappyArc : eyeDot;
  const closedEye = (cx: number) => <path d={`M ${cx - 7} ${eyeY} Q ${cx} ${eyeY + 5} ${cx + 7} ${eyeY}`} stroke={dark} strokeWidth={3.4} fill="none" strokeLinecap="round" />;
  els.push(blinking || emo === 'wink' ? closedEye(exL) : eyeChoice(exL), blinking ? closedEye(exR) : eyeChoice(exR));

  if (emo === 'worried' || emo === 'sad' || emo === 'crying' || emo === 'fear') { els.push(brow(exL, 5), brow(exR, 5)); }
  if (emo === 'angry') { els.push(brow(exL, -8), brow(exR, -8)); }
  if (emo === 'confused') { els.push(brow(exL, 7), brow(exR, -4)); }
  if (emo === 'strain') { els.push(brow(exL, -5), brow(exR, -5)); }
  if (emo === 'surprised') {
    els.push(
      <path key={`sb1`} d={`M ${exL - 8} ${browY - 5} Q ${exL} ${browY - 9} ${exL + 8} ${browY - 5}`} stroke={dark} strokeWidth={3.2} fill="none" strokeLinecap="round" />,
      <path key={`sb2`} d={`M ${exR - 8} ${browY - 5} Q ${exR} ${browY - 9} ${exR + 8} ${browY - 5}`} stroke={dark} strokeWidth={3.2} fill="none" strokeLinecap="round" />,
    );
  }
  if (emo === 'worried' || emo === 'strain' || emo === 'fear' || emo === 'crying') {
    // sweat drop on the far side, gently animated
    const t = (frame % 45) / 45;
    const dy = t * 14;
    const op = 1 - t;
    els.push(
      <ellipse key="sweat" cx={hx - facing * (r * 0.62)} cy={hy - r * 0.28 + dy} rx={3.6} ry={5.2}
        fill="#5fb7e8" opacity={op} />,
    );
  }

  const tears = (emo === 'crying' || emo === 'sad') ? (
    <g fill="#62b9ed" opacity={emo === 'crying' ? 0.95 : 0.65}>
      <ellipse cx={exL} cy={eyeY + 16} rx={3.2} ry={7} />
      {emo === 'crying' && <ellipse cx={exR} cy={eyeY + 16} rx={3.2} ry={7} />}
    </g>
  ) : null;
  return <g key={key}>{els}{mouth}{tears}</g>;
}

export function Stickman({
  style, frame: sk, emotion, frameNo, mouth,
}: {
  style: CharStyle; frame: SkeletonFrame; emotion: Emotion; frameNo: number; mouth?: Viseme;
}) {
  const s = style;
  const sw = s.strokeW;
  const foot = (ankle: [number, number]) => {
    const dir = ankle[0] >= sk.pel[0] ? 1 : -1;
    return (
      <ellipse cx={ankle[0] + dir * 6} cy={ankle[1] + 3.4} rx={13} ry={6}
        fill={s.headFill === '#ffffff' ? INK : INK} />
    );
  };
  const limb = (pts: [number, number][]) =>
    <polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none"
      stroke={s.ink} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />;

  const garment = s.garment ? (
    <path
      d={`M ${sk.shL[0] - sw * 1.15} ${sk.shL[1] - 2}
          L ${sk.pel[0] - sw * 1.5} ${sk.pel[1] + 6}
          L ${sk.pel[0] + sw * 1.5} ${sk.pel[1] + 6}
          L ${sk.shR[0] + sw * 1.15} ${sk.shR[1] - 2}
          Q ${sk.neck[0]} ${sk.shL[1] - sw * 1.6} ${sk.shL[0] - sw * 1.15} ${sk.shL[1] - 2} Z`}
      fill={s.garment.color} stroke={s.ink} strokeWidth={3}
    />
  ) : null;

  const air = Math.max(0, -Math.min(sk.ftL[1], sk.ftR[1]));
  const shadowRx = Math.max(24, 46 - air * 0.35);
  const shadowOp = Math.max(0.04, 0.13 - air * 0.0009);

  return (
    <g>
      <ellipse cx={sk.pel[0]} cy={3.5} rx={shadowRx} ry={7} fill="#101820" opacity={shadowOp} />
      {/* far side */}
      {limb([sk.shL, sk.elL, sk.haL])}
      <circle cx={sk.haL[0]} cy={sk.haL[1]} r={s.handR} fill={s.ink} />
      {limb([sk.hipL, sk.knL, sk.ftL])}
      {foot(sk.ftL)}
      {/* torso */}
      {garment}
      {limb([sk.pel, sk.neck])}
      {/* head */}
      <circle cx={sk.head[0]} cy={sk.head[1]} r={s.headR}
        fill={s.headFill === 'none' ? 'none' : s.headFill} stroke={s.ink} strokeWidth={sw * 0.62} />
      {faceGroup(s, sk.head, sk.head[0] >= sk.pel[0] ? 1 : -1, emotion, frameNo, mouth)}
      {/* near side */}
      {limb([sk.hipR, sk.knR, sk.ftR])}
      {foot(sk.ftR)}
      {limb([sk.shR, sk.elR, sk.haR])}
      <circle cx={sk.haR[0]} cy={sk.haR[1]} r={s.handR} fill={s.ink} />
    </g>
  );
}

// ---------------- props ----------------

export function Prop({ prop, frameNo }: { prop: PropTrack; frameNo: number }) {
  const k = prop.frames[Math.min(frameNo, prop.frames.length - 1)] ?? prop.frames[0];
  if (!k) return null;
  const prev = prop.frames[Math.max(0, Math.min(frameNo, prop.frames.length - 1) - 1)] ?? k;
  const moving = Math.abs(k.x - prev.x) > 0.01;
  const els: React.ReactElement[] = [];
  if (prop.type === 'box') {
    const w = prop.w, h = prop.h, x = k.x, y = k.y;
    els.push(
      <g key="box" transform={`translate(${x} ${y}) rotate(${k.rot})`}>
        <rect x={-w / 2} y={-h} width={w} height={h} rx={5}
          fill={prop.color} stroke={INK} strokeWidth={3.4} />
        <line x1={-w / 2} y1={-h * 0.62} x2={w / 2} y2={-h * 0.62} stroke={prop.color2} strokeWidth={3} />
        <line x1={-w / 2} y1={-h * 0.30} x2={w / 2} y2={-h * 0.30} stroke={prop.color2} strokeWidth={3} />
        <path d={`M ${-w / 2 + 6} ${-h + 6} L ${w / 2 - 6} ${-6}`} stroke={prop.color2} strokeWidth={2.4} opacity={0.7} />
        {/* sliding dust puffs */}
        {moving && [0, 1, 2].map((i) => {
          const t = (frameNo * 7 + i * 23) % 30 / 30;
          return <circle key={`d${i}`} cx={-w / 2 - 6 - t * 26} cy={-4 - t * 7}
            r={3 + t * 5} fill="#c9bda8" opacity={0.5 * (1 - t)} />;
        })}
      </g>,
    );
  } else if (prop.type === 'bench') {
    const w = prop.w, x = k.x;
    els.push(
      <g key="bench">
        <rect x={x - w / 2} y={-34} width={w} height={9} rx={3} fill={prop.color} stroke={INK} strokeWidth={2.6} />
        <rect x={x - w / 2 + 8} y={-25} width={9} height={25} fill={prop.color2} stroke={INK} strokeWidth={2.2} />
        <rect x={x + w / 2 - 17} y={-25} width={9} height={25} fill={prop.color2} stroke={INK} strokeWidth={2.2} />
      </g>,
    );
  } else if (prop.type === 'lamppost') {
    const x = k.x;
    els.push(
      <g key="lamp">
        <rect x={x - 4} y={-205} width={8} height={205} fill={prop.color} stroke={INK} strokeWidth={2.4} />
        <path d={`M ${x - 4} ${-205} Q ${x} ${-228} ${x + 26} ${-224}`} stroke={prop.color} strokeWidth={7} fill="none" strokeLinecap="round" />
        <ellipse cx={x + 30} cy={-218} rx={11} ry={13} fill="#ffd76e" stroke={INK} strokeWidth={2.6} />
      </g>,
    );
  } else if (prop.type === 'plant') {
    const x = k.x;
    els.push(
      <g key="plant">
        <path d={`M ${x - 16} 0 L ${x - 12} -18 L ${x + 12} -18 L ${x + 16} 0 Z`} fill="#a86f3d" stroke={INK} strokeWidth={2.4} />
        {[0, 1, 2, 3].map((i) => (
          <ellipse key={i} cx={x + (i - 1.5) * 9} cy={-26 - (i % 2) * 8} rx={7} ry={14}
            fill={prop.color} stroke={prop.color2} strokeWidth={2} transform={`rotate(${(i - 1.5) * 14} ${x} -26)`} />
        ))}
      </g>,
    );
  } else if (prop.type === 'easel') {
    const x = k.x;
    els.push(
      <g key="easel">
        <line x1={x} y1={0} x2={x - 26} y2={-104} stroke={prop.color} strokeWidth={6} strokeLinecap="round" />
        <line x1={x} y1={0} x2={x + 26} y2={-104} stroke={prop.color} strokeWidth={6} strokeLinecap="round" />
        <line x1={x} y1={-40} x2={x} y2={-96} stroke={prop.color} strokeWidth={6} strokeLinecap="round" />
        <rect x={x - 40} y={-110} width={80} height={58} rx={4} fill="#fdfcf7" stroke={INK} strokeWidth={3} />
      </g>,
    );
  }
  return <g>{els}</g>;
}

// ---------------- environments ----------------

export function Environment({ env, cx, frameNo }: { env: EnvironmentSpec; cx: number; frameNo: number }) {
  if (env.type === 'street') return <StreetScene cx={cx} frameNo={frameNo} seed={env.seed} />;
  if (env.type === 'abstract') return <AbstractScene accent={env.accent} frameNo={frameNo} seed={env.seed} />;
  return <ClassroomScene cx={cx} frameNo={frameNo} seed={env.seed} />;
}

function StreetScene({ cx, frameNo, seed }: { cx: number; frameNo: number; seed: number }) {
  const r = rng(seed);
  const buildings: React.ReactNode[] = [];
  let bx = -900;
  while (bx < 900) {
    const w = 90 + r() * 130;
    const h = 130 + r() * 190;
    const tone = ['#d8dde2', '#ccd4da', '#c2cbd2'][Math.floor(r() * 3)];
    const winRows = Math.floor(h / 44);
    buildings.push(
      <g key={bx}>
        <rect x={bx} y={-h} width={w} height={h} fill={tone} stroke="#b6bfc7" strokeWidth={2} />
        {Array.from({ length: winRows }).map((_, ri) => (
          <rect key={ri} x={bx + 12} y={-h + 16 + ri * 40} width={w - 24} height={16} rx={2}
            fill={r() > 0.3 ? '#eef3f6' : '#dde5ea'} />
        ))}
      </g>,
    );
    bx += w + 14 + r() * 30;
  }
  const clouds = Array.from({ length: 4 }).map((_, i) => {
    const cxx = -700 + i * 430 + r() * 120;
    const cy = -330 - r() * 110;
    const drift = Math.sin(frameNo * 0.003 + i) * 14;
    return (
      <g key={i} opacity={0.85} transform={`translate(${cxx + drift - cx * 0.25} ${cy})`}>
        <ellipse cx={0} cy={0} rx={64} ry={20} fill="#ffffff" />
        <ellipse cx={-30} cy={-10} rx={40} ry={16} fill="#ffffff" />
        <ellipse cx={34} cy={-8} rx={44} ry={17} fill="#f4f7f9" />
      </g>
    );
  });
  return (
    <g>
      <defs>
        <linearGradient id="skyG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#a8d4ea" />
          <stop offset="70%" stopColor="#dbeef7" />
          <stop offset="100%" stopColor="#f2f8fb" />
        </linearGradient>
      </defs>
      <rect x={cx - 2200} y={-1400} width={4400} height={1400} fill="url(#skyG)" />
      <circle cx={cx * 0.9 - 480} cy={-430} r={56} fill="#ffe9a8" opacity={0.95} />
      {clouds}
      <g transform={`translate(${-cx * 0.18} 0)`}>{buildings}</g>
      {/* sidewalk + road */}
      <rect x={cx - 2200} y={-26} width={4400} height={26} fill="#d9dee1" />
      <rect x={cx - 2200} y={0} width={4400} height={130} fill="#8f9aa2" />
      <rect x={cx - 2200} y={0} width={4400} height={8} fill="#b9c2c8" />
      {Array.from({ length: 26 }).map((_, i) => (
        <rect key={i} x={-1000 + i * 90 + ((cx * 0.9) % 90)} y={54} width={46} height={7} rx={3} fill="#e8ecef" opacity={0.85} />
      ))}
    </g>
  );
}

function AbstractScene({ accent, frameNo, seed }: { accent: string; frameNo: number; seed: number }) {
  const r = rng(seed);
  const icons = Array.from({ length: 7 }).map((_, i) => {
    const x = -620 + i * 195 + r() * 60;
    const y = -300 - r() * 210;
    const bob = Math.sin(frameNo * 0.02 + i * 1.7) * 10;
    const kind = i % 3;
    return (
      <g key={i} transform={`translate(${x} ${y + bob})`} opacity={0.6}>
        {kind === 0 && (
          <g stroke={accent} strokeWidth={4} fill="none" strokeLinecap="round">
            <circle cx={0} cy={-6} r={16} />
            <line x1={-7} y1={16} x2={7} y2={16} />
            <line x1={-5} y1={22} x2={5} y2={22} />
            <path d="M -6 -8 Q 0 -22 6 -8" />
          </g>
        )}
        {kind === 1 && (
          <g stroke={accent} strokeWidth={4} fill="none">
            <circle cx={0} cy={0} r={11} />
            <ellipse cx={0} cy={0} rx={26} ry={10} />
            <ellipse cx={0} cy={0} rx={26} ry={10} transform="rotate(60)" />
            <ellipse cx={0} cy={0} rx={26} ry={10} transform="rotate(-60)" />
          </g>
        )}
        {kind === 2 && (
          <g stroke={accent} strokeWidth={4} fill="none" strokeLinecap="round">
            <circle cx={0} cy={0} r={13} />
            {[0, 60, 120, 180, 240, 300].map((a) => (
              <line key={a} x1={Math.cos((a * Math.PI) / 180) * 13} y1={Math.sin((a * Math.PI) / 180) * 13}
                x2={Math.cos((a * Math.PI) / 180) * 19} y2={Math.sin((a * Math.PI) / 180) * 19} />
            ))}
          </g>
        )}
      </g>
    );
  });
  return (
    <g>
      <defs>
        <radialGradient id="absG" cx="50%" cy="38%" r="85%">
          <stop offset="0%" stopColor="#eef6fb" />
          <stop offset="60%" stopColor="#dcebf5" />
          <stop offset="100%" stopColor="#c4dbe9" />
        </radialGradient>
      </defs>
      <rect x={-2400} y={-1400} width={4800} height={1600} fill="url(#absG)" />
      {icons}
      {/* ground glow */}
      <ellipse cx={0} cy={10} rx={900} ry={54} fill={accent} opacity={0.08} />
      <line x1={-2400} y1={0} x2={2400} y2={0} stroke="#b9d3e2" strokeWidth={3} />
    </g>
  );
}

function ClassroomScene({ cx, frameNo, seed }: { cx: number; frameNo: number; seed: number }) {
  void frameNo; void seed;
  return (
    <g>
      <defs>
        <linearGradient id="clsG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e8f1e4" />
          <stop offset="100%" stopColor="#f7fbf4" />
        </linearGradient>
      </defs>
      <rect x={cx - 2200} y={-1400} width={4400} height={1400} fill="url(#clsG)" />
      <rect x={cx - 2200} y={-210} width={4400} height={120} rx={6} fill="#3f6f56" opacity={0.12} />
      <rect x={cx - 2200} y={0} width={4400} height={140} fill="#dfe7d8" />
    </g>
  );
}

// ---------------- overlays ----------------

export function OverlayArrows({ arrows, appear }: { arrows: { from: [number, number]; to: [number, number]; color: string; label: string }[]; appear: number }) {
  const k = Math.min(1, appear / 9);
  return (
    <g opacity={k}>
      {arrows.map((a, i) => {
        const dx = a.to[0] - a.from[0], dy = a.to[1] - a.from[1];
        const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
        const L = Math.hypot(dx, dy);
        return (
          <g key={i} transform={`translate(${a.from[0]} ${a.from[1]}) rotate(${ang})`}>
            <line x1={0} y1={0} x2={L * k} y2={0} stroke={a.color} strokeWidth={9} strokeLinecap="round" />
            <path d={`M ${L * k} 0 L ${L * k - 20} -13 L ${L * k - 20} 13 Z`} fill={a.color} opacity={k > 0.85 ? 1 : 0} />
            <text x={L / 2} y={-16} textAnchor="middle" fontSize={26} fontWeight="700"
              fill={a.color} fontFamily="'DejaVu Sans', sans-serif">{a.label}</text>
          </g>
        );
      })}
    </g>
  );
}

export function FormulaCard({ text, appear }: { text: string; appear: number }) {
  const k = Math.min(1, appear / 10);
  // Auto-shrink the font so long formulas stay inside the card.
  // Card is 640px wide with ~40px side padding -> usable width ~560px.
  // Short formulas keep their 86px bold size; long ones shrink to 26px floor.
  const baseFont = 86;
  const maxTextWidth = 560;
  const estimate = (size: number) => text.length * size * 0.55;
  let fontSize = baseFont;
  while (estimate(fontSize) > maxTextWidth && fontSize > 26) {
    fontSize -= 4;
  }
  return (
    <g transform={`translate(0 ${(1 - k) * 40})`} opacity={k}>
      <rect x={40} y={800} width={640} height={210} rx={22} fill="#ffffff" opacity={0.94}
        stroke="#2285b7" strokeWidth={5} />
      <text x={360} y={925} textAnchor="middle" fontSize={fontSize} fontWeight="700" fill="#1a2530"
        fontFamily="'DejaVu Sans', sans-serif">{text}</text>
    </g>
  );
}

export function TitleCard({ text, sub, appear }: { text: string; sub?: string; appear: number }) {
  const k = Math.min(1, appear / 12);
  return (
    <g opacity={k}>
      <text x={360} y={210} textAnchor="middle" fontSize={54} fontWeight="800" fill="#14344a"
        fontFamily="'DejaVu Sans', sans-serif">{text}</text>
      {sub && <text x={360} y={262} textAnchor="middle" fontSize={30} fill="#4a6577"
        fontFamily="'DejaVu Sans', sans-serif">{sub}</text>}
    </g>
  );
}

// ---------------- captions ----------------

export function Captions({ caption, frameNo, speakerColor }: {
  caption: { text: string; words: { w: string; start: number; end: number }[] };
  frameNo: number; speakerColor: string;
}) {
  // wrap into two lines, then render each line as one <text> with tspans
  // so spacing and centering are handled by SVG itself (no manual x math)
  const MAX = 32;
  const words = caption.words;
  const lines: typeof words[] = [[]];
  let cnt = 0;
  for (const w of words) {
    if (cnt + w.w.length + 1 > MAX) { lines.push([]); cnt = 0; }
    lines[lines.length - 1].push(w);
    cnt += w.w.length + 1;
  }
  const activeWord = (() => {
    const idx = words.findIndex((w) => frameNo >= w.start && frameNo <= w.end);
    return idx >= 0 ? words[idx].w : null;
  })();
  const lineH = 42;
  const boxH = lines.length * lineH + 44;
  const boxTop = 1224 - boxH;
  const baseY = boxTop + 52;
  return (
    <g>
      <rect x={24} y={boxTop} width={672} height={boxH} rx={16} fill="#0e1620" opacity={0.62} />
      {lines.map((ln, li) => (
        <text key={li} x={376} y={baseY + li * lineH} textAnchor="middle"
          fontSize={29} fontFamily="'DejaVu Sans', sans-serif">
          {ln.map((w, wi) => (
            <tspan key={wi} fill={w.w === activeWord ? '#ffd75e' : '#ffffff'}
              fontWeight={w.w === activeWord ? 800 : 600}>{w.w}{' '}</tspan>
          ))}
        </text>
      ))}
      <circle cx={58} cy={1224 - boxH / 2} r={9} fill={speakerColor} />
    </g>
  );
}

// ---------------- transitions ----------------

export function Wipe({ progress }: { progress: number }) {
  // 0..0.5 covers the screen from the left, 0.5..1 reveals to the right
  const p = progress;
  let x = 0, w = 0;
  if (p < 0.5) { x = 0; w = 720 * (p / 0.5); }
  else { w = 720 * (1 - (p - 0.5) / 0.5); x = 720 * ((p - 0.5) / 0.5); }
  return <rect x={x} y={0} width={w} height={1280} fill="#17222c" />;
}
