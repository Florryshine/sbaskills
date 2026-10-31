import React from 'react';
import {AbsoluteFill, Sequence, Audio, useCurrentFrame, useVideoConfig, interpolate, Easing} from 'remotion';

const BLUE = '#1769aa';
const INK = '#172b4d';

function Stroke({d, delay=0, color=INK, width=7}) {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [delay, delay+24], [0,1], {extrapolateLeft:'clamp', extrapolateRight:'clamp', easing:Easing.out(Easing.cubic)});
  return <path d={d} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="1000" strokeDashoffset={1000*(1-progress)}/>;
}
function BoardScene({scene, index, durationInFrames}) {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame,[0,8],[0,1],{extrapolateRight:'clamp'});
  const title = scene.visual_cue || scene.text;
  return <AbsoluteFill style={{background:'#fffef9',opacity,padding:'8% 7%',fontFamily:'Arial, sans-serif',color:INK}}>
    <div style={{position:'absolute',top:28,left:42,fontSize:24,fontWeight:800,color:BLUE}}>SHINEY BRAIN ACADEMY</div>
    <div style={{position:'absolute',top:92,left:52,right:52,fontSize:48,fontWeight:800,lineHeight:1.15}}>{title}</div>
    <svg viewBox="0 0 900 900" style={{position:'absolute',left:'8%',top:'28%',width:'84%',height:'55%'}}>
      {index===0 ? <>
        <Stroke d="M170 300 Q220 240 270 300 Q320 360 370 300" color={BLUE}/>
        <Stroke d="M450 300 L520 300" delay={10}/><Stroke d="M495 275 L520 300 L495 325" delay={16} color="#e5a900"/>
        <Stroke d="M590 300 Q640 240 690 300 Q740 360 790 300" color="#e5a900" delay={20}/>
        <text x="270" y="220" fontSize="58" textAnchor="middle" fill={INK}>Na</text>
        <text x="690" y="220" fontSize="58" textAnchor="middle" fill={INK}>Cl</text>
        <text x="450" y="390" fontSize="34" textAnchor="middle" fill={BLUE}>electron transfer</text>
      </> : index===1 ? <>
        <circle cx="270" cy="350" r="125" fill="none" stroke={BLUE} strokeWidth="8" strokeDasharray="10 12"/>
        <circle cx="630" cy="350" r="125" fill="none" stroke="#e5a900" strokeWidth="8" strokeDasharray="10 12"/>
        <text x="270" y="365" fontSize="66" textAnchor="middle" fill={INK}>Na⁺</text>
        <text x="630" y="365" fontSize="66" textAnchor="middle" fill={INK}>Cl⁻</text>
        <Stroke d="M405 350 L495 350" color="#e5a900"/><Stroke d="M475 325 L500 350 L475 375" color="#e5a900" delay={12}/>
      </> : <>
        <Stroke d="M150 300 Q450 80 750 300" color={BLUE}/>
        <Stroke d="M150 500 Q450 720 750 500" color="#e5a900" delay={10}/>
        <text x="450" y="405" fontSize="62" textAnchor="middle" fill={INK}>Opposite charges</text>
        <text x="450" y="475" fontSize="52" textAnchor="middle" fill={BLUE}>attract!</text>
      </>}
    </svg>
    <div style={{position:'absolute',bottom:80,left:65,right:65,fontSize:34,fontWeight:600,lineHeight:1.3,textAlign:'center'}}>{scene.text}</div>
    <div style={{position:'absolute',bottom:24,right:40,fontSize:20,color:'#64748b'}}>JAMB CHEMISTRY • {index+1}</div>
    {scene.audioSrc && <Audio src={scene.audioSrc}/>}
  </AbsoluteFill>;
}
export function WhiteboardVideo({title='Shiney Brain Whiteboard',segments=[]}) {
 const {fps}=useVideoConfig(); let cursor=0;
 return <AbsoluteFill style={{background:'#fffef9'}}>
  {segments.map((scene,i)=>{const durationInFrames=Math.max(45,Math.round((scene.durationSeconds||5)*fps));const from=cursor;cursor+=durationInFrames;return <Sequence key={i} from={from} durationInFrames={durationInFrames}><BoardScene scene={scene} index={i} durationInFrames={durationInFrames}/></Sequence>;})}
 </AbsoluteFill>;
}
