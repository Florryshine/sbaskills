'use client';

import React from 'react';
import { AbsoluteFill, Sequence } from 'remotion';
import { ImageRevealVisual } from './ImageRevealVisual';

export function StudioComposition({ title = 'Shiney Brain Video', scenes = [], template = 'whiteboard', brand = 'SHINEY BRAIN ACADEMY', accent = '#f4c542' }) {
  let from = 0;
  return <AbsoluteFill style={{ background: '#fffef8' }}>
    {scenes.map((scene, index) => {
      const duration = Math.max(60, Math.round((Number(scene.durationSeconds) || 8) * 30));
      const start = from;
      from += duration;
      return <Sequence key={scene.id || index} from={start} durationInFrames={duration}>
        <ImageRevealVisual scene={scene} brand={brand} accent={accent} index={index}/>
      </Sequence>;
    })}
  </AbsoluteFill>;
}
