// src/remotion/elements/Pen.tsx — the marker hand that follows drawing tips.
//
// Position is computed from the same sampled geometry the DrawnStrokes
// component animates, so the nib sits exactly on the drawing frontier.

import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import type { ElementTimeline } from '../../types';
import { pointOnStroke } from '../../geometry/path-sample';

interface PenProps {
  elements: ElementTimeline[];
  accent: string;
}

/** Board-coordinate tip of whatever is being drawn at sceneSec, or null. */
export function activeTipAt(elements: ElementTimeline[], sceneSec: number): { x: number; y: number } | null {
  let latest: { x: number; y: number } | null = null;
  for (const el of elements) {
    const ill = el.illustration;
    if (!ill) continue;
    for (const s of ill.sampled.strokes) {
      const st = s.start ?? 0;
      const du = s.duration ?? 0.3;
      const t = sceneSec - el.start - st;
      if (t >= -0.02 && t <= du) {
        const p = Math.max(0, Math.min(1, t / du));
        const pt = pointOnStroke(s, p * s.length);
        latest = {
          x: ill.x + pt.x * ill.scale,
          y: ill.y + pt.y * ill.scale,
        };
      }
    }
  }
  return latest;
}

export const Pen: React.FC<PenProps> = ({ elements, accent }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sceneSec = frame / fps;

  const tip = activeTipAt(elements, sceneSec);

  // Keep the last known position briefly after a stroke ends so the marker
  // fades out naturally instead of disappearing on the first idle frame.
  let visibleTip = tip;
  let lastTipAge = 0;
  if (!visibleTip) {
    for (let back = 1; back <= 15; back++) {
      const previous = activeTipAt(elements, sceneSec - back / fps);
      if (previous) {
        visibleTip = previous;
        lastTipAge = back / fps;
        break;
      }
    }
  }

  if (!visibleTip) return null;
  const fadeOut = interpolate(lastTipAge, [0, 0.5], [1, 0], { extrapolateRight: 'clamp' });
  const opacity = Math.max(0, fadeOut);
  if (opacity <= 0.02) return null;

  return (
    <div
      style={{
        position: 'absolute',
        left: visibleTip.x,
        top: visibleTip.y,
        opacity,
        transform: 'translate(-112px, -316px) rotate(2deg)',
        pointerEvents: 'none',
      }}
    >
      <svg width={200} height={330} viewBox="0 0 220 340">
        <defs>
          <filter id="penShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="3" dy="6" stdDeviation="6" floodColor="#1a1a1a" floodOpacity="0.16" />
          </filter>
        </defs>
        <g filter="url(#penShadow)">
          {/* marker body */}
          <path d="M 97 132 L 123 132 L 125 268 L 95 268 Z" fill="#3D4B54" />
          <path d="M 99 132 L 121 132 L 122 148 L 98 148 Z" fill="#5A6B76" />
          {/* grip band */}
          <rect x={95} y={196} width={30} height={22} fill={accent} />
          {/* taper + nib */}
          <path d="M 95 268 L 125 268 L 112 306 Z" fill="#2C3740" />
          <path d="M 106 300 L 112 316 L 115 300 Z" fill="#1F272E" />
          {/* hand: outline style, white fill covers strokes under it */}
          <path
            d="M 60 214
               C 56 186 66 168 84 160
               C 96 154 118 152 132 158
               C 152 166 166 182 168 204
               C 170 226 162 246 146 258
               C 130 270 104 272 88 262
               C 72 252 63 236 60 214 Z"
            fill="#FFFFFF"
            stroke="#3D4B54"
            strokeWidth={5}
            strokeLinejoin="round"
          />
          {/* fingers wrapping the barrel */}
          <path d="M 88 168 C 100 162 118 162 128 168" fill="none" stroke="#3D4B54" strokeWidth={4.5} strokeLinecap="round" />
          <path d="M 84 190 C 100 184 122 184 134 190" fill="none" stroke="#3D4B54" strokeWidth={4.5} strokeLinecap="round" />
          <path d="M 86 212 C 102 206 124 206 136 212" fill="none" stroke="#3D4B54" strokeWidth={4.5} strokeLinecap="round" />
          <path d="M 90 234 C 104 229 122 229 132 234" fill="none" stroke="#3D4B54" strokeWidth={4.5} strokeLinecap="round" />
          {/* thumb wrapping from the right, attached to the fist */}
          <path
            d="M 128 166
               C 146 160 160 164 163 174
               C 166 184 156 190 144 188
               C 136 187 131 178 128 166 Z"
            fill="#FFFFFF"
            stroke="#3D4B54"
            strokeWidth={5}
            strokeLinejoin="round"
          />
        </g>
      </svg>
    </div>
  );
};
