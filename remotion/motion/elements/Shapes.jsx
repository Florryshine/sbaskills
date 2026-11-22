// Shape vocabulary for the Motion Graphics Engine.
// Every primitive is pure SVG/div geometry driven by the current frame —
// no external assets, fully deterministic.

import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { ease, window, drift } from '../easing.js';

export function ShapeRing({ x, y, r, stroke, strokeWidth = 6, opacity = 1, progress = 1, rotate = 0, dash = false }) {
  const circumference = 2 * Math.PI * r;
  return (
    <svg style={{ position: 'absolute', left: x - r, top: y - r, width: r * 2, height: r * 2, overflow: 'visible' }} viewBox={`0 0 ${r * 2} ${r * 2}`}>
      <circle
        cx={r} cy={r} r={Math.max(1, r - strokeWidth / 2)}
        fill="none" stroke={stroke} strokeWidth={strokeWidth} opacity={opacity}
        strokeLinecap="round"
        strokeDasharray={dash ? `${circumference * progress} ${circumference}` : undefined}
        transform={`rotate(${rotate} ${r} ${r})`}
      />
    </svg>
  );
}

export function ShapePolygon({ x, y, r, sides = 3, stroke, fill = 'none', strokeWidth = 6, opacity = 1, rotate = 0 }) {
  const points = [];
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2 - Math.PI / 2;
    points.push(`${r + r * Math.cos(a)},${r + r * Math.sin(a)}`);
  }
  return (
    <svg style={{ position: 'absolute', left: x - r, top: y - r, width: r * 2, height: r * 2, overflow: 'visible' }} viewBox={`0 0 ${r * 2} ${r * 2}`}>
      <polygon points={points.join(' ')} fill={fill} stroke={stroke} strokeWidth={strokeWidth} opacity={opacity} transform={`rotate(${rotate} ${r} ${r})`} />
    </svg>
  );
}

export function ShapeLine({ x, y, length, angle = 0, stroke, strokeWidth = 6, opacity = 1, drawProgress = 1, cap = 'round' }) {
  const scaleX = Math.max(0.001, drawProgress);
  return (
    <div style={{
      position: 'absolute', left: x, top: y, width: length, height: strokeWidth,
      background: stroke, borderRadius: strokeWidth, opacity,
      transformOrigin: 'left center',
      transform: `rotate(${angle}deg) scaleX(${scaleX})`,
    }} />
  );
}

export function ShapeDot({ x, y, r, fill, opacity = 1, scale = 1 }) {
  return (
    <div style={{
      position: 'absolute', left: x - r, top: y - r, width: r * 2, height: r * 2,
      borderRadius: '50%', background: fill, opacity,
      transform: `scale(${scale})`,
    }} />
  );
}

export function ShapeBracket({ x, y, w, h, stroke, strokeWidth = 8, opacity = 1, side = 'left', progress = 1 }) {
  const draw = Math.max(0.001, Math.min(1, progress));
  const p = side === 'left' ? 1 : -1;
  return (
    <svg style={{ position: 'absolute', left: x, top: y, width: w, height: h, overflow: 'visible' }} viewBox={`0 0 ${w} ${h}`}>
      <path d={`M ${p > 0 ? w : 0} 0 H ${p > 0 ? 0 : w} V ${h} H ${p > 0 ? w : 0}`}
        fill="none" stroke={stroke} strokeWidth={strokeWidth} opacity={opacity}
        strokeLinecap="square"
        strokeDasharray={`${(w * 2 + h) * draw} ${w * 2 + h}`} />
    </svg>
  );
}

export function ShapeArrow({ x, y, size, stroke, strokeWidth = 8, opacity = 1, angle = 0, progress = 1 }) {
  const s = Math.max(0.001, progress);
  return (
    <svg style={{ position: 'absolute', left: x, top: y, width: size, height: size, overflow: 'visible' }} viewBox="0 0 100 100">
      <g opacity={opacity} transform={`rotate(${angle} 50 50) scale(${s})`} transform-origin="50 50">
        <line x1="10" y1="50" x2="82" y2="50" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" />
        <path d="M 62 26 L 86 50 L 62 74" fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

// Perspective grid floor (technology / data directions).
export function ShapePerspectiveGrid({ color, opacity = 0.16, horizon = 0.62, driftPhase = 0 }) {
  const { height, width } = useVideoConfig();
  const lines = [];
  const rows = 14;
  for (let i = 0; i < rows; i++) {
    const raw = ((i + (driftPhase * 0.4) % 1) / rows);
    const y = horizon * height + Math.pow(raw, 2.4) * (height * (1 - horizon));
    lines.push(<div key={`h${i}`} style={{ position: 'absolute', left: 0, top: y, width, height: 2, background: color, opacity: opacity * (0.3 + raw) }} />);
  }
  const cols = 9;
  for (let c = -4; c < cols; c++) {
    const xBottom = width / 2 + (c - cols / 2) * (width / cols) * 1.9;
    const xTop = width / 2 + (c - cols / 2) * (width / cols) * 0.36;
    lines.push(
      <div key={`v${c}`} style={{
        position: 'absolute', left: 0, top: horizon * height, width,
        height: height * (1 - horizon),
        background: `linear-gradient(to bottom, transparent, ${color})`,
        clipPath: `polygon(${xTop}px 0, ${xTop + 2}px 0, ${xBottom + 3}px 100%, ${xBottom}px 100%)`,
        opacity,
      }} />
    );
  }
  return <div style={{ position: 'absolute', inset: 0 }}>{lines}</div>;
}

// Flat grid (editorial / technical)
export function ShapeFlatGrid({ color, opacity = 0.1, cell = 90, phase = 0 }) {
  const { height, width } = useVideoConfig();
  return (
    <div style={{
      position: 'absolute', inset: -cell, opacity,
      backgroundImage: `linear-gradient(${color} 1px, transparent 1px), linear-gradient(90deg, ${color} 1px, transparent 1px)`,
      backgroundSize: `${cell}px ${cell}px`,
      backgroundPosition: `${phase}px ${phase}px`,
    }} />
  );
}

// Concentric orbit rings with satellite dots (science / space).
export function ShapeOrbits({ color, accent, opacity = 0.35, count = 4, spin = 0.02, seed = 1 }) {
  const frame = useCurrentFrame();
  const { height, width } = useVideoConfig();
  const cx = width / 2, cy = height * 0.42;
  const rings = [];
  for (let i = 0; i < count; i++) {
    const r = 140 + i * 170;
    const angle = frame * spin * (1 + i * 0.35) + i * 2.1 + seed;
    const satX = cx + Math.cos(angle) * r;
    const satY = cy + Math.sin(angle) * r * 0.36;
    rings.push(
      <div key={`ring${i}`}>
        <div style={{
          position: 'absolute', left: cx - r, top: cy - r * 0.36, width: r * 2, height: r * 0.72,
          border: `2px solid ${color}`, borderRadius: '50%', opacity: opacity * (1 - i * 0.12),
        }} />
        <div style={{
          position: 'absolute', left: satX - 9, top: satY - 9, width: 18, height: 18,
          borderRadius: '50%', background: accent, opacity: 0.85,
          boxShadow: `0 0 18px ${accent}`,
        }} />
      </div>
    );
  }
  return <div style={{ position: 'absolute', inset: 0 }}>{rings}</div>;
}

// Animated waveform bars (audio/pulse directions).
export function ShapeWaveform({ color, accent, opacity = 0.8, bars = 28, seed = 3, y, height: barMax = 260, width: bandWidth = 760 }) {
  const frame = useCurrentFrame();
  const { height, width } = useVideoConfig();
  const items = [];
  const baseY = y ?? height * 0.7;
  for (let i = 0; i < bars; i++) {
    const h = (Math.abs(drift(frame * 0.06, 0.9 + i * 0.13, 1.7 + i * 0.07)) * 0.7 + 0.18) * barMax;
    const x = width / 2 - bandWidth / 2 + (i / bars) * bandWidth;
    items.push(
      <div key={i} style={{
        position: 'absolute', left: x, top: baseY - h / 2, width: bandWidth / bars - 14,
        height: h, borderRadius: 8, background: i % 5 === 2 ? accent : color, opacity,
      }} />
    );
  }
  return <div style={{ position: 'absolute', inset: 0 }}>{items}</div>;
}

// Rotating light beam (cinematic / dramatic).
export function ShapeLightBeam({ color, opacity = 0.3, x = 0.5, y = -0.15, angle = 18, width = 380, length = 1.3 }) {
  const frame = useCurrentFrame();
  const { height } = useVideoConfig();
  const wobble = Math.sin(frame * 0.02) * 4;
  return (
    <div style={{
      position: 'absolute', left: x * 1080 - width / 2, top: y * height, width, height: height * length,
      background: `linear-gradient(to bottom, ${color}, transparent 78%)`,
      clipPath: 'polygon(38% 0, 62% 0, 100% 100%, 0 100%)',
      filter: 'blur(6px)',
      opacity,
      transform: `rotate(${angle + wobble}deg)`,
      transformOrigin: 'top center',
    }} />
  );
}

// Warning stripes (danger directions).
export function ShapeStripes({ color, bg, opacity = 0.85, stripeHeight = 26, angle = -45, bandHeight = 120 }) {
  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, height: bandHeight, opacity,
      backgroundImage: `repeating-linear-gradient(${angle}deg, ${color} 0 ${stripeHeight}px, ${bg} ${stripeHeight}px ${stripeHeight * 2}px)`,
    }} />
  );
}

// Big bracket frame used by definition / quote layouts.
export function ShapeFrame({ color, opacity = 0.8, inset = 60, strokeWidth = 6, corner = 44, progress = 1 }) {
  const p = Math.max(0.001, Math.min(1, progress));
  return (
    <div style={{
      position: 'absolute', left: inset, top: inset, right: inset, bottom: inset,
      opacity, pointerEvents: 'none',
      border: `${strokeWidth}px solid ${color}`,
      borderRadius: corner,
      clipPath: `inset(0 ${(1 - p) * 50}% 0 ${(1 - p) * 50}%)`,
    }} />
  );
}

// Tick marks arc for counters.
export function ShapeTickArc({ color, accent, x, y, r, ticks = 24, progress = 1 }) {
  const items = [];
  for (let i = 0; i < ticks; i++) {
    const a = (-210 + (i / (ticks - 1)) * 240) * (Math.PI / 180);
    const on = i / ticks <= progress;
    const r1 = r, r2 = r - (i % 6 === 0 ? 26 : 14);
    items.push(
      <div key={i} style={{
        position: 'absolute', left: x, top: y, width: 0, height: 0,
        transform: `rotate(${a}rad)`,
      }}>
        <div style={{
          position: 'absolute', left: r1 - 2, top: -1.5, width: r1 - r2, height: 3,
          background: on ? accent : color, opacity: on ? 0.95 : 0.25, borderRadius: 2,
          transformOrigin: '0 50%', transform: `rotate(${0}rad)`,
        }} />
      </div>
    );
  }
  return <div style={{ position: 'absolute', inset: 0 }}>{items}</div>;
}
