import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';

const clamp={extrapolateLeft:'clamp',extrapolateRight:'clamp'};
const ink='#173f68', red='#c94f55', blue='#287db4', gold='#d59a27';

function Hand({x,y}) {
 return <g transform={`translate(${x} ${y}) rotate(-22) scale(.58)`} pointerEvents="none">
  <path d="M0 8 L0 -34 Q0 -45 10 -45 Q20 -45 20 -34 L20 -2 L20 -52 Q20 -63 30 -63 Q40 -63 40 -52 L40 -2 L40 -38 Q40 -49 50 -49 Q60 -49 60 -38 L60 5 Q70 -9 78 -2 Q84 4 77 15 L59 48 Q51 63 33 63 L23 63 Q7 62 1 47 L-15 20 Q-21 9 -12 4 Q-4 0 0 8Z" fill="#f0bd91" stroke="#704c3b" strokeWidth="3"/>
  <path d="M-15 5 L-24 -9" stroke={gold} strokeWidth="7" strokeLinecap="round"/>
 </g>;
}

const PATHS={
 heart:[
  {d:'M500 570 C430 510 300 400 300 285 C300 185 420 145 500 250 C580 145 700 185 700 285 C700 400 570 510 500 570Z',color:red,width:12,from:[500,570],to:[700,285]},
  {d:'M440 220 C405 155 420 95 470 70',color:blue,width:20,from:[440,220],to:[470,70]},
  {d:'M555 220 C590 150 575 95 530 65',color:red,width:20,from:[555,220],to:[530,65]},
  {d:'M405 320 C450 290 480 310 500 350 C520 310 550 290 595 320',color:ink,width:7,from:[405,320],to:[595,320]},
  {d:'M500 250 C480 330 485 430 500 550',color:ink,width:8,from:[500,250],to:[500,550]}
 ],
 chambers:[
  {d:'M500 570 C430 510 300 400 300 285 C300 185 420 145 500 250 C580 145 700 185 700 285 C700 400 570 510 500 570Z',color:red,width:12,from:[500,570],to:[700,285]},
  {d:'M500 250 C480 330 485 430 500 550',color:ink,width:9,from:[500,250],to:[500,550]},
  {d:'M405 320 Q455 285 490 345 L480 450 Q430 470 370 405Z',color:blue,width:7,from:[405,320],to:[370,405]},
  {d:'M510 345 Q555 285 615 320 L630 405 Q570 470 520 450Z',color:red,width:7,from:[510,345],to:[630,405]},
  {d:'M370 405 Q430 470 480 450 L490 345',color:blue,width:6,from:[370,405],to:[490,345]},
  {d:'M520 345 L510 450 Q570 470 630 405',color:red,width:6,from:[520,345],to:[630,405]}
 ],
 flow:[
  {d:'M500 570 C430 510 300 400 300 285 C300 185 420 145 500 250 C580 145 700 185 700 285 C700 400 570 510 500 570Z',color:red,width:10,from:[500,570],to:[700,285]},
  {d:'M385 360 C340 300 350 235 410 215',color:blue,width:10,from:[385,360],to:[410,215],arrow:true},
  {d:'M410 215 C440 165 475 180 495 250',color:blue,width:10,from:[410,215],to:[495,250],arrow:true},
  {d:'M510 250 C535 180 590 165 630 215',color:red,width:10,from:[510,250],to:[630,215],arrow:true},
  {d:'M630 215 C690 235 700 300 650 360',color:red,width:10,from:[630,215],to:[650,360],arrow:true},
  {d:'M480 440 C440 490 405 485 380 440',color:blue,width:9,from:[480,440],to:[380,440],arrow:true}
 ]
};

const LABELS={
 heart:[{x:245,y:125,text:'THE HUMAN HEART',color:ink,size:30},{x:610,y:90,text:'Major blood vessels',color:blue,size:22}],
 chambers:[{x:175,y:355,text:'Right side',color:blue,size:25},{x:645,y:355,text:'Left side',color:red,size:25},{x:500,y:625,text:'Four chambers',color:ink,size:26}],
 flow:[{x:170,y:170,text:'To lungs',color:blue,size:24},{x:680,y:170,text:'To body',color:red,size:24},{x:500,y:650,text:'Blood moves in one direction',color:ink,size:24}]
};

export function HeartWhiteboardVisual({scene={}}) {
 const frame=useCurrentFrame(),{fps}=useVideoConfig();
 const type=scene.diagram||'heart',paths=PATHS[type]||PATHS.heart,labels=LABELS[type]||LABELS.heart;
 const total=Math.max(2,(scene.durationSeconds||8)*fps*.72),per=total/paths.length;
 let hand=null;
 const drawing=paths.map((p,i)=>{
  const start=i*per,progress=interpolate(frame,[start,start+per*.9],[0,1],clamp);
  const x=p.from[0]+(p.to[0]-p.from[0])*progress,y=p.from[1]+(p.to[1]-p.from[1])*progress;
  if(frame>=start&&frame<=start+per)hand={x,y};
  return <g key={i}>
   <path d={p.d} fill="none" stroke={p.color} strokeWidth={p.width} strokeLinecap="round" strokeLinejoin="round" pathLength="1000" strokeDasharray="1000" strokeDashoffset={1000*(1-progress)}/>
   {p.arrow&&progress>.94?<path d={`M${p.to[0]-12} ${p.to[1]-20} L${p.to[0]} ${p.to[1]} L${p.to[0]+20} ${p.to[1]-12}`} fill="none" stroke={p.color} strokeWidth="9" strokeLinecap="round"/>:null}
  </g>;
 });
 const labelOpacity=interpolate(frame,[total*.72,total*.9],[0,1],clamp);
 return <AbsoluteFill>
  <svg viewBox="0 0 1000 700" preserveAspectRatio="xMidYMid meet" style={{position:'absolute',inset:'16% 5% 21%',width:'90%',height:'63%',overflow:'visible'}}>
   {drawing}
   {labels.map((l,i)=><text key={i} x={l.x} y={l.y} fill={l.color} fontSize={l.size} fontWeight="800" opacity={labelOpacity}>{l.text}</text>)}
   {hand?<Hand x={hand.x} y={hand.y}/>:null}
  </svg>
 </AbsoluteFill>;
}
