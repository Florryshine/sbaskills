// Simulated camera movement for the Motion Graphics Engine.
// Each scene gets one camera move; moves are subtle and motivated by the
// scene's content rather than decorative.

import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { ease, drift } from './easing.js';

const MOVES = {
  pushIn: (p) => ({ scale: 1 + 0.085 * ease('sineInOut', p), x: 0, y: 0, rotate: 0 }),
  drift: (p, frame) => ({
    scale: 1.02,
    x: drift(frame * 0.016, 1.3, 0.7) * 26,
    y: drift(frame * 0.013, 0.9, 1.7) * 20,
    rotate: drift(frame * 0.01, 0.6, 1.1) * 0.35,
  }),
  panRight: (p) => ({ scale: 1.06, x: -60 * ease('sineInOut', p), y: 0, rotate: 0 }),
  panUp: (p) => ({ scale: 1.06, x: 0, y: 54 * ease('sineInOut', p), rotate: 0 }),
  zoomPunch: (p, frame, fps, durationFrames) => {
    // settle -> impact punch at 12% -> slow push
    const punch = Math.max(0, 1 - (frame - durationFrames * 0.12) / (fps * 0.35));
    const shake = punch > 0 ? Math.sin(frame * 2.4) * punch * 4 : 0;
    return {
      scale: 1 + 0.05 * ease('sineInOut', p) + punch * 0.07,
      x: shake,
      y: shake * 0.6,
      rotate: 0,
    };
  },
  shakeLight: (p, frame, fps, durationFrames) => {
    const decay = Math.exp(-Math.max(0, frame - durationFrames * 0.12) / (fps * 0.6));
    const impact = frame < durationFrames * 0.12 ? 1 : decay;
    return {
      scale: 1.03,
      x: Math.sin(frame * 3.1) * 5 * impact,
      y: Math.cos(frame * 2.6) * 4 * impact,
      rotate: Math.sin(frame * 1.8) * 0.3 * impact,
    };
  },
};

export function CameraMove({ camera = 'pushIn', children }) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const p = Math.min(1, frame / Math.max(1, durationInFrames));
  const move = (MOVES[camera] || MOVES.pushIn)(p, frame, fps, durationInFrames);
  return (
    <div style={{
      position: 'absolute', inset: 0,
      transform: `scale(${move.scale}) translate(${move.x}px, ${move.y}px) rotate(${move.rotate}deg)`,
      transformOrigin: 'center center',
    }}>
      {children}
    </div>
  );
}
