import React from 'react';
import { Composition, registerRoot } from 'remotion';
import { StickmanComposition } from './StickmanComposition';
import { Timeline } from '../rig/character';

const EMPTY_TIMELINE: Timeline = {
  version: '1.0', fps: 30, width: 720, height: 1280, durationFrames: 1, groundY: 0,
  camera: [{ cx: 0, cy: -160, scale: 1.8, rot: 0 }],
  shakeEvents: [], characters: [], props: [],
  environment: { type: 'abstract', seed: 1, accent: '#2285b7' },
  sceneSpans: [], overlays: [], captions: [], audio: [], transitions: [],
};

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="StickmanVideo"
      component={StickmanComposition}
      durationInFrames={30}
      fps={30}
      width={720}
      height={1280}
      defaultProps={{ timeline: EMPTY_TIMELINE }}
      calculateMetadata={({ props }: { props: { timeline: Timeline } }) => ({
        fps: props.timeline.fps,
        durationInFrames: props.timeline.durationFrames,
        width: props.timeline.width,
        height: props.timeline.height,
      })}
    />
  );
};

registerRoot(RemotionRoot);
