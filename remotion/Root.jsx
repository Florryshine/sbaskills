import React from 'react';
import {Composition} from 'remotion';
import {LessonVideo} from './LessonVideo';
import {WhiteboardVideo} from './WhiteboardVideo';
import {CartoonVideo, totalDuration} from '../cartoon/engine/CartoonVideo';

const FPS = 30;
const calculateMetadata = ({props}) => {
  const segments = props.segments || [];
  const totalSeconds = segments.reduce((sum, segment) => sum + (segment.durationSeconds || 3), 0) + 0.5;
  const vertical = props.orientation !== 'horizontal';
  return {
    durationInFrames: Math.max(FPS * 2, Math.round(totalSeconds * FPS)),
    fps: FPS,
    width: vertical ? 1080 : 1920,
    height: vertical ? 1920 : 1080,
  };
};

const cartoonDefaults = {
  orientation: '9:16',
  subtitles: true,
  brandLine: 'Shiney Brain Academy',
  narration: {},
  spec: {
    title: 'Cartoon lesson preview',
    description: '',
    caption: '',
    hashtags: [],
    music: 'none',
    characters: [{ref: 'a', name: 'Tobi', presetKey: 'tobi'}],
    scenes: [{
      id: 's1',
      heading: 'Welcome',
      narration: 'Welcome to this lesson.',
      visualConcept: 'classroom',
      layout: 'focus-center',
      cast: [{ref: 'a', action: 'wave', expression: 'happy', x: 500, y: 812, scale: 1, speaking: false}],
      props: [],
      camera: 'none',
      transition: 'fade',
    }],
  },
};

const calculateCartoonMetadata = ({props}) => {
  const seconds = totalDuration(props);
  const orientation = props.orientation || '9:16';
  const dimensions = orientation === '16:9'
    ? {width: 1920, height: 1080}
    : orientation === '1:1'
      ? {width: 1080, height: 1080}
      : {width: 1080, height: 1920};
  return {
    ...dimensions,
    fps: FPS,
    durationInFrames: Math.max(FPS * 2, Math.ceil(seconds * FPS)),
  };
};

export const Root = () => (
  <>
    <Composition
      id="LessonVideo"
      component={LessonVideo}
      durationInFrames={150}
      fps={FPS}
      width={1080}
      height={1920}
      calculateMetadata={calculateMetadata}
      defaultProps={{title: 'Untitled Lesson', orientation: 'vertical', segments: []}}
    />
    <Composition
      id="WhiteboardVideo"
      component={WhiteboardVideo}
      durationInFrames={150}
      fps={FPS}
      width={1080}
      height={1920}
      calculateMetadata={calculateMetadata}
      defaultProps={{title: 'Whiteboard Lesson', orientation: 'vertical', segments: []}}
    />
    <Composition
      id="CartoonVideo"
      component={CartoonVideo}
      durationInFrames={150}
      fps={FPS}
      width={1080}
      height={1920}
      calculateMetadata={calculateCartoonMetadata}
      defaultProps={cartoonDefaults}
    />
  </>
);
