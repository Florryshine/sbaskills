// src/remotion/elements/Pen.tsx — the marker hand that follows the drawing tip.
//
// The tip position is computed from the same build-time geometry the renderers
// animate, so the nib sits exactly on the drawing frontier. It now follows:
//   • illustration / arrow / highlight strokes
//   • the colour-wash marker sweep of traced images
//   • handwritten text (headings, body, bullets, callouts, ticks)
//   • equation terms
//
// The hand is a flat cartoon sprite (skin, sleeve, cuff, accent-coloured
// marker) anchored at the pen tip and tilted ~42° so it never hides what is
// being written.

import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import type { ElementTimeline, LaidOutText } from '../../types';
import { pointOnStroke } from '../../geometry/path-sample';

interface PenProps {
  elements: ElementTimeline[];
  accent: string;
  /** Scene-level texts (heading / sub) so the hand follows them too. */
  texts?: Array<LaidOutText | undefined>;
  /** Ink colour used for sprite outlines. */
  ink?: string;
}

type Tip = { x: number; y: number };

function textTip(t: LaidOutText, sceneSec: number): Tip | null {
  for (const r of t.wordRects) {
    const d = r.writeDuration || 0.3;
    if (sceneSec >= r.writeStart - 0.02 && sceneSec <= r.writeStart + d) {
      const p = Math.max(0, Math.min(1, (sceneSec - r.writeStart) / d));
      // nib rides the baseline, slightly above it so the ink looks "just written"
      return { x: r.x + r.w * p, y: r.y + t.fontSize * 0.82 };
    }
  }
  return null;
}

/** Board-coordinate tip of whatever is being drawn / written at sceneSec, or null. */
export function activeTipAt(
  elements: ElementTimeline[],
  sceneSec: number,
  texts: Array<LaidOutText | undefined> = [],
): Tip | null {
  let latest: Tip | null = null;

  for (const t of texts) {
    if (!t) continue;
    const tip = textTip(t, sceneSec);
    if (tip) latest = tip;
  }

  for (const el of elements) {
    if (el.text) {
      const tip = textTip(el.text, sceneSec);
      if (tip) latest = tip;
    }

    if (el.equation) {
      for (const term of el.equation.terms) {
        if (term.kind === 'arrow') continue;
        const du = term.duration || 0.4;
        if (sceneSec >= term.start && sceneSec <= term.start + du) {
          const p = (sceneSec - term.start) / du;
          latest = { x: term.x + term.w * p, y: el.equation.y + el.equation.fontSize * 0.8 };
        }
      }
    }

    const ill = el.illustration;
    if (!ill) continue;
    for (const s of ill.sampled.strokes) {
      const st = s.start ?? 0;
      const du = s.duration ?? 0.3;
      const t = sceneSec - el.start - st;
      if (t >= -0.02 && t <= du) {
        const p = Math.max(0, Math.min(1, t / du));
        const pt = pointOnStroke(s, p * s.length);
        latest = { x: ill.x + pt.x * ill.scale, y: ill.y + pt.y * ill.scale };
      }
    }
    // marker sweep that paints a traced image's colour in
    const cl = ill.sampled.colorLayer;
    if (cl) {
      const t = sceneSec - el.start - cl.start;
      if (t >= 0 && t <= cl.duration) {
        const p = Math.max(0, Math.min(1, t / cl.duration));
        const pt = pointOnStroke(
          { points: cl.zigzag.points, length: cl.zigzag.length } as never,
          p * cl.zigzag.length,
        );
        latest = { x: ill.x + pt.x * ill.scale, y: ill.y + pt.y * ill.scale };
      }
    }
  }
  return latest;
}

const PEN_ANGLE = 42;
const HAND_SCALE = 0.62;

/**
 * Transparent hand-and-marker artwork. Its marker nib is aligned to local
 * origin (0, 0), preserving the existing active-tip tracking coordinates.
 */
export const HandSprite: React.FC<{ accent: string; ink: string; angle?: number }> = ({ angle = PEN_ANGLE }) => (
  <g transform={`rotate(${angle})`}>
    <image
      href="/whiteboard/marker-hand.svg"
      x={10}
      y={-139}
      width={480}
      height={279}
      preserveAspectRatio="none"
    />
  </g>
);

export const Pen: React.FC<PenProps> = ({ elements, accent, texts = [], ink = '#26343C' }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sceneSec = frame / fps;

  const tip = activeTipAt(elements, sceneSec, texts);

  // Keep the last known position briefly after drawing ends so the hand eases
  // off instead of vanishing on the first idle frame.
  let visibleTip = tip;
  let lastTipAge = 0;
  if (!visibleTip) {
    for (let back = 1; back <= 15; back++) {
      const previous = activeTipAt(elements, sceneSec - back / fps, texts);
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

  // tiny deterministic hand tremor while moving
  const wobble = tip ? Math.sin(sceneSec * 11) * 1.4 : 0;
  const drop = (1 - fadeOut) * 26; // slide down-right while leaving

  return (
    <svg
      style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible' }}
      viewBox="0 0 1920 1080"
    >
      <defs>
        <filter id="handShadow" x="-20%" y="-20%" width="150%" height="150%">
          <feDropShadow dx="4" dy="7" stdDeviation="6" floodColor="#1a1a1a" floodOpacity="0.18" />
        </filter>
      </defs>
      <g
        opacity={opacity}
        filter="url(#handShadow)"
        transform={`translate(${visibleTip.x + drop} ${visibleTip.y + drop}) scale(${HAND_SCALE})`}
      >
        <HandSprite accent={accent} ink={ink} angle={PEN_ANGLE + wobble} />
      </g>
    </svg>
  );
};
