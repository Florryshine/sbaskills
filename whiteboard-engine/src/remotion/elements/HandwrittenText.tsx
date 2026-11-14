// src/remotion/elements/HandwrittenText.tsx — word-by-word handwriting reveal.
//
// Each word sits in a fixed-size box; a width-animated clip window reveals it
// left-to-right while <Pen /> tracks the frontier. Per-word write timing comes
// from the timeline (narration-synced when the text quotes the narration).

import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import type { LaidOutText, ResolvedTheme } from '../../types';
import { FONT_FAMILY } from '../../themes';

interface HandwrittenTextProps {
  text: LaidOutText;
  theme: ResolvedTheme;
  /** Optional element-level start offset (seconds, scene-local). */
  startSec?: number;
}

/** Render chemistry-style runs: digits after letters become subscripts, +/- become superscripts. */
export function ChemText({ text, fontSize, color, fontFamily }: { text: string; fontSize: number; color: string; fontFamily: string }) {
  const runs: Array<{ t: string; mode: 'normal' | 'sub' | 'sup' }> = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    const prevRun = runs[runs.length - 1];
    const prevEndsWithLetter = !!prevRun && /[A-Za-z]$/.test(prevRun.t);
    if (/[0-9]/.test(ch)) {
      let j = i;
      while (j < text.length && /[0-9]/.test(text[j])) j++;
      // leading coefficient (term start or after an operator/space) stays full-size
      runs.push({ t: text.slice(i, j), mode: prevEndsWithLetter ? 'sub' : 'normal' });
      i = j;
    } else if (/[+\u2212-]/.test(ch) && prevEndsWithLetter) {
      let j = i;
      while (j < text.length && /[+\u2212-]/.test(text[j])) j++;
      runs.push({ t: text.slice(i, j), mode: 'sup' });
      i = j;
    } else {
      let j = i + 1;
      while (j < text.length && !/[0-9]/.test(text[j]) && !/[+\u2212-]/.test(text[j])) j++;
      runs.push({ t: text.slice(i, j), mode: 'normal' });
      i = j;
    }
  }
  return (
    <span style={{ color, fontFamily, fontSize, whiteSpace: 'pre' }}>
      {runs.map((r, idx) => {
        if (r.mode === 'normal') return <span key={idx}>{r.t}</span>;
        return (
          <span
            key={idx}
            style={{
              fontSize: fontSize * 0.6,
              display: 'inline-block',
              transform: r.mode === 'sub' ? 'translateY(0.22em)' : 'translateY(-0.34em)',
            }}
          >
            {r.t.replace('\u2212', '\u2212')}
          </span>
        );
      })}
    </span>
  );
}

export const HandwrittenText: React.FC<HandwrittenTextProps> = ({ text, theme }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sceneSec = frame / fps;
  const fontFamily = FONT_FAMILY[text.font];
  const color = text.color.startsWith('#') ? text.color : theme[text.color as keyof ResolvedTheme] ?? theme.ink;
  const lineHeight = text.fontSize * 1.18;

  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' }}>
      {text.wordRects.map((r, i) => {
        const p = interpolate(sceneSec, [r.writeStart, r.writeStart + r.writeDuration], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });
        if (p <= 0) return null;
        const revealWidth = r.w * p + (p >= 1 ? 10 : 4);
        const wordColor = r.emphasis ? theme.accent : color;
        const isChem = /[0-9][A-Za-z]|[A-Za-z][0-9]/.test(r.text) && /[A-Z]/.test(r.text);
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: r.x,
              top: r.y - text.fontSize * 0.06,
              width: revealWidth,
              height: lineHeight,
              overflow: 'hidden',
            }}
          >
            <span
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                fontFamily,
                fontSize: text.fontSize,
                lineHeight: `${lineHeight}px`,
                color: wordColor,
                whiteSpace: 'pre',
                width: r.w + 12,
                display: 'inline-block',
              }}
            >
              {isChem ? <ChemText text={r.text} fontSize={text.fontSize} color={wordColor} fontFamily={fontFamily} /> : r.text}
            </span>
          </div>
        );
      })}
    </div>
  );
};
