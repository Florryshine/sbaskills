// src/render/Root.tsx — Remotion root: one composition whose dimensions are
// driven by inputProps (the timeline carries width/height/totalFrames), so a
// single bundle renders every aspect ratio and duration.

import React from 'react';
import { Composition, getInputProps } from 'remotion';
import { VLVideo } from './VLVideo';

const fallback = {
  script: { meta: { title: 'Visual Learning', hookHeadline: '', subtitle: '', style: 'cartoon' as const, accent: '#E63946' }, scenes: [] },
  timeline: { fps: 30, width: 1920, height: 1080, totalFrames: 60, scenes: [], narrationSpans: [], musicFile: null, watermark: '', subtitles: false, meta: { title: '', hookHeadline: '', subtitle: '', style: 'cartoon' as const, accent: '#E63946' } },
  images: {},
};

export const RenderRoot: React.FC = () => {
  const props = (getInputProps<Record<string, unknown>>() ?? (fallback as unknown as Record<string, unknown>)) as Record<string, unknown>;
  const timeline = (props.timeline ?? fallback.timeline) as typeof fallback.timeline;
  return (
    <Composition
      id="VLVideo"
      component={VLVideo as unknown as React.FC<Record<string, unknown>>}
      width={timeline.width}
      height={timeline.height}
      fps={timeline.fps}
      durationInFrames={Math.max(2, timeline.totalFrames)}
      defaultProps={props}
      calculateMetadata={({ props: p }) => {
        const tl = (p.timeline ?? fallback.timeline) as typeof fallback.timeline;
        return {
          width: tl.width,
          height: tl.height,
          fps: tl.fps,
          durationInFrames: Math.max(2, tl.totalFrames),
        };
      }}
    />
  );
};
