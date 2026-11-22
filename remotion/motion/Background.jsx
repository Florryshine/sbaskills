// Animated backgrounds for the Motion Graphics Engine.
// Layered per direction: base gradient, pattern layer, glow accents,
// grain + vignette + scanlines. All deterministic.

import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { drift } from './easing.js';
import { ShapePerspectiveGrid, ShapeFlatGrid, ShapeOrbits, ShapeStripes } from './elements/Shapes.jsx';

const PATTERNS_BY_SHAPE = {
  grid: 'grid-flat',
  nodes: 'grid-flat',
  brackets: 'grid-flat',
  lines: 'diagonal-lines',
  arrows: 'diagonal-lines',
  ticks: 'diagonal-lines',
  bars: 'bars-faint',
  counters: 'bars-faint',
  ticker: 'grid-flat',
  orbits: 'orbits',
  rings: 'orbits',
  circles: 'orbits',
  'circles-sketch': 'orbits',
  'cells': 'blobs',
  blobs: 'blobs',
  leaves: 'blobs',
  stripes: 'stripes',
  slashes: 'stripes',
  triangles: 'stripes',
  tiles: 'grid-flat',
  steps: 'grid-flat',
  track: 'diagonal-lines',
  dots: 'dots',
  bullets: 'dots',
  frames: 'dots',
  tape: 'stripes',
  beam: 'blobs',
  rays: 'rays',
  particles: 'blobs',
  waveform: 'bars-faint',
  split: 'diagonal-lines',
  confetti: 'dots',
  'confetti-shapes': 'dots',
  'arrows-sketch': 'diagonal-lines',
};

function patternLayer(kind, theme, frame) {
  const { palette, light } = theme;
  switch (kind) {
    case 'grid-flat':
      return <ShapeFlatGrid color={palette.accent} opacity={0.07} cell={120} phase={frame * 0.25} />;
    case 'diagonal-lines':
      return (
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.05,
          backgroundImage: `repeating-linear-gradient(-24deg, ${palette.ink} 0 2px, transparent 2px 90px)`,
        }} />
      );
    case 'bars-faint':
      return (
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.06,
          backgroundImage: `repeating-linear-gradient(90deg, ${palette.ink} 0 3px, transparent 3px 74px)`,
        }} />
      );
    case 'orbits':
      return <ShapeOrbits color={palette.inkSoft} accent={palette.accent} opacity={0.3} count={5} seed={frame * 0.001} />;
    case 'stripes':
      return <div style={{ position: 'absolute', left: 0, right: 0, top: '18%' }}><ShapeStripes color={palette.accent} bg="transparent" opacity={0.08} bandHeight={200} stripeHeight={30} /></div>;
    case 'dots':
      return (
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.09,
          backgroundImage: `radial-gradient(${palette.ink} 2.4px, transparent 2.4px)`,
          backgroundSize: '64px 64px',
        }} />
      );
    case 'rays':
      return (
        <div style={{
          position: 'absolute', inset: '-40%', opacity: 0.07,
          backgroundImage: `repeating-conic-gradient(from 0deg at 50% 30%, ${palette.accent} 0deg 7deg, transparent 7deg 22deg)`,
          transform: `rotate(${frame * 0.08}deg)`,
        }} />
      );
    case 'blobs':
    default:
      return (
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{
              position: 'absolute',
              left: `${[8, 55, 30][i]}%`, top: `${[12, 40, 68][i]}%`,
              width: 620, height: 620, borderRadius: '50%',
              background: `radial-gradient(circle, ${i % 2 ? palette.accent : palette.accent2}22 0%, transparent 66%)`,
              transform: `translate(${drift(frame * 0.01, 0.6 + i, 1.1 + i) * 70}px, ${drift(frame * 0.009, 1.3 + i * 0.4, 0.8) * 60}px)`,
              filter: 'blur(4px)',
            }} />
          ))}
        </div>
      );
  }
}

export function MotionBackground({ direction, theme }) {
  const frame = useCurrentFrame();
  const { height, width } = useVideoConfig();
  const { palette, light } = theme;
  const p = direction.palette;
  const shapeKind = (direction.shapes && direction.shapes[0]) || 'blobs';
  const patternKind = PATTERNS_BY_SHAPE[shapeKind] || 'blobs';

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: p.bg }}>
      {/* base gradient */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `linear-gradient(${158 + drift(frame * 0.004, 0.5, 0.9) * 10}deg, ${p.bg} 0%, ${p.bgAlt || p.bg} 100%)`,
      }} />
      {/* pattern */}
      <div style={{ position: 'absolute', inset: 0 }}>{patternLayer(patternKind, theme, frame)}</div>
      {/* glow accent orb */}
      <div style={{
        position: 'absolute',
        left: `${28 + drift(frame * 0.008, 0.9, 1.4) * 10}%`,
        top: `${14 + drift(frame * 0.007, 1.2, 0.7) * 8}%`,
        width: 520, height: 520, borderRadius: '50%',
        background: `radial-gradient(circle, ${p.glow}30 0%, transparent 62%)`,
        filter: 'blur(2px)',
      }} />
      {/* vignette */}
      {light.vignette ? (
        <div style={{
          position: 'absolute', inset: 0,
          background: `radial-gradient(ellipse at center, transparent 42%, rgba(0,0,0,${light.vignette * (p.dark ? 0.85 : 0.4)}) 100%)`,
        }} />
      ) : null}
      {/* scanlines */}
      {light.scanlines ? (
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.05,
          backgroundImage: `repeating-linear-gradient(0deg, ${p.ink} 0 1px, transparent 1px 4px)`,
        }} />
      ) : null}
    </div>
  );
}

/** Film grain overlay (SVG turbulence, animated seed per second bucket). */
export function GrainOverlay({ opacity = 0.1 }) {
  const frame = useCurrentFrame();
  const seed = 1 + Math.floor(frame / 2);
  if (opacity <= 0) return null;
  return (
    <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity, mixBlendMode: 'overlay', pointerEvents: 'none' }}>
      <filter id="motion-grain">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={seed % 10} stitchTiles="stitch" />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width="100%" height="100%" filter="url(#motion-grain)" />
    </svg>
  );
}
