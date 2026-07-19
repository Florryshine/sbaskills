// remotion/Root.jsx
import React from 'react';
import { Composition } from 'remotion';
import { LessonVideo } from './LessonVideo';

const FPS = 30;

// worker.js doesn't know total duration up front (it depends on how long
// the narration for each segment turns out to be) — calculateMetadata lets
// Remotion derive durationInFrames/width/height from the actual inputProps
// at render time instead of a hardcoded guess.
const calculateMetadata = ({ props }) => {
  const segments = props.segments || [];
  const totalSeconds =
    segments.reduce((sum, s) => sum + (s.durationSeconds || 3), 0) + 0.5; // small outro pad
  const durationInFrames = Math.max(FPS * 2, Math.round(totalSeconds * FPS));
  const vertical = props.orientation !== 'horizontal';

  return {
    durationInFrames,
    fps: FPS,
    width: vertical ? 1080 : 1920,
    height: vertical ? 1920 : 1080,
  };
};

export const Root = () => {
  return (
    <Composition
      id="LessonVideo"
      component={LessonVideo}
      // Placeholder defaults — real values come from calculateMetadata once
      // worker.js passes real inputProps via selectComposition().
      durationInFrames={150}
      fps={FPS}
      width={1080}
      height={1920}
      calculateMetadata={calculateMetadata}
      defaultProps={{
        title: 'Untitled Lesson',
        orientation: 'vertical',
        segments: [],
      }}
    />
  );
};
