'use client';

import React from 'react';
import {AbsoluteFill, Sequence, Audio, useCurrentFrame, interpolate, Easing} from 'remotion';

const palette = {blue:'#1261a0', navy:'#102b4e', yellow:'#f4c542', ink:'#172b4d'};
const clamp = {extrapolateLeft:'clamp', extrapolateRight:'clamp'};
function AnimatedScene({scene,index,template,brand,accent}) {
  const frame=useCurrentFrame();
  const fade=interpolate(frame,[0,12],[0,1],clamp);
  const rise=interpolate(frame,[0,18],[38,0],{...clamp,easing:Easing.out(Easing.cubic)});
  const title=scene.heading||scene.visual_cue||'Key idea';
  const body=scene.text||'Add your explanation here.';
  const isBoard=template==='whiteboard';
  const isQuestion=template==='question';
  const bg=isBoard?'#fffef8':template==='story'?'#101b31':'#f5f8fc';
  const fg=template==='story'?'#fff':palette.navy;
  return <AbsoluteFill style={{background:bg,color:fg,fontFamily:'Arial, sans-serif',padding:'7%',opacity:fade}}>
    <div style={{position:'absolute',top:'4%',left:'7%',right:'7%',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
      <span style={{fontSize:22,fontWeight:900,letterSpacing:1,color:isBoard?palette.blue:accent}}>{brand.toUpperCase()}</span>
      <span style={{fontSize:15,fontWeight:700,opacity:.65}}>{String(index+1).padStart(2,'0')}</span>
    </div>
    <div style={{position:'absolute',top:'17%',left:'8%',right:'8%',transform:`translateY(${rise}px)`}}>
      <div style={{fontSize:isQuestion?22:19,fontWeight:800,color:isBoard?accent:palette.blue,marginBottom:22,letterSpacing:1}}>{isQuestion?'JAMB PRACTICE':template==='story'?'A STORY THAT MATTERS':'SHINEY BRAIN • LEARN SMARTER'}</div>
      <div style={{fontSize:isQuestion?48:52,fontWeight:900,lineHeight:1.08,whiteSpace:'pre-wrap'}}>{title}</div>
    </div>
    {isBoard ? <svg viewBox="0 0 900 460" style={{position:'absolute',left:'9%',top:'42%',width:'82%',height:'35%'}}>
      <path d={`M80 80 Q450 -10 820 80`} stroke={accent} strokeWidth="10" fill="none" strokeLinecap="round" strokeDasharray="1100" strokeDashoffset={interpolate(frame,[8,48],[1100,0],clamp)}/>
      <circle cx="450" cy="210" r={interpolate(frame,[8,40],[5,115],clamp)} fill="none" stroke={palette.blue} strokeWidth="9"/>
      <path d="M300 210 H600 M560 175 L600 210 L560 245" stroke={accent} strokeWidth="10" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
      <text x="450" y="360" textAnchor="middle" fontSize="38" fontWeight="bold" fill={fg}>{scene.diagramLabel||'Understand the concept'}</text>
    </svg> : <div style={{position:'absolute',left:'9%',right:'9%',top:'47%',fontSize:32,lineHeight:1.35,fontWeight:650,whiteSpace:'pre-wrap'}}>{body}</div>}
    {isQuestion&&scene.options?.length>0&&<div style={{position:'absolute',left:'9%',right:'9%',top:'68%',display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>{scene.options.map((o,i)=><div key={i} style={{border:`2px solid ${accent}`,borderRadius:16,padding:16,fontSize:23,fontWeight:700}}> {String.fromCharCode(65+i)}. {o}</div>)}</div>}
    {isBoard&&<div style={{position:'absolute',left:'9%',right:'9%',bottom:'12%',fontSize:27,lineHeight:1.25,textAlign:'center',fontWeight:650}}>{body}</div>}
    <div style={{position:'absolute',bottom:'4%',left:'7%',right:'7%',display:'flex',justifyContent:'space-between',fontSize:14,fontWeight:700,opacity:.65}}><span>{brand}</span><span>WHERE CHAMPIONS ARE MADE</span></div>
  </AbsoluteFill>;
}
export function StudioComposition({title='Shiney Brain Video',scenes=[],template='explainer',brand='SHINEY BRAIN ACADEMY',accent='#f4c542',audioSrc=null}) {
  let from=0;
  return <AbsoluteFill>{scenes.map((scene,index)=>{const duration=Math.max(60,Math.round((Number(scene.durationSeconds)||5)*30));const start=from;from+=duration;return <Sequence key={scene.id||index} from={start} durationInFrames={duration}><AnimatedScene scene={scene} index={index} template={template} brand={brand} accent={accent}/></Sequence>;})}{audioSrc ? <Audio src={audioSrc} volume={0.9}/> : null}</AbsoluteFill>;
}
