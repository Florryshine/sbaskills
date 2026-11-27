import React from 'react';
import {Composition} from 'remotion';
import {LessonVideo} from './LessonVideo';
import {WhiteboardVideo} from './WhiteboardVideo';
import {StudioComposition} from './StudioComposition';
const FPS=30;
const calculateTegakiMetadata=({props})=>{const scenes=props.scenes||[];const totalSeconds=scenes.reduce((sum,scene)=>sum+(Number(scene.durationSeconds)||5),0);const ratio=props.aspectRatio||'9:16';const dimensions=ratio==='16:9'?{width:1920,height:1080}:ratio==='1:1'?{width:1080,height:1080}:{width:1080,height:1920};return {durationInFrames:Math.max(FPS*2,Math.round(totalSeconds*FPS)),fps:FPS,...dimensions};};
const calculateMetadata=({props})=>{const segments=props.segments||[];const totalSeconds=segments.reduce((sum,s)=>sum+(s.durationSeconds||3),0)+0.5;const vertical=props.orientation!=='horizontal';return {durationInFrames:Math.max(FPS*2,Math.round(totalSeconds*FPS)),fps:FPS,width:vertical?1080:1920,height:vertical?1920:1080};};
export const Root=()=> <>
  <Composition id="TegakiVideo" component={StudioComposition} durationInFrames={1200} fps={FPS} width={1080} height={1920} calculateMetadata={calculateTegakiMetadata} defaultProps={{title:'Tegaki Lesson',scenes:[],template:'tegaki',brand:'SHINEY BRAIN ACADEMY',accent:'#f4c542',narrationVolume:1,musicSrc:null,musicVolume:0.12,aspectRatio:'9:16'}}/><Composition id="LessonVideo" component={LessonVideo} durationInFrames={150} fps={FPS} width={1080} height={1920} calculateMetadata={calculateMetadata} defaultProps={{title:'Untitled Lesson',orientation:'vertical',segments:[]}}/><Composition id="WhiteboardVideo" component={WhiteboardVideo} durationInFrames={150} fps={FPS} width={1080} height={1920} calculateMetadata={calculateMetadata} defaultProps={{title:'Whiteboard Lesson',orientation:'vertical',segments:[]}}/></>;
