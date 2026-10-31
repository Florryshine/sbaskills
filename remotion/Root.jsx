import React from 'react';
import {Composition} from 'remotion';
import {LessonVideo} from './LessonVideo';
import {WhiteboardVideo} from './WhiteboardVideo';
const FPS=30;
const calculateMetadata=({props})=>{const segments=props.segments||[];const totalSeconds=segments.reduce((sum,s)=>sum+(s.durationSeconds||3),0)+0.5;const vertical=props.orientation!=='horizontal';return {durationInFrames:Math.max(FPS*2,Math.round(totalSeconds*FPS)),fps:FPS,width:vertical?1080:1920,height:vertical?1920:1080};};
export const Root=()=> <><Composition id="LessonVideo" component={LessonVideo} durationInFrames={150} fps={FPS} width={1080} height={1920} calculateMetadata={calculateMetadata} defaultProps={{title:'Untitled Lesson',orientation:'vertical',segments:[]}}/><Composition id="WhiteboardVideo" component={WhiteboardVideo} durationInFrames={150} fps={FPS} width={1080} height={1920} calculateMetadata={calculateMetadata} defaultProps={{title:'Whiteboard Lesson',orientation:'vertical',segments:[]}}/></>;
