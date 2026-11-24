import React from 'react';
import {Composition} from 'remotion';
import {LessonVideo} from './LessonVideo';
import {WhiteboardVideo} from './WhiteboardVideo';
import {CartoonVideo, totalDuration} from '../cartoon/engine/CartoonVideo';
import {MotionGraphicsVideo} from './motion/MotionGraphicsVideo';
import {ImageExplainerVideo} from './ImageExplainerVideo';

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

// Dynamic Motion Graphics Engine: duration + dimensions follow the scene
// plan, so one composition serves every orientation and length.
const motionDefaults = {
  orientation: '9:16',
  subtitles: true,
  brandLine: 'Shiney Brain Academy',
  audio: {},
  spec: {
    direction: {
      palette: {bg: '#0B0F1A', bgAlt: '#141B2E', ink: '#EEF2FA', inkSoft: '#8B95AC', accent: '#6366F1', accent2: '#22D3EE', glow: '#6366F1', dark: true},
      typography: {display: 'Archivo Black', body: 'Poppins', displayCase: 'upper', tracking: 0.01, numericMono: false},
      shapes: ['rings'], particles: 'dust',
      light: {beams: 0.35, flashOnCut: 0.25, grain: 0.08, vignette: 0.4, scanlines: false},
      motion: {personality: 'smooth', energy: 0.6, staggerBase: 0.055, holdBias: 0.5, ease: 'expoOut'},
      intensity: 'balanced', cutSpeed: 1,
      transitions: ['push', 'wipe', 'scaleCut'], camera: ['pushIn', 'drift'],
      sfxKit: ['impact', 'whoosh'], musicKit: 'pulse',
    },
    scenes: [{
      id: 's1', index: 0, heading: 'PREVIEW',
      narration: 'Motion graphics preview',
      emphasis: [], numbers: [], layout: 'kineticHeadline',
      durationSeconds: 3, seed: 42, camera: 'pushIn',
      transition: {type: 'push', direction: 'left', duration: 0.5},
      sfx: [], shapes: ['lines'], accentWord: null, showSubtitle: true,
    }],
  },
};

const calculateMotionMetadata = ({props}) => {
  const scenes = props.spec?.scenes || [];
  const seconds = scenes.reduce((sum, scene) => sum + (scene.durationSeconds || 3), 0) + 0.5;
  const orientation = props.orientation || '9:16';
  const dimensions = orientation === '16:9'
    ? {width: 1920, height: 1080}
    : orientation === '1:1'
      ? {width: 1080, height: 1080}
      : {width: 1080, height: 1920};
  return {
    ...dimensions,
    fps: 30,
    durationInFrames: Math.max(60, Math.ceil(seconds * 30)),
  };
};

const calculateImageExplainerMetadata = ({props}) => ({ width: props.aspect === '16:9' ? 1920 : 1080, height: props.aspect === '9:16' ? 1920 : 1080, fps: FPS, durationInFrames: Math.max(1, Number(props.durationInFrames) || 60) });

export const Root = () => (
  <>
    <Composition
      id="ImageExplainerVideo"
      component={ImageExplainerVideo}
      durationInFrames={60}
      fps={FPS}
      width={1920}
      height={1080}
      calculateMetadata={calculateImageExplainerMetadata}
      defaultProps={{aspect:"16:9",durationInFrames:60,sourceImage:"source/source.jpg",scenes:[],title:"Image explainer"}}
    />
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
    <Composition
      id="MotionGraphicsVideo"
      component={MotionGraphicsVideo}
      durationInFrames={90}
      fps={30}
      width={1080}
      height={1920}
      calculateMetadata={calculateMotionMetadata}
      defaultProps={motionDefaults}
    />
  </>
);
