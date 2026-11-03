import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { CharacterRig } from './CharacterRig';

/**
 * Timeline-driven character controller.
 * Cues are frame-based and deterministic, so previews and renders match.
 *
 * cue shape:
 * { from, duration, action, expression, pose, speaking, x, y, scale }
 */
export function AnimatedCharacter({
  character,
  cues = [],
  defaultExpression = 'neutral',
  defaultPose = 'standing',
  style = {},
  width = '100%',
  height = '100%'
}) {
  const frame = useCurrentFrame();
  const active = cues.filter(c => frame >= c.from && frame < c.from + c.duration);
  const cue = active[active.length - 1] || {};
  const prior = cues.filter(c => c.from <= frame).slice(-1)[0] || {};
  const next = cues.find(c => c.from > frame);
  const fromX = prior.x ?? 0;
  const x = next && next.x !== undefined
    ? interpolate(frame, [prior.from, next.from], [fromX, next.x], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
    : fromX;
  const fadeIn = cue.duration ? interpolate(frame, [cue.from, cue.from + Math.min(8, cue.duration / 3)], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) : 1;
  return (
    <div style={{ width, height, opacity: fadeIn, transform: `translateX(${x}px) translateY(${cue.y || 0}px) scale(${cue.scale || 1})`, transformOrigin: 'bottom center', ...style }}>
      <CharacterRig
        character={character}
        expression={cue.expression || defaultExpression}
        pose={cue.pose || defaultPose}
        action={cue.action || 'idle'}
        speaking={cue.speaking ?? false}
      />
    </div>
  );
}

export const CHARACTER_ACTIONS = ['idle', 'walk', 'run', 'talk', 'wave', 'point'];
export const CHARACTER_CUE_EXAMPLE = [
  { from: 0, duration: 45, action: 'walk', pose: 'walking', x: -80, expression: 'happy' },
  { from: 45, duration: 60, action: 'talk', speaking: true, expression: 'happy' },
  { from: 105, duration: 30, action: 'wave', pose: 'waving', expression: 'happy' }
];
