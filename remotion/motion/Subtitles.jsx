// Subtitles with per-word highlighting for the Motion Graphics Engine.
// Words come from the narration timing produced by the worker
// (lib/motion/estimate.js wordsFor) or from the real TTS timings.

import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { ease } from './easing.js';

export function SubtitleTrack({ words, sceneStartFrame, color, accent, fontFamily, fontSize = 40, activeColor }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (!words?.length) return null;
  const localSeconds = frame / fps;
  const activeIndex = words.findIndex((w) => localSeconds >= w.start && localSeconds < w.end);
  if (activeIndex === -1) {
    // Between narration beats: show nothing (no stale text walls).
    return null;
  }
  // Show only the sentence chunk around the active word so the track reads
  // like captions, not a transcript wall.
  const isBreak = (w) => /[.!?…]$/.test(w.word) || /—/.test(w.word);
  let chunkStart = activeIndex;
  while (chunkStart > 0 && !isBreak(words[chunkStart - 1])) chunkStart--;
  let chunkEnd = activeIndex;
  while (chunkEnd < words.length - 1 && !isBreak(words[chunkEnd])) chunkEnd++;
  const chunk = words.slice(chunkStart, chunkEnd + 1);
  const activeLocal = activeIndex - chunkStart;

  return (
    <div style={{
      position: 'absolute', left: 70, right: 70, bottom: 104,
      display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 12,
      fontFamily, fontSize, fontWeight: 600, lineHeight: 1.3,
    }}>
      {chunk.map((w, i) => {
        const appeared = localSeconds >= w.start;
        const p = appeared ? ease('quintOut', (localSeconds - w.start) / 0.16) : 0;
        const isActive = i === activeLocal;
        return (
          <span key={i} style={{
            color: isActive ? (activeColor || accent) : color,
            opacity: isActive ? 1 : appeared ? 0.78 : 0.28,
            transform: `translateY(${(1 - p) * 8}px) scale(${isActive ? 1.1 : 1})`,
            display: 'inline-block',
            textShadow: '0 2px 14px rgba(0,0,0,0.45)',
          }}>{w.word}</span>
        );
      })}
    </div>
  );
}

/** Compact brand tag rendered throughout the video. */
export function BrandTag({ text, color, accent, fontFamily }) {
  const frame = useCurrentFrame();
  const opacity = Math.min(0.72, 0.2 + frame * 0.02);
  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, bottom: 56,
      display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 14,
      opacity,
    }}>
      <span style={{ width: 26, height: 3, background: accent, borderRadius: 2 }} />
      <span style={{ fontFamily, fontSize: 26, color, letterSpacing: '0.28em', textTransform: 'uppercase', fontWeight: 700 }}>
        {String(text || '').toUpperCase()}
      </span>
      <span style={{ width: 26, height: 3, background: accent, borderRadius: 2 }} />
    </div>
  );
}

/** Thin progress bar along the top edge of the frame. */
export function ProgressBar({ color, progress }) {
  return (
    <div style={{
      position: 'absolute', left: 0, top: 0, height: 8, width: '100%',
      background: 'rgba(127,127,127,0.14)',
    }}>
      <div style={{
        height: '100%', width: `${Math.max(0, Math.min(1, progress)) * 100}%`,
        background: color,
      }} />
    </div>
  );
}
