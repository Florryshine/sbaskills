// Scene layout archetypes for the Motion Graphics Engine.
// Each layout is a complete composition: background accents, focal element,
// supporting elements and motion — all driven by the scene spec + direction.

import React, { useMemo } from 'react';
import { useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { ease, staggerDelay, drift } from './easing.js';
import { themeOf, displayType, typeScale } from './theme.js';
import { KineticTitle, Kicker, BodyText } from './elements/KineticText.jsx';
import { AnimatedCounter, BarChart, LineChart, DonutChart } from './elements/DataViz.jsx';
import {
  ShapeRing, ShapePolygon, ShapeLine, ShapeDot, ShapeBracket, ShapeArrow,
  ShapeTickArc, ShapeWaveform, ShapeFrame, ShapeStripes,
} from './elements/Shapes.jsx';
import { ParticleField } from './elements/Particles.jsx';

const LAYOUT_MODES = {
  kineticHeadline: ['charStagger', 'wordPop', 'maskWipe', 'slideClip'],
  spotlight: ['maskWipe', 'blurIn'],
  radialBurst: ['scaleIn', 'wordPop'],
  waveFocus: ['wordPop', 'charStagger'],
};

function layoutMode(scene, direction) {
  const rngIndex = scene.seed % 4;
  return (LAYOUT_MODES[scene.layout] || LAYOUT_MODES.kineticHeadline)[rngIndex % LAYOUT_MODES.kineticHeadline.length];
}

function revealDelay(scene, theme) {
  // Faster stagger for high-energy directions.
  const energy = theme.motion.energy || 0.6;
  return Math.max(3, Math.round(10 - energy * 5));
}

function LayoutShell({ theme, children, particles, seed }) {
  const { palette } = theme;
  const kind = particles && particles !== 'none' ? particles : null;
  const count = { dust: 24, sparks: 30, stars: 46, bubbles: 22, embers: 26, confetti: 30, rain: 0 }[kind] || 0;
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {kind && count > 0 ? (
        <ParticleField kind={kind} count={count} colors={[palette.accent, palette.accent2, palette.ink]} seed={seed} intensity={1} opacity={0.8} />
      ) : null}
      {children}
    </div>
  );
}

// ---------------------------------------------------------------- layouts --
function KineticHeadline({ scene, theme, direction }) {
  const { palette } = theme;
  const type = theme.type;
  const mode = layoutMode(scene, direction);
  const frame = useCurrentFrame();
  const { height } = useVideoConfig();
  const accentWord = scene.accentWord;
  const ringSpin = frame * (0.4 + (theme.motion.energy || 0.5));
  return (
    <LayoutShell theme={theme} particles={direction.particles} seed={scene.seed}>
      {/* orbit accents */}
      <div style={{ position: 'absolute', left: '50%', top: height * 0.30, transform: 'translate(-50%,-50%)' }}>
        <ShapeRing x={0} y={0} r={310} stroke={palette.accent} strokeWidth={3} opacity={0.35} progress={1} rotate={ringSpin} dash />
        <ShapeRing x={0} y={0} r={380} stroke={palette.accent2} strokeWidth={2} opacity={0.2} progress={1} rotate={-ringSpin * 0.7} dash />
        <ShapeDot x={Math.cos(ringSpin * 0.03) * 310} y={Math.sin(ringSpin * 0.03) * 310} r={10} fill={palette.accent} opacity={0.9} />
      </div>
      <div style={{ position: 'absolute', left: 90, right: 90, top: height * 0.34 }}>
        <Kicker text={scene.heading.slice(0, 30)} color={palette.inkSoft} accent={palette.accent} fontFamily={type.bodyFamily} delay={2} />
        <div style={{ height: 26 }} />
        <KineticTitle
          text={scene.narration.split(/(?<=[.!?])\s/)[0] || scene.heading}
          mode={mode}
          fontFamily={type.family}
          fontSize={typeScale('title', theme)}
          color={palette.ink}
          accent={palette.accent}
          accentWords={scene.emphasis}
          caseTransform={type.transform}
          tracking={type.tracking}
          weight={700}
          delay={revealDelay(scene, theme)}
          stagger={theme.motion.staggerBase * 30}
        />
        <div style={{ height: 40 }} />
        {scene.narration.includes('. ') ? (
          <BodyText
            text={scene.narration.split(/(?<=[.!?])\s/).slice(1).join(' ').slice(0, 130)}
            color={palette.inkSoft}
            fontFamily={type.bodyFamily}
            fontSize={typeScale('body', theme) * 0.86}
            delay={revealDelay(scene, theme) + 26}
          />
        ) : null}
      </div>
      <ShapeLine x={90} y={height * 0.30 - 220} length={220} angle={0} stroke={palette.accent} strokeWidth={5} opacity={0.8} drawProgress={ease('expoOut', (frame - 4) / 14)} />
    </LayoutShell>
  );
}

function CounterFocus({ scene, theme, direction }) {
  const { palette } = theme;
  const type = theme.type;
  const frame = useCurrentFrame();
  const { height, width } = useVideoConfig();
  const c = scene.counter || { value: 100, label: scene.heading, prefix: '', suffix: '', decimals: 0 };
  const fill = ease('expoOut', (frame - 10) / 44);
  return (
    <LayoutShell theme={theme} particles={direction.particles} seed={scene.seed}>
      <div style={{ position: 'absolute', left: '50%', top: height * 0.40, transform: 'translate(-50%,-50%)' }}>
        <ShapeTickArc color={palette.inkSoft} accent={palette.accent} x={0} y={0} r={330} progress={fill} />
        <ShapeRing x={0} y={0} r={268} stroke={palette.accent2} strokeWidth={2} opacity={0.25} progress={1} rotate={frame * 0.5} dash />
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: height * 0.16 }}>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <Kicker text={scene.heading.slice(0, 30)} color={palette.inkSoft} accent={palette.accent} fontFamily={type.bodyFamily} delay={2} />
        </div>
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: height * 0.40, transform: 'translateY(-50%)' }}>
        <AnimatedCounter
          value={c.value}
          prefix={c.prefix}
          suffix={c.suffix}
          decimals={c.decimals || 0}
          fontFamily={type.numericFamily}
          fontSize={typeScale('counter', theme) * 0.8}
          color={palette.ink}
          accent={palette.accent}
          label={c.label}
          labelColor={palette.inkSoft}
          labelFontFamily={type.bodyFamily}
          delay={8}
          duration={Math.min(50, (scene.durationSeconds * 30 * 0.6) | 0 || 40)}
        />
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: height * 0.62 }}>
        <BodyText
          text={scene.narration.slice(0, 130)}
          color={palette.inkSoft}
          fontFamily={type.bodyFamily}
          fontSize={typeScale('body', theme) * 0.8}
          delay={20}
        />
      </div>
      <ShapeLine x={width / 2 - 120} y={height * 0.78} length={240} angle={0} stroke={palette.accent} strokeWidth={4} opacity={0.7} drawProgress={ease('expoOut', (frame - 18) / 16)} />
    </LayoutShell>
  );
}

function DataViz({ scene, theme, direction }) {
  const { palette } = theme;
  const type = theme.type;
  const frame = useCurrentFrame();
  const { height, width } = useVideoConfig();
  const viz = scene.viz || { type: 'bars', values: [40, 70, 55], labels: [] };
  return (
    <LayoutShell theme={theme} particles={direction.particles} seed={scene.seed}>
      <div style={{ position: 'absolute', left: 90, right: 90, top: height * 0.13 }}>
        <Kicker text={scene.heading.slice(0, 30)} color={palette.inkSoft} accent={palette.accent} fontFamily={type.bodyFamily} delay={2} />
        <div style={{ height: 24 }} />
        <KineticTitle
          text={scene.emphasis[0] ? scene.emphasis[0].toUpperCase() : scene.heading}
          mode="wordPop"
          fontFamily={type.family}
          fontSize={typeScale('headline', theme)}
          color={palette.ink}
          accent={palette.accent}
          accentWords={scene.emphasis.slice(0, 1)}
          caseTransform={type.transform}
          delay={revealDelay(scene, theme)}
          stagger={theme.motion.staggerBase * 30}
        />
      </div>
      <div style={{ position: 'absolute', left: '50%', top: height * 0.56, transform: 'translate(-50%,-50%)', display: 'flex', justifyContent: 'center' }}>
        {viz.type === 'bars' ? (
          <BarChart
            values={viz.values || [42, 68, 84]}
            labels={viz.labels || []}
            color={palette.accent2}
            accent={palette.accent}
            track={palette.dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)'}
            fontFamily={type.numericFamily}
            labelColor={palette.inkSoft}
            delay={10}
          />
        ) : viz.type === 'line' ? (
          <LineChart
            values={viz.values || [20, 45, 38, 70, 88]}
            color={palette.accent2}
            accent={palette.accent}
            fontFamily={type.numericFamily}
            labelColor={palette.inkSoft}
            delay={10}
          />
        ) : (
          <DonutChart
            value={parseFloat(String(viz.value || 60).replace(/[^\d.]/g, '')) || 60}
            color={palette.accent}
            accent={palette.ink}
            track={palette.dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)'}
            fontFamily={type.numericFamily}
            centerLabel={scene.heading.slice(0, 16)}
            centerLabelColor={palette.inkSoft}
            centerLabelFontFamily={type.bodyFamily}
            delay={10}
          />
        )}
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: height * 0.78 }}>
        <BodyText text={scene.narration.slice(0, 110)} color={palette.inkSoft} fontFamily={type.bodyFamily} fontSize={typeScale('caption', theme) * 1.05} delay={24} />
      </div>
    </LayoutShell>
  );
}

function SplitCompare({ scene, theme, direction }) {
  const { palette } = theme;
  const type = theme.type;
  const frame = useCurrentFrame();
  const { height, width } = useVideoConfig();
  const cmp = scene.compare || { left: { label: 'THIS' }, right: { label: 'THAT' } };
  const slideL = ease('expoOut', (frame - 6) / 20);
  const slideR = ease('expoOut', (frame - 14) / 20);
  const vsPop = ease('backOut', (frame - 26) / 14);
  return (
    <LayoutShell theme={theme} particles={direction.particles} seed={scene.seed}>
      <div style={{
        position: 'absolute', left: 0, top: 0, width: width / 2, height,
        background: `${palette.accent}14`,
        transform: `translateX(${-width / 2 * (1 - slideL)}px)`,
      }} />
      <div style={{
        position: 'absolute', right: 0, top: 0, width: width / 2, height,
        background: `${palette.accent2}14`,
        transform: `translateX(${width / 2 * (1 - slideR)}px)`,
      }} />
      <ShapeLine x={width / 2 - 1.5} y={height * 0.16} length={height * 0.62} angle={90} stroke={palette.inkSoft} strokeWidth={3} opacity={0.5} drawProgress={ease('quartOut', (frame - 10) / 22)} />
      <div style={{ position: 'absolute', left: 0, top: height * 0.13, width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <Kicker text={scene.heading.slice(0, 28)} color={palette.inkSoft} accent={palette.accent} fontFamily={type.bodyFamily} delay={2} />
        </div>
      </div>
      <div style={{ position: 'absolute', left: 40, top: height * 0.42, width: width / 2 - 80, transform: `translateY(${(1 - slideL) * 60}px)`, opacity: slideL, textAlign: 'center' }}>
        <ShapePolygon x={100} y={-70} r={44} sides={3} stroke={palette.accent} strokeWidth={5} opacity={0.9} />
        <div style={{ fontFamily: type.family, fontSize: typeScale('headline', theme) * 0.6, color: palette.accent, fontWeight: 700, textTransform: type.transform, letterSpacing: type.tracking }}>{cmp.left.label}</div>
        {cmp.left.value ? <div style={{ fontFamily: type.numericFamily, fontSize: typeScale('counter', theme) * 0.42, color: palette.ink, marginTop: 12, fontWeight: 700 }}>{cmp.left.value}</div> : null}
      </div>
      <div style={{ position: 'absolute', right: 40, top: height * 0.42, width: width / 2 - 80, transform: `translateY(${(1 - slideR) * 60}px)`, opacity: slideR, textAlign: 'center' }}>
        <ShapePolygon x={100} y={-70} r={44} sides={4} stroke={palette.accent2} strokeWidth={5} opacity={0.9} rotate={45} />
        <div style={{ fontFamily: type.family, fontSize: typeScale('headline', theme) * 0.6, color: palette.accent2, fontWeight: 700, textTransform: type.transform, letterSpacing: type.tracking }}>{cmp.right.label}</div>
        {cmp.right.value ? <div style={{ fontFamily: type.numericFamily, fontSize: typeScale('counter', theme) * 0.42, color: palette.ink, marginTop: 12, fontWeight: 700 }}>{cmp.right.value}</div> : null}
      </div>
      <div style={{
        position: 'absolute', left: '50%', top: height * 0.46, transform: `translate(-50%,-50%) scale(${vsPop})`,
        width: 128, height: 128, borderRadius: '50%', background: palette.ink, color: palette.bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: type.family, fontSize: 52, fontWeight: 700,
        boxShadow: `0 0 60px ${palette.accent}66`,
        opacity: vsPop,
      }}>VS</div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: height * 0.76 }}>
        <BodyText text={scene.narration.slice(0, 120)} color={palette.inkSoft} fontFamily={type.bodyFamily} fontSize={typeScale('caption', theme) * 1.05} delay={34} />
      </div>
    </LayoutShell>
  );
}

function FlowSteps({ scene, theme, direction, vertical = true }) {
  const { palette } = theme;
  const type = theme.type;
  const frame = useCurrentFrame();
  const { height, width } = useVideoConfig();
  const steps = scene.steps || [{ label: scene.heading, step: 1 }];
  const perStep = Math.max(26, (scene.durationSeconds * 30 - 40) / Math.max(1, steps.length));
  return (
    <LayoutShell theme={theme} particles={direction.particles} seed={scene.seed}>
      <div style={{ position: 'absolute', left: 0, top: height * 0.12, width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <Kicker text={scene.heading.slice(0, 28)} color={palette.inkSoft} accent={palette.accent} fontFamily={type.bodyFamily} delay={2} />
        </div>
      </div>
      <div style={{ position: 'absolute', left: width * 0.14, top: height * 0.30, width: width * 0.72 }}>
        {steps.map((step, i) => {
          const appear = ease('expoOut', (frame - 12 - i * perStep) / 16);
          const activePulse = 0.5 + 0.5 * Math.sin(frame * 0.09 - i * 1.1);
          return (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 34, marginBottom: steps.length > 3 ? 44 : 72,
              opacity: appear, transform: `translateX(${(1 - appear) * -70}px)`,
            }}>
              <div style={{
                width: 108, height: 108, borderRadius: '50%', flexShrink: 0,
                background: palette.accent, color: palette.dark ? palette.bg : '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: type.numericFamily, fontSize: 48, fontWeight: 700,
                boxShadow: `0 0 ${30 + activePulse * 26}px ${palette.accent}66`,
              }}>{step.step}</div>
              <div style={{ flex: 1 }}>
                <ShapeLine x={0} y={-28} length={140} angle={0} stroke={palette.accent2} strokeWidth={4} opacity={0.65} drawProgress={appear} />
                <div style={{ fontFamily: type.bodyFamily, fontSize: typeScale('body', theme) * 0.92, color: palette.ink, fontWeight: 600, lineHeight: 1.25 }}>{step.label}</div>
              </div>
            </div>
          );
        })}
      </div>
    </LayoutShell>
  );
}

function StaggerList({ scene, theme, direction }) {
  const { palette } = theme;
  const type = theme.type;
  const frame = useCurrentFrame();
  const { height, width } = useVideoConfig();
  const items = scene.items && scene.items.length >= 2 ? scene.items : [scene.heading, ...scene.emphasis].slice(0, 4);
  const perItem = Math.max(14, (scene.durationSeconds * 30 - 50) / Math.max(1, items.length));
  return (
    <LayoutShell theme={theme} particles={direction.particles} seed={scene.seed}>
      <div style={{ position: 'absolute', left: 90, right: 90, top: height * 0.12 }}>
        <Kicker text={scene.heading.slice(0, 30)} color={palette.inkSoft} accent={palette.accent} fontFamily={type.bodyFamily} delay={2} />
      </div>
      <div style={{ position: 'absolute', left: width * 0.12, right: width * 0.12, top: height * 0.30 }}>
        {items.map((item, i) => {
          const appear = ease('backOut', (frame - 12 - i * perItem) / 18);
          return (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 26, marginBottom: 40,
              opacity: appear,
              transform: `translateX(${(1 - appear) * (i % 2 ? 80 : -80)}px) scale(${0.92 + appear * 0.08})`,
            }}>
              <ShapeDot x={26} y={26} r={9} fill={i % 2 ? palette.accent2 : palette.accent} opacity={0.95} scale={appear} />
              <div style={{
                flex: 1, padding: '26px 34px', borderRadius: 22,
                background: palette.dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.045)',
                border: `1.5px solid ${palette.inkSoft}33`,
                fontFamily: type.bodyFamily, fontSize: typeScale('body', theme) * 0.88, color: palette.ink, fontWeight: 600,
              }}>{item}</div>
            </div>
          );
        })}
      </div>
    </LayoutShell>
  );
}

function QuestionReveal({ scene, theme, direction }) {
  const { palette } = theme;
  const type = theme.type;
  const frame = useCurrentFrame();
  const { height, width } = useVideoConfig();
  const question = scene.question || scene.narration.slice(0, 120);
  const answer = scene.answer || scene.emphasis[0] || '';
  const revealAt = Math.max(30, scene.durationSeconds * 30 * 0.55);
  const qP = ease('expoOut', (frame - 6) / 18);
  const aP = ease('backOut', (frame - revealAt) / 18);
  return (
    <LayoutShell theme={theme} particles={direction.particles} seed={scene.seed}>
      <div style={{ position: 'absolute', left: 70, top: height * 0.20, width: width - 140 }}>
        <ShapeBracket x={-30} y={-40} w={26} h={300} stroke={palette.accent} strokeWidth={7} opacity={0.85} progress={qP} />
        <div style={{ opacity: qP, transform: `translateX(${(1 - qP) * 40}px)` }}>
          <Kicker text="question" color={palette.inkSoft} accent={palette.accent} fontFamily={type.bodyFamily} delay={2} />
          <div style={{ height: 26 }} />
          <div style={{ fontFamily: type.family, fontSize: typeScale('headline', theme) * 0.86, color: palette.ink, fontWeight: 700, lineHeight: 1.14, textTransform: type.transform }}>{question}{question.endsWith('?') ? '' : '?'}</div>
        </div>
      </div>
      <div style={{
        position: 'absolute', left: '50%', top: height * 0.56, transform: `translate(-50%, ${50 - aP * 50}px) scale(${0.9 + aP * 0.1})`,
        opacity: aP,
        padding: '34px 64px', borderRadius: 26, background: palette.accent, color: palette.dark ? palette.bg : '#ffffff',
        fontFamily: type.family, fontSize: typeScale('title', theme) * 0.58, fontWeight: 700,
        letterSpacing: '0.06em', textTransform: 'uppercase',
        boxShadow: `0 0 90px ${palette.accent}55`,
        whiteSpace: 'nowrap',
      }}>{answer || 'keep going'}</div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: height * 0.72 }}>
        <BodyText text={scene.narration.slice(0, 110)} color={palette.inkSoft} fontFamily={type.bodyFamily} fontSize={typeScale('caption', theme) * 1.02} delay={revealAt + 10} />
      </div>
    </LayoutShell>
  );
}

function QuoteCard({ scene, theme, direction }) {
  const { palette } = theme;
  const type = theme.type;
  const frame = useCurrentFrame();
  const { height, width } = useVideoConfig();
  const p = ease('quintOut', (frame - 6) / 24);
  return (
    <LayoutShell theme={theme} particles={direction.particles} seed={scene.seed}>
      <ShapeFrame color={palette.inkSoft} opacity={0.5} inset={64} progress={p} strokeWidth={3} corner={10} />
      <div style={{ position: 'absolute', left: 120, right: 120, top: height * 0.30, opacity: p, transform: `translateY(${(1 - p) * 26}px)` }}>
        <div style={{ fontFamily: type.family, fontSize: 140, color: palette.accent, lineHeight: 0.6, marginBottom: 8 }}>“</div>
        <div style={{
          fontFamily: type.family, fontSize: typeScale('title', theme) * 0.52, color: palette.ink,
          lineHeight: 1.32, fontStyle: 'normal', fontWeight: 400,
        }}>{scene.quote || scene.narration}</div>
        <div style={{ marginTop: 44, display: 'flex', alignItems: 'center', gap: 20 }}>
          <ShapeLine x={0} y={8} length={90} angle={0} stroke={palette.accent} strokeWidth={4} opacity={0.9} drawProgress={p} />
          <div style={{ fontFamily: type.bodyFamily, fontSize: typeScale('caption', theme), color: palette.inkSoft, letterSpacing: '0.22em', textTransform: 'uppercase', opacity: p }}>{scene.heading.slice(0, 26)}</div>
        </div>
      </div>
    </LayoutShell>
  );
}

function DefinitionCard({ scene, theme, direction }) {
  const { palette } = theme;
  const type = theme.type;
  const frame = useCurrentFrame();
  const { height, width } = useVideoConfig();
  const d = scene.definition || { term: scene.heading, body: scene.narration };
  const termP = ease('expoOut', (frame - 6) / 18);
  const bodyP = ease('quintOut', (frame - 22) / 20);
  return (
    <LayoutShell theme={theme} particles={direction.particles} seed={scene.seed}>
      <div style={{ position: 'absolute', left: 110, right: 110, top: height * 0.26 }}>
        <div style={{ fontFamily: type.numericFamily, fontSize: typeScale('caption', theme), color: palette.accent, letterSpacing: '0.3em', textTransform: 'uppercase', opacity: termP }}>definition</div>
        <div style={{ height: 18 }} />
        <div style={{
          fontFamily: type.family, fontSize: typeScale('title', theme) * 0.8, color: palette.ink,
          fontWeight: 700, textTransform: type.transform, letterSpacing: type.tracking,
          opacity: termP, transform: `translateY(${(1 - termP) * 40}px)`,
        }}>{d.term}</div>
        <div style={{ height: 30 }} />
        <ShapeLine x={0} y={0} length={180} angle={0} stroke={palette.accent} strokeWidth={6} opacity={0.9} drawProgress={bodyP} />
        <div style={{ height: 30 }} />
        <div style={{ fontFamily: type.bodyFamily, fontSize: typeScale('body', theme) * 0.95, color: palette.inkSoft, lineHeight: 1.42, opacity: bodyP, transform: `translateY(${(1 - bodyP) * 24}px)` }}>{d.body}</div>
      </div>
      <ShapeBracket x={width - 150} y={height * 0.24} w={26} h={260} stroke={palette.accent2} strokeWidth={6} opacity={0.7} side="right" progress={termP} />
    </LayoutShell>
  );
}

function RadialBurst({ scene, theme, direction }) {
  const { palette } = theme;
  const type = theme.type;
  const frame = useCurrentFrame();
  const { height, width } = useVideoConfig();
  const word = scene.focusWord || scene.heading;
  const burstP = ease('expoOut', (frame - 4) / 26);
  const rays = 14;
  return (
    <LayoutShell theme={theme} particles={direction.particles} seed={scene.seed}>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ position: 'absolute', left: '50%', top: height * 0.44, transform: 'translate(-50%,-50%)' }}>
          <ShapeRing
            x={0} y={0} r={200 + i * 150 + frame * (2.2 + i * 1.4)}
            stroke={i % 2 ? palette.accent2 : palette.accent}
            strokeWidth={3 - i * 0.6}
            opacity={Math.max(0, 0.5 - i * 0.14 - frame * 0.008)}
            progress={1} dash
            rotate={frame * (0.6 + i)}
          />
        </div>
      ))}
      {Array.from({ length: rays }).map((_, i) => {
        const a = (i / rays) * 360;
        return (
          <div key={i} style={{
            position: 'absolute', left: '50%', top: height * 0.44,
            width: 6, height: 150 * burstP, borderRadius: 6,
            background: `linear-gradient(to top, ${palette.accent}, transparent)`,
            opacity: 0.4 * burstP,
            transformOrigin: '0 50%',
            transform: `rotate(${a}deg) translateX(${320 + frame * 3}px)`,
          }} />
        );
      })}
      <div style={{ position: 'absolute', left: 0, right: 0, top: height * 0.44, transform: 'translateY(-50%)', textAlign: 'center' }}>
        <div style={{
          display: 'inline-block',
          fontFamily: type.family, fontSize: typeScale('counter', theme) * 0.72, color: palette.ink,
          fontWeight: 700, textTransform: type.transform, letterSpacing: type.tracking,
          transform: `scale(${0.8 + burstP * 0.2})`,
          textShadow: `0 0 44px ${palette.accent}55`,
        }}>{word}</div>
        <div style={{ marginTop: 30 }}>
          <BodyText text={scene.narration.slice(0, 110)} color={palette.inkSoft} fontFamily={type.bodyFamily} fontSize={typeScale('caption', theme) * 1.05} delay={18} />
        </div>
      </div>
    </LayoutShell>
  );
}

function GridReveal({ scene, theme, direction }) {
  const { palette } = theme;
  const type = theme.type;
  const frame = useCurrentFrame();
  const { height, width } = useVideoConfig();
  const items = scene.items && scene.items.length >= 2 ? scene.items : [scene.heading, ...scene.emphasis].slice(0, 4);
  const cols = Math.min(2, items.length);
  const rows = Math.ceil(items.length / cols);
  const cellW = (width - 220) / cols;
  const cellH = 240;
  return (
    <LayoutShell theme={theme} particles={direction.particles} seed={scene.seed}>
      <div style={{ position: 'absolute', left: 110, right: 110, top: height * 0.14 }}>
        <Kicker text={scene.heading.slice(0, 28)} color={palette.inkSoft} accent={palette.accent} fontFamily={type.bodyFamily} delay={2} />
      </div>
      <div style={{ position: 'absolute', left: 110, top: height * 0.28, display: 'grid', gridTemplateColumns: `repeat(${cols}, ${cellW}px)`, gap: 26 }}>
        {items.map((item, i) => {
          const flip = ease('backOut', (frame - 10 - i * 9) / 16);
          return (
            <div key={i} style={{
              width: cellW - 26, height: cellH, borderRadius: 26,
              background: palette.dark ? 'rgba(255,255,255,0.055)' : 'rgba(0,0,0,0.05)',
              border: `1.5px solid ${palette.inkSoft}2e`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 30, textAlign: 'center',
              opacity: flip,
              transform: `perspective(900px) rotateX(${(1 - flip) * 72}deg) translateY(${(1 - flip) * 30}px)`,
              transformOrigin: 'top center',
              fontFamily: type.bodyFamily, fontSize: typeScale('body', theme) * 0.8, color: palette.ink, fontWeight: 600,
              boxShadow: flip > 0.9 ? `0 12px 40px ${palette.accent}18` : 'none',
            }}>{String(item).toUpperCase().slice(0, 44)}</div>
          );
        })}
      </div>
    </LayoutShell>
  );
}

function Spotlight({ scene, theme, direction }) {
  const { palette } = theme;
  const type = theme.type;
  const frame = useCurrentFrame();
  const { height, width } = useVideoConfig();
  const p = ease('quintOut', (frame - 6) / 26);
  const breathe = 1 + Math.sin(frame * 0.05) * 0.015;
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {/* darkness */}
      <div style={{ position: 'absolute', inset: 0, background: palette.bg }} />
      {/* light pool */}
      <div style={{
        position: 'absolute', left: '50%', top: height * 0.42, width: 900 * breathe, height: 900 * breathe,
        transform: 'translate(-50%,-50%)', borderRadius: '50%',
        background: `radial-gradient(circle, ${palette.glow}2e 0%, ${palette.glow}14 34%, transparent 66%)`,
        opacity: p,
      }} />
      <ParticleField kind="dust" count={26} colors={[palette.ink, palette.accent]} seed={scene.seed} opacity={0.7} />
      <div style={{ position: 'absolute', left: 100, right: 100, top: height * 0.40, textAlign: 'center' }}>
        <div style={{ opacity: p, transform: `scale(${0.94 + p * 0.06})` }}>
          <KineticTitle
            text={scene.narration.split(/(?<=[.!?])\s/)[0] || scene.heading}
            mode="maskWipe"
            fontFamily={type.family}
            fontSize={typeScale('headline', theme)}
            color={palette.ink}
            accent={palette.accent}
            accentWords={scene.emphasis}
            caseTransform={type.transform}
            delay={8}
            stagger={theme.motion.staggerBase * 30}
          />
        </div>
      </div>
      <ShapeLine x={width / 2 - 90} y={height * 0.60} length={180} angle={0} stroke={palette.accent} strokeWidth={4} opacity={0.8 * p} drawProgress={p} />
    </div>
  );
}

function TimelineTrack({ scene, theme, direction }) {
  const { palette } = theme;
  const type = theme.type;
  const frame = useCurrentFrame();
  const { height, width } = useVideoConfig();
  const steps = scene.steps || [{ label: scene.heading, step: 1 }, { label: scene.emphasis[0] || '', step: 2 }].filter(s => s.label);
  const trackP = ease('quartOut', (frame - 8) / 30);
  return (
    <LayoutShell theme={theme} particles={direction.particles} seed={scene.seed}>
      <div style={{ position: 'absolute', left: 0, top: height * 0.13, width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <Kicker text={scene.heading.slice(0, 28)} color={palette.inkSoft} accent={palette.accent} fontFamily={type.bodyFamily} delay={2} />
        </div>
      </div>
      <div style={{ position: 'absolute', left: width * 0.10, right: width * 0.10, top: height * 0.44 }}>
        <ShapeLine x={0} y={0} length={width * 0.80} angle={0} stroke={palette.inkSoft} strokeWidth={5} opacity={0.4} drawProgress={trackP} />
        <div style={{ position: 'relative' }}>
          {steps.map((step, i) => {
            const span = width * 0.80;
            const x = steps.length === 1 ? span / 2 : (i / (steps.length - 1)) * span;
            const pop = ease('backOut', (frame - 14 - i * 16) / 16);
            const verticalShift = i % 2 ? 120 : -170;
            const labelWidth = 236;
            const clampedX = Math.max(0, Math.min(x, span - labelWidth + 40));
            return (
              <div key={i} style={{ position: 'absolute', left: clampedX, top: 0, opacity: pop, transform: `translate(-16px, ${verticalShift + (1 - pop) * 40}px)` }}>
                <ShapeDot x={16} y={-verticalShift} r={16} fill={i % 2 ? palette.accent : palette.accent2} opacity={pop} scale={pop} />
                <div style={{ width: labelWidth }}>
                  <div style={{ fontFamily: type.numericFamily, fontSize: 40, color: palette.accent, fontWeight: 700, opacity: pop }}>{String(step.step).padStart(2, '0')}</div>
                  <div style={{ fontFamily: type.bodyFamily, fontSize: typeScale('caption', theme) * 1.1, color: palette.ink, fontWeight: 600, lineHeight: 1.3, overflowWrap: 'break-word' }}>{step.label}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </LayoutShell>
  );
}

function WaveFocus({ scene, theme, direction }) {
  const { palette } = theme;
  const type = theme.type;
  const frame = useCurrentFrame();
  const { height, width } = useVideoConfig();
  const p = ease('expoOut', (frame - 4) / 20);
  return (
    <LayoutShell theme={theme} particles={direction.particles} seed={scene.seed}>
      <ShapeWaveform color={palette.accent2} accent={palette.accent} opacity={0.5} bars={30} seed={scene.seed % 9} height={320} />
      <div style={{ position: 'absolute', left: 0, right: 0, top: height * 0.38, textAlign: 'center', opacity: p, transform: `translateY(${(1 - p) * 30}px)` }}>
        <Kicker text={scene.heading.slice(0, 26)} color={palette.inkSoft} accent={palette.accent} fontFamily={type.bodyFamily} delay={4} />
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 22 }}>
          <KineticTitle
            text={scene.focusWord || scene.heading}
            mode="wordPop"
            fontFamily={type.family}
            fontSize={typeScale('counter', theme) * 0.66}
            color={palette.ink}
            accent={palette.accent}
            accentWords={scene.emphasis}
            caseTransform={type.transform}
            delay={8}
            stagger={theme.motion.staggerBase * 30}
          />
        </div>
        <div style={{ marginTop: 26, display: 'flex', justifyContent: 'center' }}>
          <BodyText text={scene.narration.slice(0, 110)} color={palette.inkSoft} fontFamily={type.bodyFamily} fontSize={typeScale('caption', theme) * 1.05} delay={20} />
        </div>
      </div>
    </LayoutShell>
  );
}

const LAYOUT_COMPONENTS = {
  kineticHeadline: KineticHeadline,
  counterFocus: CounterFocus,
  dataViz: DataViz,
  splitCompare: SplitCompare,
  flowSteps: FlowSteps,
  staggerList: StaggerList,
  questionReveal: QuestionReveal,
  quoteCard: QuoteCard,
  definitionCard: DefinitionCard,
  radialBurst: RadialBurst,
  gridReveal: GridReveal,
  spotlight: Spotlight,
  timelineTrack: TimelineTrack,
  waveFocus: WaveFocus,
};

export function SceneLayout({ scene, direction }) {
  const theme = useMemo(() => themeOf(direction), [direction]);
  const Component = LAYOUT_COMPONENTS[scene.layout] || KineticHeadline;
  return <Component scene={scene} theme={theme} direction={direction} />;
}

export { LAYOUT_COMPONENTS };
