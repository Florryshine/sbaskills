// src/remotion/elements/DrawnStrokes.tsx — the universal progressive-drawing renderer.
//
// Every drawn thing in the engine (illustrations, arrows, highlights, ticks,
// equation arrows) is a SampledIllustration: strokes with per-stroke schedules.
// Rendering = strokeDashoffset animation + fill fade-in + post-draw label
// write-ins. Pen tips are computed from the same sampled points by <Pen />.

import React, { useMemo } from 'react';
import { useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import type { SampledIllustration, ResolvedTheme } from '../../types';
import { pointsToD } from '../../geometry/path-sample';
import { resolveColor, FONT_FAMILY } from '../../themes';

const BOARD_W = 1920;
const BOARD_H = 1080;

interface DrawnStrokesProps {
  sampled: SampledIllustration;
  /** Display transform: translate + scale (asset coords -> board coords). */
  x: number;
  y: number;
  scale: number;
  /** Scene-local seconds when this element starts drawing. */
  startSec: number;
  /** Theme for resolving label colors. */
  theme: ResolvedTheme;
}

export const DrawnStrokes: React.FC<DrawnStrokesProps> = ({ sampled, x, y, scale, startSec, theme }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sceneSec = frame / fps;

  const strokes = useMemo(() => sampled.strokes, [sampled]);
  const allStrokesEnd = useMemo(
    () => strokes.reduce((acc, s) => Math.max(acc, (s.start ?? 0) + (s.duration ?? 0.3)), 0),
    [strokes],
  );

  const uid = useMemo(() => sampled.id.replace(/[^a-zA-Z0-9]/g, '') + '-' + Math.round(startSec * 100), [sampled.id, startSec]);

  return (
    <svg
      style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' }}
      viewBox={`0 0 ${BOARD_W} ${BOARD_H}`}
    >
      <defs>
        {(sampled.labels ?? []).map((label, i) => {
          const size = (label.size ?? 30) / Math.max(0.0001, scale);
          const approxW = label.text.length * size * 0.52 + 10;
          const labelStart = startSec + allStrokesEnd + 0.15 + i * 0.4;
          const p = interpolate(sceneSec, [labelStart, labelStart + 0.45], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          let rx = label.x;
          if ((label.align ?? 'start') === 'middle') rx = label.x - (approxW * p) / 2;
          else if (label.align === 'end') rx = label.x - approxW * p;
          return (
            <clipPath key={i} id={`lbl-${uid}-${i}`}>
              <rect x={rx} y={label.y - size * 0.85} width={approxW * p} height={size * 1.7} />
            </clipPath>
          );
        })}
      </defs>
      <g transform={`translate(${x} ${y}) scale(${scale})`}>
        {strokes.map((s, i) => {
          const st = s.start ?? 0;
          const du = s.duration ?? 0.3;
          const p = Math.max(0, Math.min(1, (sceneSec - startSec - st) / du));
          if (p <= 0) {
            // not started: fully hidden (offset > length hides the round caps too)
            return (
              <path
                key={i}
                d={pointsToD(s.points)}
                fill="none"
                stroke={s.color}
                strokeWidth={s.width / Math.max(0.0001, scale)}
                strokeDasharray={s.length + 2}
                strokeDashoffset={s.length + 2}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0}
              />
            );
          }
          const visible = s.length * p;
          const fillP = Math.max(0, Math.min(1, (sceneSec - startSec - st - du) / 0.4));
          const fillOpacity = s.fill ? (s.fillOpacity ?? 0.14) * fillP : 0;
          return (
            <g key={i}>
              <path
                d={pointsToD(s.points)}
                fill={s.fill ?? 'none'}
                fillOpacity={fillOpacity}
                stroke="none"
              />
              <path
                d={pointsToD(s.points)}
                fill="none"
                stroke={s.color}
                strokeWidth={s.width / Math.max(0.0001, scale)}
                strokeDasharray={s.length}
                strokeDashoffset={s.length - visible}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          );
        })}

        {/* labels write themselves in after the strokes settle */}
        {(sampled.labels ?? []).map((label, i) => {
          const size = (label.size ?? 30) / Math.max(0.0001, scale);
          const labelStart = startSec + allStrokesEnd + 0.15 + i * 0.4;
          const p = interpolate(sceneSec, [labelStart, labelStart + 0.45], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          if (p <= 0) return null;
          const color = resolveColor(theme, label.color);
          const anchor = label.align ?? 'start';
          return (
            <text
              key={`lbl-${i}`}
              x={label.x}
              y={label.y}
              fontSize={size}
              fontFamily={FONT_FAMILY[label.font ?? 'label']}
              fill={color}
              textAnchor={anchor}
              dominantBaseline="central"
              clipPath={`url(#lbl-${uid}-${i})`}
            >
              {label.text}
            </text>
          );
        })}
      </g>
    </svg>
  );
};
