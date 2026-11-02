'use client';

import React from 'react';
import { AbsoluteFill, Img, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' };

function DrawingHand({ x, y, scale = 1, visible = true }) {
  return (
    <div style={{
      position: 'absolute', left: x, top: y,
      width: 78 * scale, height: 92 * scale,
      opacity: visible ? 1 : 0,
      transform: 'translate(-18%, -78%) rotate(-18deg)',
      transformOrigin: '20% 80%', zIndex: 8, pointerEvents: 'none',
      filter: 'drop-shadow(2px 4px 3px rgba(15, 23, 42, .22))',
    }}>
      <svg width="100%" height="100%" viewBox="0 0 94 112" aria-hidden="true">
        <path d="M28 48 L28 15 Q28 5 37 5 Q46 5 46 15 L46 45 L46 10 Q46 0 55 0 Q64 0 64 10 L64 47 L64 20 Q64 10 73 10 Q82 10 82 20 L82 56 Q89 43 96 49 Q102 54 97 64 L82 91 Q74 107 55 107 L39 107 Q23 106 17 92 L5 69 Q0 59 8 55 Q16 51 22 61 L28 72 Z" fill="#b97853" stroke="#714632" strokeWidth="3" strokeLinejoin="round"/>
        <path d="M29 50 L29 70 M47 46 L47 66 M65 49 L65 67" stroke="#e5ad88" strokeWidth="3" strokeLinecap="round"/>
        <path d="M8 57 L-1 39" stroke="#f4c542" strokeWidth="7" strokeLinecap="round"/>
      </svg>
    </div>
  );
}

export function ImageRevealVisual({ scene, brand = 'SHINEY BRAIN ACADEMY', accent = '#f4c542', index = 0 }) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const duration = Math.max(1, (Number(scene.durationSeconds) || 10) * fps);
  const revealFrames = Math.max(18, Math.min(duration * 0.62, fps * 4.5));
  const progress = interpolate(frame, [3, revealFrames], [0, 1], clamp);
  const imageTop = height * 0.285;
  const imageLeft = width * 0.075;
  const imageWidth = width * 0.85;
  const imageHeight = height * 0.455;
  const sweep = Math.min(1, progress);
  const handX = imageLeft + imageWidth * sweep;
  const handY = imageTop + imageHeight * (0.18 + 0.66 * (0.5 - 0.5 * Math.cos(sweep * Math.PI * 2)));
  const revealPercent = 100 * (1 - sweep);
  const titleSize = Math.max(25, Math.min(width * 0.047, height * 0.031));
  const narrationSize = Math.max(17, Math.min(width * 0.031, height * 0.021));
  const terms = Array.isArray(scene.highlightTerms) ? scene.highlightTerms.slice(0, 4) : [];
  const scribblePath = `M ${imageLeft} ${imageTop + imageHeight * .18} Q ${imageLeft + imageWidth * .22} ${imageTop + imageHeight * .02} ${imageLeft + imageWidth * .38} ${imageTop + imageHeight * .2} T ${imageLeft + imageWidth * .72} ${imageTop + imageHeight * .18} T ${imageLeft + imageWidth} ${imageTop + imageHeight * .2} M ${imageLeft + imageWidth} ${imageTop + imageHeight * .5} Q ${imageLeft + imageWidth * .75} ${imageTop + imageHeight * .35} ${imageLeft + imageWidth * .55} ${imageTop + imageHeight * .53} T ${imageLeft} ${imageTop + imageHeight * .5} M ${imageLeft} ${imageTop + imageHeight * .82} Q ${imageLeft + imageWidth * .25} ${imageTop + imageHeight * .68} ${imageLeft + imageWidth * .48} ${imageTop + imageHeight * .84} T ${imageLeft + imageWidth} ${imageTop + imageHeight * .82}`;

  return (
    <AbsoluteFill style={{ background: '#fffef8', color: '#142c4b', fontFamily: 'Arial, sans-serif', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: '3.5%', left: '7%', right: '7%', fontSize: Math.max(14, width * .022), fontWeight: 900, color: '#1769aa', letterSpacing: 1.5 }}>
        {String(brand || 'SHINEY BRAIN ACADEMY').toUpperCase()}
      </div>
      <div style={{ position: 'absolute', top: '10%', left: '7%', right: '7%', maxHeight: '14%', overflow: 'hidden', fontSize: titleSize, lineHeight: 1.08, fontWeight: 900 }}>
        {scene.heading || 'Let’s understand this'}
      </div>

      {scene.image?.url ? (
        <>
          <div style={{
            position: 'absolute', left: imageLeft, top: imageTop, width: imageWidth, height: imageHeight,
            borderRadius: 16, overflow: 'hidden', background: '#eef3f7',
            border: '2px solid #d9e3eb', boxShadow: '0 8px 24px rgba(20,44,75,.10)',
            clipPath: scene.reveal === 'wipe'
              ? `inset(0 ${revealPercent}% 0 0 round 16px)`
              : `inset(0 ${revealPercent}% 0 0 round 16px)`,
          }}>
            <Img src={scene.image.url} alt={scene.heading || 'Lesson visual'} style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', filter: scene.imageGrayscale === false ? 'none' : 'grayscale(1)' }} />
          </div>
          {scene.reveal !== 'wipe' && (
            <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible' }}>
              <path d={scribblePath} fill="none" stroke={accent || '#f4c542'} strokeWidth={Math.max(5, width * .005)} strokeLinecap="round" strokeLinejoin="round" pathLength="1" strokeDasharray="1" strokeDashoffset={1 - sweep} opacity=".95" />
            </svg>
          )}
          <DrawingHand x={handX} y={handY} scale={Math.max(.55, Math.min(1, width / 1080))} visible={progress < 1} />
          <div style={{ position: 'absolute', left: '8%', right: '8%', top: '76%', minHeight: '3%', display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            {terms.map((term, i) => (
              <span key={i} style={{ opacity: interpolate(frame, [revealFrames * (.55 + i * .07), revealFrames * (.72 + i * .07)], [0, 1], clamp), background: '#fff4c7', border: '1px solid #e8c65b', color: '#684d08', borderRadius: 999, padding: '5px 11px', fontSize: Math.max(12, width * .018), fontWeight: 800 }}>{term}</span>
            ))}
          </div>
        </>
      ) : (
        <div style={{ position: 'absolute', top: '34%', left: '10%', right: '10%', padding: 24, border: '3px dashed #c14e45', borderRadius: 18, color: '#9b3028', fontSize: Math.max(18, width * .026), fontWeight: 800, textAlign: 'center' }}>
          No image selected. Choose or upload a visual for this scene before exporting.
        </div>
      )}

      <div style={{ position: 'absolute', left: '8%', right: '8%', bottom: '10%', maxHeight: '14%', overflow: 'hidden', fontSize: narrationSize, lineHeight: 1.3, fontWeight: 650, color: '#203b5d' }}>
        {scene.narration || scene.text || ''}
      </div>
      <div style={{ position: 'absolute', bottom: '3.5%', left: '8%', fontSize: Math.max(12, width * .016), color: '#718096', fontWeight: 800 }}>
        SHINEY BRAIN • {String(index + 1).padStart(2, '0')}
      </div>
    </AbsoluteFill>
  );
}
