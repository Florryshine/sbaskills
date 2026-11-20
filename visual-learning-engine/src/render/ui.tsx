// src/render/ui.tsx — shared visual building blocks for every scene.

import React from 'react';
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig, Easing } from 'remotion';
import { FONT_BODY, FONT_HEADLINE } from './fonts';
import { THEME, type Layout } from './theme';

export const TRANSITION_FRAMES = 14;
/** One image never stays on screen longer than this (user requirement: <= 3s). */
export const MAX_SHOT_FRAMES = 90; // 3s at 30fps
const SHOT_CROSSFADE = 10;

/** Warm paper background with a subtle vignette — the reference look. */
export const PaperBackground: React.FC<{ layout: Layout }> = ({ layout }) => {
  const { width, height } = layout;
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', inset: 0, background: THEME.paper }} />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(120% 90% at 50% 35%, rgba(255,255,255,0.6) 0%, rgba(247,241,230,0.0) 45%, rgba(214,205,188,0.35) 100%)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          right: -width * 0.1,
          top: -height * 0.06,
          width: width * 0.34,
          height: width * 0.34,
          borderRadius: '50%',
          background: 'rgba(255,183,3,0.07)',
        }}
      />
    </AbsoluteFill>
  );
};

/** Split a headline into words; `accentWord` (case-insensitive) gets the accent color. */
function splitAccent(headline: string, accentWord?: string): { word: string; accent: boolean }[] {
  const target = (accentWord || '').replace(/[^\p{L}\p{N}'’-]/gu, '').toLowerCase();
  if (!target) return headline.split(/\s+/).filter(Boolean).map((word) => ({ word, accent: false }));
  return headline
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      const clean = word.replace(/[^\p{L}\p{N}'’-]/gu, '').toLowerCase();
      return { word, accent: clean === target };
    });
}

/** Giant uppercase headline with staggered word pop-in and one accent word. */
export const Headline: React.FC<{
  text: string;
  layout: Layout;
  accentWord?: string;
  accentColor?: string;
  delay?: number;
  align?: 'left' | 'center';
  maxWidth?: number;
  sizeFactor?: number;
  lineHeight?: number;
}> = ({ text, layout, accentWord, accentColor = THEME.accent, delay = 0, align = 'left', maxWidth, sizeFactor = 1, lineHeight = 1.08 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = splitAccent(text.toUpperCase(), accentWord);
  const longest = words.reduce((a, w) => Math.max(a, w.word.length), 0);
  const shrink = Math.min(1, Math.max(0.62, 1.0 - Math.max(0, longest - 9) * 0.045));
  const baseSize = layout.headlineSize * sizeFactor * shrink;
  const wrapWidth = maxWidth ?? layout.width - layout.padX * 2;
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: baseSize * 0.18,
        justifyContent: align === 'center' ? 'center' : 'flex-start',
        alignItems: 'flex-start',
        maxWidth: wrapWidth,
        fontFamily: FONT_HEADLINE,
        fontWeight: 400,
        fontSize: baseSize,
        lineHeight,
        color: THEME.ink,
        letterSpacing: '0.01em',
      }}
    >
      {words.map((w, i) => {
        const pop = spring({
          frame: frame - delay - i * 2,
          fps,
          config: { damping: 14, stiffness: 160, mass: 0.6 },
        });
        return (
          <span
            key={`${w.word}-${i}`}
            style={{
              display: 'inline-block',
              transform: `translateY(${(1 - pop) * 24}px)`,
              opacity: Math.min(1, pop * 2),
              color: w.accent ? accentColor : THEME.ink,
            }}
          >
            {w.word}
          </span>
        );
      })}
    </div>
  );
};

/** Ken Burns transform for one image over `frames` frames. */
function kenBurnsTransform(progress: number, kb: { fromScale: number; toScale: number; fromX: number; toX: number; fromY: number; toY: number }, layout: Layout): string {
  const scale = kb.fromScale + (kb.toScale - kb.fromScale) * progress;
  const tx = (kb.fromX + (kb.toX - kb.fromX) * progress) * layout.width;
  const ty = (kb.fromY + (kb.toY - kb.fromY) * progress) * layout.height;
  return `scale(${scale}) translate(${tx * 0.5}px, ${ty * 0.5}px)`;
}

/** A single image inside a rounded card with its own Ken Burns motion. */
const ShotImage: React.FC<{
  src: string;
  layout: Layout;
  shotProgress: number;
  kb: { fromScale: number; toScale: number; fromX: number; toX: number; fromY: number; toY: number };
}> = ({ src, layout, shotProgress, kb }) => (
  <Img
    src={src}
    style={{
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      transform: kenBurnsTransform(shotProgress, kb, layout),
    }}
  />
);

/**
 * Shot carousel: cycles through the scene's images so no single image is on
 * screen for more than MAX_SHOT_FRAMES (3s), with a quick crossfade between
 * shots and alternating Ken Burns direction per shot (reads like camera cuts).
 */
export const ShotCarousel: React.FC<{
  srcs: string[];
  layout: Layout;
  sceneFrames: number;
  kb: { fromScale: number; toScale: number; fromX: number; toX: number; fromY: number; toY: number };
  delay?: number;
  borderRadius?: number;
  width?: number | string;
  height?: number | string;
  maxWidth?: number;
  maxHeight?: number;
}> = ({ srcs, layout, sceneFrames, kb, delay = 0, borderRadius, width, height, maxWidth, maxHeight }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const br = borderRadius ?? layout.unit * 0.045;
  const pop = spring({ frame: frame - delay, fps, config: { damping: 16, stiffness: 120, mass: 0.7 } });

  if (srcs.length === 0) {
    return (
      <div
        style={{
          width: width ?? '100%',
          height: height ?? '100%',
          maxWidth,
          maxHeight,
          borderRadius: br,
          background: THEME.cardWhite,
          opacity: Math.min(1, pop * 1.6),
          boxShadow: `0 ${layout.unit * 0.02}px ${layout.unit * 0.05}px ${THEME.shadow}`,
          transform: `translateY(${(1 - pop) * 30}px)`,
        }}
      />
    );
  }

  // Shot boundaries: every MAX_SHOT_FRAMES until the scene ends; the last
  // shot holds the remainder so the carousel always fills the scene.
  const local = Math.max(0, frame - delay);
  const shotCount = srcs.length;
  const fullShots = Math.min(shotCount - 1, Math.floor((sceneFrames - 1) / MAX_SHOT_FRAMES));
  const boundaries: number[] = [];
  for (let s = 0; s <= fullShots; s++) boundaries.push(s * MAX_SHOT_FRAMES);
  const activeShot = Math.min(fullShots, Math.max(0, boundaries.filter((b) => local >= b).length - 1));
  const shotStart = boundaries[Math.min(activeShot, boundaries.length - 1)];
  const nextBoundary = activeShot < fullShots ? boundaries[activeShot + 1] : sceneFrames;
  const shotFrames = Math.max(1, nextBoundary - shotStart);
  const shotProgress = Math.min(1, Math.max(0, (local - shotStart) / shotFrames));

  // Alternate zoom direction per shot: even shots zoom in, odd zoom out.
  const flip = activeShot % 2 === 1;
  const kbShot = flip
    ? { fromScale: kb.toScale, toScale: kb.fromScale, fromX: kb.toX, toX: kb.fromX, fromY: kb.toY, toY: kb.fromY }
    : kb;

  const fadeFrames = Math.min(SHOT_CROSSFADE, Math.floor(shotFrames / 2));
  const fadeIn = interpolate(local, [shotStart, shotStart + fadeFrames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const slideIn = interpolate(local, [shotStart, shotStart + fadeFrames], [layout.width * 0.02, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const fadeOut = activeShot < fullShots
    ? interpolate(local, [nextBoundary - fadeFrames, nextBoundary], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
    : 1;

  const prevSrc = activeShot > 0 ? srcs[activeShot - 1] : null;

  return (
    <div
      style={{
        width: width ?? '100%',
        height: height ?? '100%',
        maxWidth,
        maxHeight,
        borderRadius: br,
        overflow: 'hidden',
        background: THEME.cardWhite,
        boxShadow: `0 ${layout.unit * 0.02}px ${layout.unit * 0.05}px ${THEME.shadow}`,
        transform: `translateY(${(1 - pop) * 30}px) scale(${0.94 + pop * 0.06})`,
        opacity: Math.min(1, pop * 1.6),
        position: 'relative',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      {activeShot > 0 && fadeOut < 1 && prevSrc ? (
        <div style={{ position: 'absolute', inset: 0, opacity: fadeOut }}>
          <ShotImage src={prevSrc} layout={layout} shotProgress={1} kb={flip ? kb : { ...kb, fromScale: kb.toScale, toScale: kb.fromScale, fromX: kb.toX, toX: kb.fromX, fromY: kb.toY, toY: kb.fromY }} />
        </div>
      ) : null}
      <div style={{ position: 'absolute', inset: 0, opacity: Math.min(fadeIn, fadeOut), transform: `translateX(${slideIn}px)` }}>
        <ShotImage src={srcs[activeShot]} layout={layout} shotProgress={shotProgress} kb={kbShot} />
      </div>
    </div>
  );
};

/** Small rounded badge chip that pops in. */
export const Badge: React.FC<{ label: string; emoji?: string; layout: Layout; delay: number; color?: string }> = ({
  label,
  emoji,
  layout,
  delay,
  color = THEME.accentAmber,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame: frame - delay, fps, config: { damping: 13, stiffness: 180, mass: 0.55 } });
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: layout.unit * 0.012,
        background: THEME.cardWhite,
        border: `${Math.max(2, layout.unit * 0.003)}px solid ${color}`,
        color: THEME.ink,
        borderRadius: layout.unit,
        padding: `${layout.unit * 0.014}px ${layout.unit * 0.03}px`,
        fontFamily: FONT_BODY,
        fontWeight: 700,
        fontSize: layout.bodySize * 0.8,
        transform: `scale(${Math.max(0, pop)}) rotate(${(1 - pop) * -6}deg)`,
        opacity: Math.min(1, pop * 2),
        boxShadow: `0 ${layout.unit * 0.012}px ${layout.unit * 0.03}px ${THEME.shadow}`,
        whiteSpace: 'nowrap',
      }}
    >
      {emoji ? <span style={{ fontSize: layout.bodySize * 0.9 }}>{emoji}</span> : null}
      {label}
    </div>
  );
};

/** Word-synced caption bar at the bottom (active word highlighted). */
export const CaptionBar: React.FC<{
  text: string;
  words: { word: string; start: number; end: number }[];
  layout: Layout;
  narrationDelayFrames: number;
  accentColor?: string;
}> = ({ text, words, layout, narrationDelayFrames, accentColor = THEME.accent }) => {
  const frame = useCurrentFrame();
  const localSeconds = Math.max(0, (frame - narrationDelayFrames) / 30);
  const activeIdx = words.findIndex((w) => localSeconds >= w.start && localSeconds < w.end);
  const rows: string[][] = [];
  let current: string[] = [];
  for (const w of words) {
    current.push(w.word);
    if (current.length >= 7) {
      rows.push(current);
      current = [];
    }
  }
  if (current.length) rows.push(current);
  let acc = 0;
  let activeRow = 0;
  for (let r = 0; r < rows.length; r++) {
    acc += rows[r].length;
    if (activeIdx < acc) {
      activeRow = r;
      break;
    }
    activeRow = rows.length - 1;
  }
  const rowStartWord = rows.slice(0, activeRow).reduce((a, r) => a + r.length, 0);
  const rowWords = words.slice(rowStartWord, rowStartWord + rows[activeRow].length);
  const fade = interpolate(frame, [narrationDelayFrames, narrationDelayFrames + 8, narrationDelayFrames + 8 + Math.max(1, words[words.length - 1]?.end ?? 3) * 30 - 10], [0, 1, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <div
      style={{
        position: 'absolute',
        left: layout.padX,
        right: layout.padX,
        bottom: layout.padY * 0.9,
        display: 'flex',
        justifyContent: 'center',
        opacity: fade,
      }}
    >
      <div
        style={{
          background: 'rgba(23,23,28,0.86)',
          color: '#FFFFFF',
          borderRadius: layout.unit * 0.14,
          padding: `${layout.unit * 0.02}px ${layout.unit * 0.032}px`,
          fontFamily: FONT_BODY,
          fontWeight: 700,
          fontSize: layout.captionSize,
          lineHeight: 1.35,
          textAlign: 'center',
          maxWidth: '100%',
        }}
      >
        {rowWords.map((w, i) => {
          const isActive = rowStartWord + i === activeIdx;
          return (
            <span key={`${w.word}-${i}`} style={{ color: isActive ? accentColor : '#FFFFFF', marginRight: layout.unit * 0.008 }}>
              {w.word}{' '}
            </span>
          );
        })}
      </div>
    </div>
  );
};

/** Thin progress bar at the top of the frame. */
export const ProgressBar: React.FC<{ progress: number; layout: Layout; color?: string }> = ({ progress, layout, color = THEME.accent }) => (
  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: Math.max(4, layout.unit * 0.008), background: 'rgba(23,23,28,0.08)' }}>
    <div style={{ height: '100%', width: `${Math.min(100, progress * 100)}%`, background: color, transition: 'none' }} />
  </div>
);

/** Brand watermark, bottom-right. */
export const Watermark: React.FC<{ text: string; layout: Layout }> = ({ text, layout }) => (
  <div
    style={{
      position: 'absolute',
      right: layout.padX * 0.8,
      bottom: layout.padY * 0.55,
      fontFamily: FONT_BODY,
      fontWeight: 700,
      fontSize: layout.unit * 0.026,
      color: THEME.ink,
      opacity: 0.42,
      letterSpacing: '0.02em',
    }}
  >
    {text}
  </div>
);

/** Resolve an asset path: absolute URL (preview) or staticFile (render). */
export function assetSrc(file: string | null, assetBaseUrl?: string): string | null {
  if (!file) return null;
  if (assetBaseUrl) return `${assetBaseUrl.replace(/\/$/, '')}/${file}`;
  return staticFile(file);
}

/** Crossfade wrapper applied per scene Sequence. */
export const SceneFade: React.FC<{ children: React.ReactNode; isFirst: boolean; isLast: boolean; sceneFrames: number }> = ({
  children,
  isFirst,
  isLast,
  sceneFrames,
}) => {
  const frame = useCurrentFrame();
  const fadeIn = isFirst ? 1 : interpolate(frame, [0, TRANSITION_FRAMES], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const fadeOut = isLast ? 1 : interpolate(frame, [sceneFrames - TRANSITION_FRAMES, sceneFrames], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const slide = (1 - fadeIn) * 24;
  return (
    <AbsoluteFill style={{ opacity: Math.min(fadeIn, fadeOut), transform: `translateY(${slide}px)` }}>
      {children}
    </AbsoluteFill>
  );
};
