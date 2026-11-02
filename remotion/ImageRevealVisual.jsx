'use client';
import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig, Audio } from 'remotion';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' };

function ScribbleReveal({ image, progress }) {
  const { width, height } = useVideoConfig();
  const w = width * 0.84, h = height * 0.47;
  const x = width * 0.08, y = height * 0.29;
  const revealed = Math.max(0, Math.min(100, progress * 100));
  const zig = `M ${x - 40} ${y + h * .12} Q ${x + w * .12} ${y - 15} ${x + w * .2} ${y + h * .22} T ${x + w * .4} ${y + h * .16} T ${x + w * .6} ${y + h * .25} T ${x + w * .8} ${y + h * .14} T ${x + w + 40} ${y + h * .2}
  M ${x + w + 40} ${y + h * .48} Q ${x + w * .8} ${y + h * .36} ${x + w * .7} ${y + h * .53} T ${x + w * .4} ${y + h * .49} T ${x - 40} ${y + h * .57}
  M ${x - 40} ${y + h * .82} Q ${x + w * .2} ${y + h * .72} ${x + w * .35} ${y + h * .85} T ${x + w * .7} ${y + h * .78} T ${x + w + 40} ${y + h * .88}`;
  return <g>
    <defs><clipPath id="imageRevealClip"><rect x={x} y={y} width={w * revealed / 100} height={h}/></clipPath></defs>
    <image href={image} x={x} y={y} width={w} height={h} preserveAspectRatio="xMidYMid meet" clipPath="url(#imageRevealClip)"/>
    <path d={zig} fill="none" stroke="#f4c542" strokeWidth={Math.max(8, width * .009)} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={w * 4} strokeDashoffset={w * 4 * (1 - progress)} opacity=".95"/>
  </g>;
}

export function ImageRevealVisual({ scene, brand, accent = '#f4c542', index = 0 }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const duration = Math.max(1, (scene.durationSeconds || 10) * fps);
  const revealFrames = Math.min(duration * .68, fps * 5);
  const progress = interpolate(frame, [4, revealFrames], [0, 1], clamp);
  const labelOpacity = interpolate(frame, [revealFrames * .65, revealFrames], [0, 1], clamp);
  return <AbsoluteFill style={{ background: '#fffef8', color: '#142c4b', fontFamily: 'Arial, sans-serif' }}>
    <div style={{ position: 'absolute', top: '4%', left: '7%', fontSize: 24, fontWeight: 900, color: '#1769aa', letterSpacing: 2 }}>{brand}</div>
    <div style={{ position: 'absolute', top: '12%', left: '7%', right: '7%', fontSize: 52, lineHeight: 1.08, fontWeight: 900 }}>{scene.heading}</div>
    {scene.image?.url ? <svg width="100%" height="100%" viewBox={`0 0 ${useVideoConfig().width} ${useVideoConfig().height}`} style={{ position: 'absolute', inset: 0 }}>
      <ScribbleReveal image={scene.image.url} progress={progress}/>
    </svg> : <div style={{ position: 'absolute', top: '35%', left: '10%', right: '10%', textAlign: 'center', padding: 30, border: '3px dashed #c14e45', borderRadius: 20, color: '#9b3028', fontSize: 28, fontWeight: 800 }}>No suitable image found for this scene. Choose another visual before export.</div>}
    <div style={{ position: 'absolute', left: '8%', right: '8%', bottom: '11%', fontSize: 30, lineHeight: 1.28, fontWeight: 650, opacity: .98 }}>{scene.narration}</div>
    <div style={{ position: 'absolute', bottom: '5%', left: '8%', fontSize: 18, color: '#718096', fontWeight: 800 }}>SHINEY BRAIN • {String(index + 1).padStart(2, '0')}</div>
    {scene.audioUrl ? <Audio src={scene.audioUrl}/> : null}
  </AbsoluteFill>;
}
