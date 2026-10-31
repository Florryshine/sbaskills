'use client';
import React from 'react';
import { TegakiRenderer } from 'tegaki';
import caveat from 'tegaki/fonts/caveat';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' };

function measure(points) {
  let length = 0;
  const lengths = [0];
  for (let i = 1; i < points.length; i++) {
    length += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
    lengths.push(length);
  }
  return { length, lengths };
}

function pointAt(points, lengths, target) {
  for (let i = 1; i < points.length; i++) {
    if (lengths[i] >= target) {
      const span = lengths[i] - lengths[i - 1] || 1;
      const t = (target - lengths[i - 1]) / span;
      return [points[i - 1][0] + (points[i][0] - points[i - 1][0]) * t,
        points[i - 1][1] + (points[i][1] - points[i - 1][1]) * t];
    }
  }
  return points[points.length - 1];
}

function DrawingHand({ x, y }) {
  return <g transform={`translate(${x} ${y}) rotate(-24) scale(.72)`} pointerEvents="none">
    <path d="M0 8 L0 -34 Q0 -45 10 -45 Q20 -45 20 -34 L20 -2 L20 -52 Q20 -63 30 -63 Q40 -63 40 -52 L40 -2 L40 -38 Q40 -49 50 -49 Q60 -49 60 -38 L60 5 Q70 -9 78 -2 Q84 4 77 15 L59 48 Q51 63 33 63 L23 63 Q7 62 1 47 L-15 20 Q-21 9 -12 4 Q-4 0 0 8Z" fill="#f0bd91" stroke="#704c3b" strokeWidth="3" strokeLinejoin="round"/>
    <path d="M-15 5 L-24 -9" stroke="#d7a02b" strokeWidth="7" strokeLinecap="round"/>
  </g>;
}

export function DrawnVisual({ scene }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const strokes = scene?.strokes || [];
  const totalDuration = Math.max(2, scene?.durationSeconds || 8) * fps * .72;
  const perStroke = totalDuration / Math.max(1, strokes.length);
  let hand = null;
  let elapsed = 0;
  const measured = strokes.map(stroke => ({ ...stroke, ...measure(stroke.points || []) }));
  const rendered = measured.map((stroke, index) => {
    const start = index * perStroke;
    const local = interpolate(frame, [start, start + perStroke * .86], [0, 1], clamp);
    const visibleLength = stroke.length * local;
    const point = pointAt(stroke.points, stroke.lengths, visibleLength);
    if (frame >= start && frame <= start + perStroke) hand = point;
    elapsed += perStroke;
    return <g key={index}>
      <polyline points={stroke.points.map(p => p.join(',')).join(' ')} fill="none" stroke={stroke.color || '#173f68'} strokeWidth={stroke.width || 5} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={stroke.length} strokeDashoffset={stroke.length - visibleLength}/>
      {stroke.kind === 'arrow' && local >= .92 ? <path d={(() => { const pts=stroke.points; const a=pts[Math.max(0,pts.length-2)],b=pts[pts.length-1]; const angle=Math.atan2(b[1]-a[1],b[0]-a[0]); const size=22; const p1=[b[0]-size*Math.cos(angle-.48),b[1]-size*Math.sin(angle-.48)],p2=[b[0]-size*Math.cos(angle+.48),b[1]-size*Math.sin(angle+.48)]; return `M${p1.join(' ')} L${b.join(' ')} L${p2.join(' ')}`; })()} fill="none" stroke={stroke.color || '#173f68'} strokeWidth={stroke.width || 5} strokeLinecap="round"/> : null}
    </g>;
  });
  const labelStart = totalDuration * .72;
  const labelWindow = Math.max(10, (totalDuration * .26) / Math.max(1, (scene?.labels || []).length));
  return <AbsoluteFill>
    <svg viewBox="0 0 1000 700" preserveAspectRatio="xMidYMid meet" style={{ position: 'absolute', inset: '13% 5% 20%', width: '90%', height: '67%', overflow: 'visible' }}>
      {rendered}
      {(scene?.labels || []).map((label, index) => {
        const start = labelStart + index * labelWindow;
        const progress = interpolate(frame, [start, start + labelWindow * .82], [0, 1], clamp);
        return <foreignObject key={index} x={label.x} y={label.y - (label.size || 26)} width={420} height={76} style={{ overflow: 'visible' }}>
          <div xmlns="http://www.w3.org/1999/xhtml" style={{ display: 'inline-block', whiteSpace: 'nowrap', color: label.color || '#173f68', fontWeight: 700, fontSize: label.size || 26, lineHeight: 1.2 }}>
            <TegakiRenderer font={caveat} text={label.text} time={{ mode: 'controlled', value: progress, unit: 'progress' }} style={{ fontSize: label.size || 26, color: label.color || '#173f68' }} />
          </div>
        </foreignObject>;
      })}
      {hand ? <DrawingHand x={hand[0]} y={hand[1]}/> : null}
    </svg>
  </AbsoluteFill>;
}
