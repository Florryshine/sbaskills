// src/remotion/index.ts — Remotion root registration.

import React from 'react';
import { registerRoot, Composition } from 'remotion';
import type { Timeline } from '../types';
import { WhiteboardVideo } from './WhiteboardVideo';

const FPS = 30;
const WIDTH = 1920;
const HEIGHT = 1080;

const Root: React.FC = () => {
  return (
    <>
      <Composition
        id="WhiteboardVideo"
        component={WhiteboardVideo}
        width={WIDTH}
        height={HEIGHT}
        fps={FPS}
        durationInFrames={1}
        defaultProps={{
          timeline: { fps: FPS, width: WIDTH, height: HEIGHT, title: '', subject: 'general', theme: null as never, scenes: [], totalDuration: 0 } as unknown as Timeline,
        }}
        calculateMetadata={({ props }) => ({
          durationInFrames: Math.max(1, Math.ceil((props.timeline?.totalDuration ?? 1) * FPS)),
        })}
      />
    </>
  );
};

registerRoot(Root);
