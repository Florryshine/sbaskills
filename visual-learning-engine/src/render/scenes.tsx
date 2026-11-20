// src/render/scenes.tsx — the scene grammars (one component per scene type).
//
// Layout rules mirror the reference style: giant uppercase headlines with a
// single accent word, one clear illustration per beat, generous paper
// margins, spring pop-ins, and camera-like motion on imagery (each scene
// cycles through its image shots at <=3s per image). Everything scales from
// the layout unit so the same scene renders correctly in 16:9, 9:16 and 1:1.

import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig, Easing } from 'remotion';
import type { SceneSpec, SceneTimeline } from '../types';
import { FONT_BODY, FONT_HEADLINE } from './fonts';
import { THEME, toneColor, type Layout } from './theme';
import { Badge, Headline, ShotCarousel } from './ui';

export interface SceneProps {
  spec: SceneSpec;
  scene: SceneTimeline;
  layout: Layout;
  /** all image shots for this scene (carousel advances <=3s per image) */
  imageSrcs: string[];
  /** second image (compare scenes: right side) */
  imageSrcB?: string | null;
  accent: string;
  /** frames after which each list/process/recap item appears */
  itemDelays: number[];
}

/** Distribute item reveal delays across the narration window, weighted by text length. */
export function itemRevealDelays(scene: SceneTimeline, items: { text: string }[]): number[] {
  const narrFrames = Math.ceil(scene.narrationDuration * 30);
  const start = scene.narrationDelayFrames + Math.min(20, narrFrames * 0.1);
  const usable = Math.max(30, narrFrames * 0.86);
  const weights = items.map((it) => Math.max(12, it.text.length));
  const total = weights.reduce((a, b) => a + b, 0);
  let acc = 0;
  return weights.map((w) => {
    const at = start + (acc / total) * usable;
    acc += w;
    return Math.round(at);
  });
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

const HookScene: React.FC<SceneProps> = ({ spec, scene, layout, imageSrcs, accent }) => {
  if (spec.type !== 'hook') return null;
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const qm = spring({ frame: frame - 34, fps, config: { damping: 12, stiffness: 140 } });
  return (
    <AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          left: layout.padX,
          right: layout.padX,
          top: layout.padY * 1.1,
          display: 'flex',
          justifyContent: layout.isTall ? 'center' : 'flex-start',
        }}
      >
        {/* narrower + smaller in tall mode so 3-line headlines always fit above the image */}
        <Headline
          text={spec.headline}
          layout={layout}
          accentWord={spec.accentWord}
          accentColor={accent}
          align={layout.isTall ? 'center' : 'left'}
          sizeFactor={layout.isTall ? 0.78 : 1.1}
          maxWidth={layout.isTall ? layout.width * 0.82 : undefined}
        />
      </div>
      <div
        style={{
          position: 'absolute',
          left: layout.padX,
          right: layout.padX,
          top: layout.isTall ? layout.padY * 1.1 + layout.headlineSize * 3.3 : layout.padY * 1.1 + layout.headlineSize * 2.6,
          bottom: layout.padY * 1.15,
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <ShotCarousel srcs={imageSrcs} layout={layout} sceneFrames={scene.durationFrames} kb={scene.kenBurns} delay={6} maxWidth={layout.width * 0.86} height="100%" />
      </div>
      <div
        style={{
          position: 'absolute',
          right: layout.padX * 0.6,
          top: layout.padY * 0.5,
          fontSize: layout.unit * 0.22,
          fontFamily: FONT_HEADLINE,
          color: accent,
          opacity: qm * 0.85,
          transform: `rotate(${(1 - qm) * 24}deg) scale(${0.6 + qm * 0.4})`,
        }}
      >
        ?
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Title card
// ---------------------------------------------------------------------------

const TitleScene: React.FC<SceneProps> = ({ spec, scene, layout, imageSrcs, accent }) => {
  if (spec.type !== 'title') return null;
  const frame = useCurrentFrame();
  const underline = interpolate(frame, [22, 52], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.ease) });
  const subSpring = spring({ frame: frame - 16, fps: 30, config: { damping: 15, stiffness: 120 } });
  return (
    <AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          left: layout.padX,
          right: layout.padX,
          top: layout.padY * 1.05,
          display: 'flex',
          flexDirection: 'column',
          alignItems: layout.isTall ? 'center' : 'flex-start',
          gap: layout.unit * 0.02,
        }}
      >
        <Headline text={spec.headline} layout={layout} accentColor={accent} align={layout.isTall ? 'center' : 'left'} sizeFactor={0.92} />
        <div
          style={{
            width: `${underline * 42}%`,
            height: layout.unit * 0.014,
            background: accent,
            borderRadius: layout.unit,
          }}
        />
        {spec.subtitle ? (
          <div
            style={{
              fontFamily: FONT_BODY,
              fontWeight: 700,
              fontSize: layout.bodySize,
              color: THEME.inkSoft,
              opacity: subSpring,
              transform: `translateY(${(1 - subSpring) * 12}px)`,
              textAlign: layout.isTall ? 'center' : 'left',
            }}
          >
            {spec.subtitle}
          </div>
        ) : null}
      </div>
      <div
        style={{
          position: 'absolute',
          left: layout.padX,
          right: layout.padX,
          top: layout.isTall ? layout.padY * 1.05 + layout.headlineSize * 3.6 : layout.padY * 1.05 + layout.headlineSize * 3.0,
          bottom: layout.padY * 1.1,
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <ShotCarousel srcs={imageSrcs} layout={layout} sceneFrames={scene.durationFrames} kb={scene.kenBurns} delay={4} maxWidth={layout.width * 0.8} height="100%" />
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Statement (headline + illustration + badges)
// ---------------------------------------------------------------------------

const StatementScene: React.FC<SceneProps> = ({ spec, scene, layout, imageSrcs, accent }) => {
  if (spec.type !== 'statement') return null;
  const badges = spec.badges ?? [];
  const imageWidth = layout.isTall ? layout.width - layout.padX * 2 : layout.width * 0.44;
  const imageHeight = layout.isTall ? layout.height * 0.5 : layout.height * 0.66;
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', left: layout.padX, top: layout.padY, width: layout.isTall ? layout.width - layout.padX * 2 : layout.width * 0.5 }}>
        <Headline
          text={spec.headline || ''}
          layout={layout}
          accentWord={spec.accentWord}
          accentColor={accent}
          sizeFactor={0.86}
          align={layout.isTall ? 'center' : 'left'}
          maxWidth={layout.isTall ? layout.width - layout.padX * 2 : layout.width * 0.46}
        />
      </div>
      <div
        style={{
          position: 'absolute',
          top: layout.isTall ? layout.padY * 1.05 + layout.headlineSize * 1.6 : layout.padY * 0.9,
          right: layout.padX,
          width: imageWidth,
          height: imageHeight,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: layout.isTall ? 'center' : 'flex-start',
        }}
      >
        <ShotCarousel srcs={imageSrcs} layout={layout} sceneFrames={scene.durationFrames} kb={scene.kenBurns} delay={4} width="100%" height={layout.isTall ? '78%' : '88%'} />
        {badges.length > 0 ? (
          <div style={{ display: 'flex', gap: layout.unit * 0.016, marginTop: layout.unit * 0.03, justifyContent: layout.isTall ? 'center' : 'flex-start' }}>
            {badges.map((b, i) => (
              <Badge key={`${b.label}-${i}`} label={b.label} emoji={b.emoji} layout={layout} delay={30 + i * 10} color={i === 0 ? accent : THEME.accentAmber} />
            ))}
          </div>
        ) : null}
      </div>
      {!layout.isTall ? (
        <div
          style={{
            position: 'absolute',
            left: layout.padX,
            bottom: layout.padY * 1.35,
            width: layout.width * 0.42,
            display: 'flex',
            gap: layout.unit * 0.016,
          }}
        >
          {badges.slice(0, 2).map((b, i) => (
            <Badge key={`b2-${b.label}-${i}`} label={b.label} emoji={b.emoji} layout={layout} delay={34 + i * 10} color={i === 0 ? accent : THEME.accentAmber} />
          ))}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Compare (split screen)
// ---------------------------------------------------------------------------

const CompareSide: React.FC<{
  label: string;
  tone?: 'bad' | 'good' | 'neutral';
  imageSrc: string | null;
  layout: Layout;
  scene: SceneTimeline;
  delay: number;
}> = ({ label, tone = 'neutral', imageSrc, layout, scene, delay }) => {
  const color = toneColor(tone);
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: layout.unit * 0.022 }}>
      <ShotCarousel srcs={imageSrc ? [imageSrc] : []} layout={layout} sceneFrames={scene.durationFrames} kb={scene.kenBurns} delay={delay} width="100%" height={layout.isTall ? '62%' : '66%'} />
      <div
        style={{
          fontFamily: FONT_HEADLINE,
          fontSize: layout.headlineSize * 0.42,
          color,
          border: `${Math.max(3, layout.unit * 0.005)}px solid ${color}`,
          borderRadius: layout.unit * 0.12,
          padding: `${layout.unit * 0.012}px ${layout.unit * 0.028}px`,
          background: THEME.cardWhite,
          boxShadow: `0 ${layout.unit * 0.012}px ${layout.unit * 0.03}px ${THEME.shadow}`,
        }}
      >
        {label}
      </div>
    </div>
  );
};

const CompareScene: React.FC<SceneProps> = ({ spec, scene, layout, imageSrcs, imageSrcB, accent }) => {
  if (spec.type !== 'compare') return null;
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const vsPop = spring({ frame: frame - 26, fps, config: { damping: 12, stiffness: 170 } });
  const leftImg = imageSrcs[0] ?? null;
  const rightImg = imageSrcB ?? leftImg;
  return (
    <AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          left: layout.padX * 0.6,
          right: layout.padX * 0.6,
          top: layout.padY,
          bottom: layout.padY,
          display: 'flex',
          flexDirection: layout.isTall ? 'column' : 'row',
          gap: layout.isTall ? layout.unit * 0.03 : 0,
        }}
      >
        <CompareSide label={spec.left.label} tone={spec.left.tone} imageSrc={leftImg} layout={layout} scene={scene} delay={2} />
        <CompareSide label={spec.right.label} tone={spec.right.tone} imageSrc={rightImg} layout={layout} scene={scene} delay={8} />
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: layout.isTall ? '50%' : layout.padY,
            bottom: layout.isTall ? 'auto' : layout.padY,
            width: layout.isTall ? layout.unit * 0.28 : 'auto',
            height: layout.isTall ? 'auto' : 'auto',
            transform: `translate(-50%, ${layout.isTall ? '-50%' : 0})`,
            display: 'flex',
            flexDirection: layout.isTall ? 'column' : 'row',
            alignItems: 'center',
          }}
        >
          <div
            style={{
              width: layout.isTall ? Math.max(3, layout.unit * 0.006) : Math.max(3, layout.unit * 0.005),
              height: layout.isTall ? 'auto' : '100%',
              flex: layout.isTall ? 1 : 'none',
              background: 'rgba(23,23,28,0.22)',
              borderRadius: layout.unit,
            }}
          />
          <div
            style={{
              fontFamily: FONT_HEADLINE,
              fontSize: layout.headlineSize * 0.4,
              color: '#FFFFFF',
              background: accent,
              borderRadius: layout.unit,
              padding: `${layout.unit * 0.014}px ${layout.unit * 0.026}px`,
              margin: layout.unit * 0.014,
              transform: `scale(${Math.max(0, vsPop)}) rotate(${(1 - vsPop) * -10}deg)`,
              boxShadow: `0 ${layout.unit * 0.016}px ${layout.unit * 0.04}px ${THEME.shadow}`,
            }}
          >
            {spec.versus || 'VS'}
          </div>
          <div
            style={{
              width: layout.isTall ? Math.max(3, layout.unit * 0.006) : Math.max(3, layout.unit * 0.005),
              height: layout.isTall ? 'auto' : '100%',
              flex: layout.isTall ? 1 : 'none',
              background: 'rgba(23,23,28,0.22)',
              borderRadius: layout.unit,
            }}
          />
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

const ListScene: React.FC<SceneProps> = ({ spec, scene, layout, accent, itemDelays }) => {
  if (spec.type !== 'list') return null;
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const items = spec.items;
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', left: layout.padX, right: layout.padX, top: layout.padY }}>
        <Headline text={spec.title} layout={layout} accentColor={accent} sizeFactor={0.8} />
      </div>
      <div
        style={{
          position: 'absolute',
          left: layout.padX,
          right: layout.padX,
          top: layout.padY * 1.1 + layout.headlineSize * 1.6,
          bottom: layout.padY,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: layout.unit * 0.024,
        }}
      >
        {items.map((item, i) => {
          const pop = spring({ frame: frame - (itemDelays?.[i] ?? 20 + i * 20), fps, config: { damping: 14, stiffness: 150, mass: 0.6 } });
          return (
            <div
              key={`${item.text}-${i}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: layout.unit * 0.022,
                background: THEME.cardWhite,
                borderRadius: layout.unit * 0.09,
                padding: `${layout.unit * 0.022}px ${layout.unit * 0.03}px`,
                boxShadow: `0 ${layout.unit * 0.014}px ${layout.unit * 0.035}px ${THEME.shadow}`,
                transform: `translateX(${(1 - pop) * -60}px)`,
                opacity: Math.min(1, pop * 1.8),
              }}
            >
              <div
                style={{
                  minWidth: layout.unit * 0.075,
                  height: layout.unit * 0.075,
                  borderRadius: '50%',
                  background: accent,
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: FONT_HEADLINE,
                  fontSize: layout.unit * 0.042,
                }}
              >
                {i + 1}
              </div>
              <div style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: layout.bodySize * 1.05, color: THEME.ink }}>
                {item.emoji ? `${item.emoji} ` : ''}
                {item.text}
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Stat (giant count-up number)
// ---------------------------------------------------------------------------

const StatScene: React.FC<SceneProps> = ({ spec, scene, layout, imageSrcs, accent }) => {
  if (spec.type !== 'stat') return null;
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const narrFrames = Math.ceil(scene.narrationDuration * 30);
  const countEnd = scene.narrationDelayFrames + Math.min(45, narrFrames * 0.5);
  const match = spec.number.match(/^([\d.]+)\s*(.*)$/);
  const numeric = match ? parseFloat(match[1]) : null;
  const suffix = match ? match[2] : spec.number;
  const progress = interpolate(frame, [scene.narrationDelayFrames, countEnd], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const value = numeric !== null && isFinite(numeric) ? (numeric * progress).toFixed(numeric % 1 !== 0 ? 1 : 0) : spec.number;
  const impact = spring({ frame: frame - countEnd, fps, config: { damping: 11, stiffness: 190 } });
  return (
    <AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          left: layout.padX,
          right: layout.padX,
          top: layout.padY * 0.9,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <div
          style={{
            fontFamily: FONT_HEADLINE,
            fontSize: layout.unit * 0.28,
            color: accent,
            transform: `scale(${1 + Math.max(0, impact - 0) * 0.08})`,
            textShadow: `0 ${layout.unit * 0.02}px 0 rgba(23,23,28,0.12)`,
            lineHeight: 1,
          }}
        >
          {value}
          <span style={{ fontSize: layout.unit * 0.16, color: THEME.ink }}>{suffix}</span>
        </div>
        {spec.headline ? (
          <div style={{ marginTop: layout.unit * 0.02, width: '100%', display: 'flex', justifyContent: 'center' }}>
            <Headline text={spec.headline} layout={layout} accentColor={accent} sizeFactor={0.62} align="center" />
          </div>
        ) : null}
      </div>
      <div
        style={{
          position: 'absolute',
          left: layout.padX * 2.4,
          right: layout.padX * 2.4,
          top: layout.padY * 0.9 + layout.unit * 0.42,
          bottom: layout.padY * 1.2,
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <ShotCarousel srcs={imageSrcs} layout={layout} sceneFrames={scene.durationFrames} kb={scene.kenBurns} delay={8} height="100%" maxWidth={layout.width * 0.62} />
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Process (steps with arrows)
// ---------------------------------------------------------------------------

const ProcessScene: React.FC<SceneProps> = ({ spec, scene, layout, accent, itemDelays }) => {
  if (spec.type !== 'process') return null;
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const steps = spec.steps;
  const vertical = layout.isTall;
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', left: layout.padX, right: layout.padX, top: layout.padY }}>
        <Headline text={spec.title} layout={layout} accentColor={accent} sizeFactor={0.8} align={vertical ? 'center' : 'left'} />
      </div>
      <div
        style={{
          position: 'absolute',
          left: layout.padX,
          right: layout.padX,
          top: layout.padY * 1.1 + layout.headlineSize * 1.6,
          bottom: layout.padY,
          display: 'flex',
          flexDirection: vertical ? 'column' : 'row',
          justifyContent: 'center',
          alignItems: vertical ? 'stretch' : 'center',
          gap: layout.unit * 0.02,
        }}
      >
        {steps.map((step, i) => {
          const pop = spring({ frame: frame - (itemDelays?.[i] ?? 20 + i * 18), fps, config: { damping: 14, stiffness: 150, mass: 0.6 } });
          return (
            <React.Fragment key={`${step.text}-${i}`}>
              <div
                style={{
                  flex: vertical ? 'none' : 1,
                  background: THEME.cardWhite,
                  borderRadius: layout.unit * 0.09,
                  padding: `${layout.unit * 0.03}px ${layout.unit * 0.026}px`,
                  boxShadow: `0 ${layout.unit * 0.016}px ${layout.unit * 0.04}px ${THEME.shadow}`,
                  border: `${Math.max(2, layout.unit * 0.0035)}px solid ${i === steps.length - 1 ? accent : 'rgba(23,23,28,0.10)'}`,
                  textAlign: 'center',
                  transform: `translateY(${(1 - pop) * 46}px)`,
                  opacity: Math.min(1, pop * 1.8),
                }}
              >
                <div style={{ fontFamily: FONT_HEADLINE, fontSize: layout.unit * 0.05, color: accent, marginBottom: layout.unit * 0.008 }}>
                  {step.emoji || `STEP ${i + 1}`}
                </div>
                <div style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: layout.bodySize * 0.98, color: THEME.ink }}>{step.text}</div>
              </div>
              {i < steps.length - 1 ? (
                <div
                  style={{
                    fontFamily: FONT_HEADLINE,
                    fontSize: layout.unit * 0.05,
                    color: THEME.inkSoft,
                    opacity: pop,
                    transform: vertical ? `rotate(90deg)` : 'none',
                  }}
                >
                  →
                </div>
              ) : null}
            </React.Fragment>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Quote
// ---------------------------------------------------------------------------

const QuoteScene: React.FC<SceneProps> = ({ spec, layout, accent }) => {
  if (spec.type !== 'quote') return null;
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame: frame - 4, fps, config: { damping: 16, stiffness: 120, mass: 0.8 } });
  return (
    <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div
        style={{
          width: layout.width * 0.78,
          background: THEME.cardWhite,
          borderRadius: layout.unit * 0.07,
          padding: `${layout.unit * 0.06}px ${layout.unit * 0.055}px`,
          boxShadow: `0 ${layout.unit * 0.03}px ${layout.unit * 0.08}px ${THEME.shadow}`,
          borderLeft: `${Math.max(6, layout.unit * 0.012)}px solid ${accent}`,
          transform: `perspective(1200px) rotateY(${(1 - pop) * -14}deg) translateY(${(1 - pop) * 40}px)`,
          opacity: Math.min(1, pop * 1.6),
        }}
      >
        <div style={{ fontFamily: FONT_HEADLINE, fontSize: layout.unit * 0.11, color: accent, lineHeight: 1 }}>“</div>
        <div style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: layout.bodySize * 1.25, color: THEME.ink, lineHeight: 1.45 }}>{spec.text}</div>
        <div style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: layout.bodySize * 0.85, color: THEME.inkSoft, marginTop: layout.unit * 0.024 }}>— {spec.author}</div>
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Recap (checkmarks)
// ---------------------------------------------------------------------------

const RecapScene: React.FC<SceneProps> = ({ spec, scene, layout, accent, itemDelays }) => {
  if (spec.type !== 'recap') return null;
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', left: layout.padX, right: layout.padX, top: layout.padY }}>
        <Headline text={spec.title || 'REMEMBER THIS'} layout={layout} accentColor={accent} sizeFactor={0.8} />
      </div>
      <div
        style={{
          position: 'absolute',
          left: layout.padX,
          right: layout.padX,
          top: layout.padY * 1.1 + layout.headlineSize * 1.6,
          bottom: layout.padY,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: layout.unit * 0.026,
        }}
      >
        {spec.items.map((item, i) => {
          const pop = spring({ frame: frame - (itemDelays?.[i] ?? 18 + i * 18), fps, config: { damping: 14, stiffness: 150, mass: 0.6 } });
          const check = spring({ frame: frame - (itemDelays?.[i] ?? 18 + i * 18) + 8, fps, config: { damping: 12, stiffness: 200 } });
          return (
            <div
              key={`${item}-${i}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: layout.unit * 0.024,
                background: THEME.cardWhite,
                borderRadius: layout.unit * 0.09,
                padding: `${layout.unit * 0.024}px ${layout.unit * 0.032}px`,
                boxShadow: `0 ${layout.unit * 0.014}px ${layout.unit * 0.035}px ${THEME.shadow}`,
                transform: `translateX(${(1 - pop) * 60}px)`,
                opacity: Math.min(1, pop * 1.8),
              }}
            >
              <div
                style={{
                  minWidth: layout.unit * 0.07,
                  height: layout.unit * 0.07,
                  borderRadius: '50%',
                  background: accent,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg width={layout.unit * 0.042} height={layout.unit * 0.042} viewBox="0 0 24 24">
                  <path
                    d="M5 13 L10 18 L19 6"
                    fill="none"
                    stroke="#FFFFFF"
                    strokeWidth={4}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray={28}
                    strokeDashoffset={28 * (1 - Math.min(1, check))}
                  />
                </svg>
              </div>
              <div style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: layout.bodySize * 1.02, color: THEME.ink }}>{item}</div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Outro
// ---------------------------------------------------------------------------

const OutroScene: React.FC<SceneProps> = ({ spec, layout, accent }) => {
  if (spec.type !== 'outro') return null;
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pulse = spring({ frame: frame - 30, fps, config: { damping: 10, stiffness: 120, mass: 0.7 } });
  const ctaScale = 1 + Math.sin(frame / 14) * 0.02;
  return (
    <AbsoluteFill style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: layout.unit * 0.05 }}>
      <div style={{ transform: `scale(${0.9 + pulse * 0.1})` }}>
        <Headline text={spec.headline} layout={layout} accentColor={accent} sizeFactor={0.85} align="center" />
      </div>
      {spec.cta ? (
        <div
          style={{
            background: accent,
            color: '#FFFFFF',
            fontFamily: FONT_HEADLINE,
            fontSize: layout.headlineSize * 0.4,
            borderRadius: layout.unit,
            padding: `${layout.unit * 0.02}px ${layout.unit * 0.045}px`,
            transform: `scale(${ctaScale})`,
            boxShadow: `0 ${layout.unit * 0.02}px ${layout.unit * 0.05}px ${THEME.shadow}`,
          }}
        >
          {spec.cta}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

const SCENE_COMPONENTS: Record<SceneSpec['type'], React.FC<SceneProps>> = {
  hook: HookScene,
  title: TitleScene,
  statement: StatementScene,
  compare: CompareScene,
  list: ListScene,
  stat: StatScene,
  process: ProcessScene,
  quote: QuoteScene,
  recap: RecapScene,
  outro: OutroScene,
};

export function sceneComponent(type: SceneSpec['type']): React.FC<SceneProps> {
  return SCENE_COMPONENTS[type];
}
