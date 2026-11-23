// Scene transition system for the Motion Graphics Engine.
// Scenes overlap for `duration` around each boundary; the entering scene
// plays its enter style while the leaving scene plays its exit style, and an
// optional overlay (flash / noise bars) caps the cut.

import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { ease } from './easing.js';

const T = {
  push: { overlap: 0.42 },
  wipe: { overlap: 0.38 },
  flashCut: { overlap: 0.18 },
  scaleCut: { overlap: 0.26 },
  glitchSlide: { overlap: 0.3 },
  iris: { overlap: 0.4 },
  shatter: { overlap: 0.34 },
  split: { overlap: 0.4 },
};

export function transitionOverlap(type, cutSpeed = 1) {
  const base = (T[type] || T.push).overlap;
  return Math.max(0.12, base * cutSpeed);
}

function dirVector(direction) {
  switch (direction) {
    case 'left': return [-1, 0];
    case 'right': return [1, 0];
    case 'up': return [0, -1];
    default: return [0, 1];
  }
}

/**
 * Enter style for the incoming scene.
 * @param {string} type transition type
 * @param {number} p    0..1 progress through the transition
 * @param {string} direction left|right|up|down
 */
export function enterStyle(type, p, direction, accent) {
  const e = ease('expoOut', p);
  const [dx, dy] = dirVector(direction);
  switch (type) {
    case 'push':
      return { transform: `translate(${(1 - e) * dx * 1080}px, ${(1 - e) * dy * 1080}px)`, opacity: 1 };
    case 'wipe':
      return { clipPath: `inset(${dy !== 0 ? `${dy > 0 ? (1 - e) * 100 : 0}% 0 ${dy > 0 ? 0 : (1 - e) * 100}%` : '0 0 0 0'})`, transform: dy === 0 ? `translateX(${(1 - e) * dx * 60}px)` : 'none', opacity: 1 };
    case 'flashCut':
      return { opacity: p > 0.45 ? 1 : 0 };
    case 'scaleCut':
      return { transform: `scale(${1.14 - 0.14 * e})`, opacity: Math.min(1, p * 2.4) };
    case 'glitchSlide':
      return {
        transform: `translateX(${(1 - e) * dx * 160}px)`,
        clipPath: `inset(${(1 - p) * 18}% 0 ${(1 - p) * 18}% 0)`,
        opacity: Math.min(1, p * 2.2),
        filter: p < 0.5 ? 'saturate(1.6) contrast(1.15)' : 'none',
      };
    case 'iris':
      return { clipPath: `circle(${e * 148}%) at 50% 50%`, opacity: 1 };
    case 'shatter': {
      // mosaic reveal via stepped clip
      const step = Math.floor(e * 5) / 5;
      return { clipPath: `inset(0 0 ${(1 - step) * 100}% 0)`, opacity: 1, transform: `translateY(${(1 - e) * 40}px)` };
    }
    case 'split':
      return {
        clipPath: dy === 0 && dx !== 0
          ? `polygon(0 0, ${50 + e * 50}% 0, ${50 + e * 50}% 100%, 0 100%)`
          : `polygon(0 0, 100% 0, 100% ${50 + e * 50}%, 0 ${50 + e * 50}%)`,
        opacity: 1,
        transform: `translateX(${(1 - e) * dx * 90}px)`,
      };
    default:
      return { opacity: e };
  }
}

/** Exit style for the outgoing scene during the same overlap window. */
export function exitStyle(type, p, direction) {
  const e = ease('expoIn', p);
  const [dx, dy] = dirVector(direction);
  // invert the enter direction for push
  const exdx = type === 'push' ? -dx : dx;
  const exdy = type === 'push' ? -dy : dy;
  switch (type) {
    case 'push':
      return { transform: `translate(${e * exdx * 1080}px, ${e * exdy * 1080}px)`, opacity: 1 };
    case 'wipe':
      return { opacity: 1 };
    case 'flashCut':
      return { opacity: p < 0.45 ? 1 : 0 };
    case 'scaleCut':
      return { transform: `scale(${1 - e * 0.08})`, opacity: 1 - Math.max(0, (p - 0.3) * 2.6) };
    case 'glitchSlide':
      return { transform: `translateX(${e * exdx * 90}px)`, opacity: 1 - Math.max(0, (p - 0.55) * 2.4) };
    case 'iris':
      return { opacity: 1 };
    case 'shatter':
      return { opacity: 1 - Math.max(0, (p - 0.5) * 2.2) };
    case 'split':
      return { opacity: 1 };
    default:
      return { opacity: 1 - e };
  }
}

/** Overlay effects drawn above both scenes during the transition window. */
export function TransitionOverlay({ type, p, accent, direction }) {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  if (p <= 0 || p >= 1) return null;

  if (type === 'flashCut' || type === 'glitchSlide') {
    const intensity = type === 'flashCut'
      ? Math.max(0, 1 - Math.abs(p - 0.42) * 3.4)
      : Math.max(0, 1 - Math.abs(p - 0.25) * 4.2);
    return (
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: type === 'flashCut' ? '#ffffff' : accent,
          opacity: intensity * (type === 'flashCut' ? 0.85 : 0.28),
          mixBlendMode: 'screen',
        }} />
        {type === 'glitchSlide' && p > 0.1 && p < 0.75 ? (
          <div>
            {[0.18, 0.42, 0.61, 0.83].map((pos, i) => {
              const on = Math.sin(p * 60 + i * 7) > 0.2;
              if (!on) return null;
              return (
                <div key={i} style={{
                  position: 'absolute', left: 0, width,
                  top: height * pos, height: 14 + (i % 2) * 22,
                  background: i % 2 ? accent : '#ffffff',
                  opacity: 0.35, transform: `translateX(${Math.sin(p * 40 + i) * 40}px)`,
                }} />
              );
            })}
          </div>
        ) : null}
      </div>
    );
  }

  if (type === 'wipe' || type === 'split') {
    // accent edge bar that sweeps with the clip
    const [dx, dy] = dirVector(direction);
    const vertical = dy !== 0;
    const edge = 14;
    return (
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: vertical
          ? `linear-gradient(to ${dy > 0 ? 'bottom' : 'top'}, ${accent} ${(1 - p) * 100}%, transparent ${(1 - p) * 100}%)`
          : `linear-gradient(to ${dx > 0 ? 'right' : 'left'}, ${accent} ${(1 - p) * 100}%, transparent ${(1 - p) * 100}%)`,
        opacity: 0.9, mixBlendMode: 'normal',
      }} />
    );
  }

  if (type === 'iris') {
    // Expanding accent ring that fades — the actual reveal is the clipPath
    // on the entering scene; this is just the light accent sweep.
    const r = ease('expoOut', p) * 148;
    return (
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          width: `${r * 2}%`, paddingBottom: `${r * 2 * 1.777}%`, maxWidth: '200%',
          position: 'relative', opacity: Math.max(0, 0.9 - p * 1.4),
        }}>
          <div style={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            border: `10px solid ${accent}`,
            boxShadow: `0 0 60px ${accent}88, inset 0 0 60px ${accent}44`,
          }} />
        </div>
      </div>
    );
  }
  return null;
}
