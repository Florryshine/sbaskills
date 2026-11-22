// Animated numbers + data visualization for the Motion Graphics Engine.

import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { ease } from '../easing.js';

export function AnimatedCounter({
  value, prefix = '', suffix = '', decimals = 0, fontFamily, fontSize = 170,
  color, accent, delay = 8, duration = 40, easeName = 'expoOut', label, labelColor, labelFontFamily, labelFontSize = 42,
}) {
  const frame = useCurrentFrame();
  const p = ease(easeName, (frame - delay) / duration);
  const current = value * p;
  const formatted = current.toLocaleString('en-US', {
    minimumFractionDigits: decimals, maximumFractionDigits: decimals,
  });
  const pop = ease('backOut', (frame - delay - duration * 0.72) / 12);
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{
        fontFamily, fontSize, color, fontWeight: 700, lineHeight: 1,
        fontVariantNumeric: 'tabular-nums',
        transform: `scale(${0.94 + pop * 0.06})`,
        textShadow: accent ? `0 0 ${fontSize * 0.18}px ${accent}44` : undefined,
      }}>
        {prefix}{formatted}{suffix}
      </div>
      {label ? (
        <div style={{
          fontFamily: labelFontFamily || fontFamily, fontSize: labelFontSize, color: labelColor,
          marginTop: fontSize * 0.1, letterSpacing: '0.14em', textTransform: 'uppercase',
          opacity: ease('quintOut', (frame - delay - 8) / 14), fontWeight: 700,
        }}>{label}</div>
      ) : null}
    </div>
  );
}

export function BarChart({ values, labels, color, accent, track, fontFamily, delay = 8, stagger = 5, labelColor, fontSize = 34, height = 420, width = 820 }) {
  const frame = useCurrentFrame();
  const max = Math.max(...values, 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 26, width, height }}>
      {values.map((v, i) => {
        const p = ease('expoOut', (frame - delay - i * stagger) / 18);
        const h = (v / max) * height;
        const isTop = v === max;
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div style={{
              fontFamily, fontSize, color: isTop ? accent : labelColor, opacity: p,
              fontWeight: 700,
            }}>{v.toLocaleString('en-US')}</div>
            <div style={{ width: '100%', height, display: 'flex', alignItems: 'flex-end', background: track, borderRadius: 14, overflow: 'hidden' }}>
              <div style={{
                width: '100%', height: h * p,
                background: isTop ? accent : color,
                borderRadius: 14,
              }} />
            </div>
            {labels?.[i] ? (
              <div style={{ fontFamily, fontSize: fontSize * 0.82, color: labelColor, opacity: 0.85, maxWidth: 150, textAlign: 'center' }}>{labels[i]}</div>
            ) : <div style={{ height: 20 }} />}
          </div>
        );
      })}
    </div>
  );
}

export function LineChart({ values, color, accent, fontFamily, delay = 8, labelColor, fontSize = 34, height = 380, width = 860 }) {
  const frame = useCurrentFrame();
  const max = Math.max(...values) * 1.12;
  const min = Math.min(...values) * 0.85;
  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width;
    const y = height - ((v - min) / Math.max(1, max - min)) * height;
    return [x, y];
  });
  const path = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x} ${y}`).join(' ');
  const totalLength = width * 1.25;
  const draw = ease('quartOut', (frame - delay) / 30);
  const popDots = points.map((_, i) => ease('backOut', (frame - delay - 8 - i * 6) / 12));
  return (
    <svg width={width} height={height + 30} style={{ overflow: 'visible' }}>
      <path d={path} fill="none" stroke={color} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round"
        strokeDasharray={totalLength} strokeDashoffset={totalLength * (1 - draw)} />
      {points.map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r={11} fill={accent} opacity={popDots[i]} />
          <circle cx={x} cy={y} r={20} fill="none" stroke={accent} strokeWidth={3} opacity={popDots[i] * 0.5} />
        </g>
      ))}
    </svg>
  );
}

export function DonutChart({ value, max = 100, color, accent, track, fontFamily, fontSize = 84, size = 380, delay = 8, strokeWidth = 34, centerLabel, centerLabelColor, centerLabelFontFamily }) {
  const frame = useCurrentFrame();
  const p = ease('expoOut', (frame - delay) / 34);
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const fraction = Math.max(0, Math.min(1, value / max)) * p;
  return (
    <svg width={size} height={size}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={strokeWidth} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={`${circumference * fraction} ${circumference}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text
        x="50%" y="52%" textAnchor="middle" dominantBaseline="middle"
        style={{ fontFamily, fontSize, fontWeight: 700, fill: accent }}
      >
        {Math.round(value * p).toLocaleString('en-US')}
      </text>
      {centerLabel ? (
        <text x="50%" y="70%" textAnchor="middle" style={{ fontFamily: centerLabelFontFamily || fontFamily, fontSize: fontSize * 0.26, fill: centerLabelColor, letterSpacing: '0.2em', textTransform: 'uppercase' }}>
          {centerLabel}
        </text>
      ) : null}
    </svg>
  );
}
