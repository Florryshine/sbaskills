// src/remotion/SceneRenderer.tsx — renders one scene: heading, sub, elements, pen.

import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, AbsoluteFill } from 'remotion';
import type { SceneTimeline, Timeline } from '../types';
import { HandwrittenText, ChemText } from './elements/HandwrittenText';
import { DrawnStrokes } from './elements/DrawnStrokes';
import { Pen } from './elements/Pen';
import { FONT_FAMILY } from '../themes';

export const SceneRenderer: React.FC<{ scene: SceneTimeline; timeline: Timeline }> = ({ scene, timeline }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const theme = timeline.theme;

  return (
    <AbsoluteFill>
      {scene.heading && <HandwrittenText text={scene.heading} theme={theme} />}
      {scene.sub && <HandwrittenText text={scene.sub} theme={theme} />}

      {scene.elements.map((el) => {
        const key = el.spec.id;

        // Illustrations / arrows / highlights render via DrawnStrokes.
        // Ticks also carry text and are handled further below.
        if (el.illustration && el.spec.type !== 'tick') {
          const isArrow = el.spec.type === 'arrow' && el.spec.label;
          const labelOpacity = isArrow
            ? interpolate(frame / fps, [el.start + el.drawDuration, el.start + el.drawDuration + 0.35], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              })
            : 0;
          return (
            <React.Fragment key={key}>
              <DrawnStrokes
                sampled={el.illustration.sampled}
                x={el.illustration.x}
                y={el.illustration.y}
                scale={el.illustration.scale}
                startSec={el.start}
                theme={theme}
              />
              {isArrow && labelOpacity > 0 && el.bbox && (
                <div
                  style={{
                    position: 'absolute',
                    left: el.bbox.x + el.bbox.w / 2 - 160,
                    top: el.bbox.y - 34,
                    width: 320,
                    textAlign: 'center',
                    fontFamily: FONT_FAMILY.label,
                    fontSize: 30,
                    color: theme.accent2,
                    opacity: labelOpacity,
                  }}
                >
                  {el.spec.label}
                </div>
              )}
            </React.Fragment>
          );
        }

        // Body text / bullets
        if ((el.spec.type === 'text' || el.spec.type === 'bullet') && el.text) {
          return (
            <React.Fragment key={key}>
              {el.spec.type === 'bullet' && <BulletMarker el={el} theme={theme} fps={fps} />}
              <HandwrittenText text={el.text} theme={theme} />
            </React.Fragment>
          );
        }

        // Ticks: check mark + text (summary layout)
        if (el.spec.type === 'tick' && el.illustration && el.text) {
          return (
            <React.Fragment key={key}>
              <DrawnStrokes
                sampled={el.illustration.sampled}
                x={el.illustration.x}
                y={el.illustration.y}
                scale={el.illustration.scale}
                startSec={el.start}
                theme={theme}
              />
              <HandwrittenText text={el.text} theme={theme} />
            </React.Fragment>
          );
        }

        // Callouts
        if (el.spec.type === 'callout' && el.text) {
          return <HandwrittenText key={key} text={el.text} theme={theme} />;
        }

        // Equations
        if (el.spec.type === 'equation' && el.equation) {
          const eq = el.equation;
          return (
            <React.Fragment key={key}>
              {eq.terms.map((term, i) => {
                if (term.kind === 'arrow') {
                  const labelOpacity = interpolate(frame / fps, [term.start + term.duration, term.start + term.duration + 0.3], [0, 1], {
                    extrapolateLeft: 'clamp',
                    extrapolateRight: 'clamp',
                  });
                  return (
                    <React.Fragment key={`arrow-${i}`}>
                      {term.strokes && (
                        <DrawnStrokes sampled={term.strokes} x={0} y={0} scale={1} startSec={term.start} theme={theme} />
                      )}
                      {term.label && labelOpacity > 0 && (
                        <div
                          style={{
                            position: 'absolute',
                            left: term.x,
                            top: eq.y - eq.fontSize * 0.95,
                            width: term.w,
                            textAlign: 'center',
                            fontFamily: FONT_FAMILY.label,
                            fontSize: eq.fontSize * 0.42,
                            color: theme.accent,
                            opacity: labelOpacity,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {term.label}
                        </div>
                      )}
                    </React.Fragment>
                  );
                }
                const p = interpolate(
                  frame / fps,
                  [term.start, term.start + term.duration],
                  [0, 1],
                  { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
                );
                if (p <= 0) return null;
                const width = term.w * p + 6;
                return (
                  <div
                    key={`term-${i}`}
                    style={{
                      position: 'absolute',
                      left: term.x,
                      top: eq.y - eq.fontSize * 0.2,
                      width,
                      height: eq.fontSize * 1.4,
                      overflow: 'hidden',
                    }}
                  >
                    <span
                      style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        fontFamily: FONT_FAMILY.body,
                        fontSize: eq.fontSize,
                        lineHeight: `${eq.fontSize * 1.3}px`,
                        color: theme.ink,
                        whiteSpace: 'pre',
                        width: term.w + 14,
                        display: 'inline-block',
                      }}
                    >
                      <ChemText text={term.text ?? ''} fontSize={eq.fontSize} color={theme.ink} fontFamily={FONT_FAMILY.body} />
                    </span>
                  </div>
                );
              })}
            </React.Fragment>
          );
        }

        return null;
      })}

      <Pen elements={scene.elements} accent={theme.accent} />
    </AbsoluteFill>
  );
};

/** Small hand-drawn dash marker in front of bullets. */
const BulletMarker: React.FC<{ el: SceneTimeline['elements'][number]; theme: Timeline['theme']; fps: number }> = ({ el, theme, fps }) => {
  const frame = useCurrentFrame();
  const sec = frame / fps;
  const p = interpolate(sec, [el.start, el.start + 0.25], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  if (p <= 0 || !el.text) return null;
  const y = el.text.y + el.text.fontSize * 0.62;
  const x = el.text.x - 34;
  return (
    <svg
      style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' }}
      viewBox={`0 0 1920 1080`}
    >
      <path
        d={`M ${x} ${y} Q ${x + 12} ${y - 2} ${x + 24 * p} ${y - 1}`}
        stroke={theme.accent}
        strokeWidth={5}
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
};
