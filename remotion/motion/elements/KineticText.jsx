// Kinetic typography for the Motion Graphics Engine.
// Multiple reveal personalities; per-word timing support so emphasis words
// land exactly when the narrator says them.

import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { ease, staggerDelay } from '../easing.js';

function splitWords(text) {
  return String(text || '').split(/\s+/).filter(Boolean);
}

/**
 * KineticTitle — display text with a reveal mode.
 * modes: charStagger | wordPop | maskWipe | blurIn | scaleIn | slideClip
 */
export function KineticTitle({
  text, mode = 'charStagger', fontFamily, fontSize = 96, color, accent, accentWords = [],
  caseTransform = 'none', tracking = 0, weight = 700, lineHeight = 1.06, align = 'center',
  delay = 6, stagger = 0.8, staggerUnit = 'frames', shadow, durationInFrames,
}) {
  const frame = useCurrentFrame();
  const words = splitWords(text);
  let charCursor = 0;
  const accentSet = new Set((accentWords || []).map((w) => w.toLowerCase().replace(/[^\w]/g, '')));

  return (
    <div style={{
      fontFamily, fontSize, color, fontWeight: weight, lineHeight,
      textAlign: align, textTransform: caseTransform, letterSpacing: `${tracking}em`,
      textShadow: shadow, width: '100%', whiteSpace: 'pre-wrap',
    }}>
      {words.map((word, wi) => {
        const isAccent = accentSet.has(word.toLowerCase().replace(/[^\w]/g, ''));
        const wordColor = isAccent && accent ? accent : color;
        const chars = [...word];
        const wordDelayBase = staggerUnit === 'frames' ? delay + wi * stagger : delay + wi * stagger;
        const wordProgress = ease('expoOut', (frame - wordDelayBase) / 14);

        const wordStyle = { display: 'inline-block', color: wordColor, position: 'relative', whiteSpace: 'pre' };
        let inner = null;

        if (mode === 'wordPop') {
          Object.assign(wordStyle, {
            transform: `scale(${0.5 + wordProgress * 0.5}) translateY(${(1 - wordProgress) * 30}px)`,
            opacity: wordProgress,
          });
        } else if (mode === 'maskWipe') {
          Object.assign(wordStyle, {
            clipPath: `inset(0 ${(1 - wordProgress) * 100}% 0 0)`,
            transform: `translateY(${(1 - wordProgress) * 14}px)`,
          });
        } else if (mode === 'blurIn') {
          Object.assign(wordStyle, {
            filter: `blur(${(1 - wordProgress) * 14}px)`,
            opacity: wordProgress,
          });
        } else if (mode === 'scaleIn') {
          Object.assign(wordStyle, {
            transform: `scale(${1.3 - wordProgress * 0.3})`,
            opacity: wordProgress,
          });
        } else if (mode === 'slideClip') {
          Object.assign(wordStyle, {
            transform: `translateX(${(1 - wordProgress) * (wi % 2 ? 70 : -70)}px)`,
            opacity: wordProgress,
          });
        }

        if (mode === 'charStagger') {
          inner = chars.map((ch, ci) => {
            const idx = charCursor + ci;
            const p = ease('quartOut', (frame - (delay + idx * stagger)) / 12);
            return (
              <span key={ci} style={{
                display: 'inline-block', whiteSpace: 'pre',
                transform: `translateY(${(1 - p) * 64}px)`,
                opacity: p,
              }}>{ch}</span>
            );
          });
          charCursor += chars.length + 1;
        } else {
          inner = chars.map((ch, ci) => <span key={ci} style={{ display: 'inline-block', whiteSpace: 'pre' }}>{ch}</span>);
        }

        return (
          <span key={wi} style={wordStyle}>
            {inner}
            {isAccent && accent ? (
              <span style={{
                position: 'absolute', left: 0, right: 0, bottom: -fontSize * 0.08, height: fontSize * 0.075,
                background: accent, borderRadius: 6, display: 'block',
                transform: `scaleX(${ease('expoOut', (frame - wordDelayBase - 6) / 16)})`,
                transformOrigin: 'left center',
              }} />
            ) : null}
            <span style={{ display: 'inline-block', width: '0.28em' }} />
          </span>
        );
      })}
    </div>
  );
}

/** Compact kicker label above the headline. */
export function Kicker({ text, color, accent, fontFamily, fontSize = 38, delay = 2, tracking = 0.32 }) {
  const frame = useCurrentFrame();
  const p = ease('expoOut', (frame - delay) / 12);
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 18, opacity: p,
      transform: `translateY(${(1 - p) * 18}px)`,
    }}>
      <span style={{ width: 56, height: 5, background: accent, borderRadius: 4, transform: `scaleX(${p})`, transformOrigin: 'left' }} />
      <span style={{
        fontFamily, fontSize, color, letterSpacing: `${tracking}em`,
        textTransform: 'uppercase', fontWeight: 700,
      }}>{String(text || '').toUpperCase()}</span>
    </div>
  );
}

/** Body/annotation text used by several layouts. */
export function BodyText({ text, color, fontFamily, fontSize = 44, delay = 10, align = 'center', maxWidth = 860, weight = 600, lineHeight = 1.35 }) {
  const frame = useCurrentFrame();
  const p = ease('quintOut', (frame - delay) / 16);
  return (
    <div style={{
      fontFamily, fontSize, color, opacity: p, textAlign: align, maxWidth,
      lineHeight, fontWeight: weight,
      marginLeft: 'auto', marginRight: 'auto',
      transform: `translateY(${(1 - p) * 22}px)`,
    }}>{text}</div>
  );
}
