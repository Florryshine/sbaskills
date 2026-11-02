import React from 'react';
import { interpolate } from 'remotion';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' };

export function Growth({ progress = 0 }) {
  return <svg viewBox="0 0 900 650" width="100%" height="100%" role="img" aria-label="A rising progress chart">
    <path d="M120 540 H790" stroke="#a8c9b7" strokeWidth="8"/>
    {[130, 250, 370, 490, 610].map((x, i) => <rect key={x} x={x} y={520 - (i + 1) * 68} width="76" height={(i + 1) * 68} rx="12" fill={i === 4 ? '#f4c542' : '#42a68a'} opacity={interpolate(progress, [i * 0.12, i * 0.12 + 0.2], [0, 1], clamp)}/>)}
    <path d="M150 440 Q270 390 355 330 T560 215 T755 100" stroke="#fff" strokeWidth="20" fill="none" strokeLinecap="round" strokeDasharray="900" strokeDashoffset={interpolate(progress, [0.15, 0.85], [900, 0], clamp)}/>
    <path d="M700 100 L755 100 L745 155" stroke="#fff" strokeWidth="18" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <text x="450" y="610" textAnchor="middle" fontSize="43" fontWeight="900" fill="#eafff4">SMALL WINS. REAL PROGRESS.</text>
  </svg>;
}
