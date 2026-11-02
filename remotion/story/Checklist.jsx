import React from 'react';
import { interpolate } from 'remotion';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' };

export function Checklist({ progress = 0 }) {
  const items = ['ONE TOPIC', 'PRACTISE', 'TIME IT', 'REVIEW'];
  return <svg viewBox="0 0 900 650" width="100%" height="100%" role="img" aria-label="Four-step study checklist">
    {items.map((label, i) => {
      const y = 70 + i * 140;
      const opacity = interpolate(progress, [i * 0.13, i * 0.13 + 0.2], [0, 1], clamp);
      return <g key={label} opacity={opacity}>
        <rect x="170" y={y} width="560" height="105" rx="24" fill={i % 2 ? '#e8f1ff' : '#fff8e7'} stroke={i % 2 ? '#6b9bd1' : '#d9ae59'} strokeWidth="5"/>
        <circle cx="230" cy={y + 52} r="27" fill="#16856b"/>
        <path d={`M216 ${y + 52} l12 13 25 -29`} stroke="#fff" strokeWidth="8" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
        <text x="290" y={y + 67} fontSize="43" fontWeight="900" fill="#172b4d">{label}</text>
      </g>;
    })}
  </svg>;
}
