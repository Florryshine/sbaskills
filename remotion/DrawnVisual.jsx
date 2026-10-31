'use client';
import React from 'react';
import { TegakiRenderer } from 'tegaki';
import { WhiteboardIllustration } from './whiteboard/IllustrationLibrary';
import { SBAIllustration } from './whiteboard/SBAAssetLibrary';
import caveat from 'tegaki/fonts/caveat';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' };
function measure(points = []) {
  let length = 0; const lengths = [0];
  for (let i = 1; i < points.length; i++) { length += Math.hypot(points[i][0]-points[i-1][0], points[i][1]-points[i-1][1]); lengths.push(length); }
  return { length, lengths };
}
function pointAt(points, lengths, target) {
  if (!points.length) return [0,0];
  if (target <= 0) return points[0];
  for (let i=1;i<points.length;i++) if (lengths[i]>=target) {
    const span=lengths[i]-lengths[i-1]||1, t=(target-lengths[i-1])/span;
    return [points[i-1][0]+(points[i][0]-points[i-1][0])*t,points[i-1][1]+(points[i][1]-points[i-1][1])*t];
  }
  return points[points.length-1];
}
function DrawingHand({x,y}) {
 return <g transform={'translate('+x+' '+y+') rotate(-24) scale(.72)'} pointerEvents="none">
  <path d="M0 8 L0 -34 Q0 -45 10 -45 Q20 -45 20 -34 L20 -2 L20 -52 Q20 -63 30 -63 Q40 -63 40 -52 L40 -2 L40 -38 Q40 -49 50 -49 Q60 -49 60 -38 L60 5 Q70 -9 78 -2 Q84 4 77 15 L59 48 Q51 63 33 63 L23 63 Q7 62 1 47 L-15 20 Q-21 9 -12 4 Q-4 0 0 8Z" fill="#f0bd91" stroke="#704c3b" strokeWidth="3" strokeLinejoin="round"/>
  <path d="M-15 5 L-24 -9" stroke="#d7a02b" strokeWidth="7" strokeLinecap="round"/>
 </g>;
}
export function DrawnVisual({scene}) {
 const frame=useCurrentFrame(), {fps}=useVideoConfig();
 const strokes=Array.isArray(scene?.strokes)?scene.strokes.filter(s=>Array.isArray(s.points)&&s.points.length>1):[];
 const labels=Array.isArray(scene?.labels)?scene.labels:[];
 const drawFrames=Math.max(1,Math.round(Math.max(2,scene?.durationSeconds||8)*fps*.76));
 const totalLength=strokes.reduce((sum,s)=>sum+measure(s.points).length,0)||1;
 let hand=null,consumed=0;
 const rendered=strokes.map((stroke,index)=>{
  const m=measure(stroke.points), start=drawFrames*(consumed/totalLength), span=drawFrames*(m.length/totalLength);
  consumed+=m.length;
  const progress=interpolate(frame,[start,start+Math.max(1,span)],[0,1],clamp), visible=m.length*progress;
  const tip=pointAt(stroke.points,m.lengths,visible);
  if(frame>=start&&frame<=start+span+1) hand=tip;
  return <g key={index}>
   <polyline points={stroke.points.map(p=>p.join(',')).join(' ')} fill="none" stroke={stroke.color||'#173f68'} strokeWidth={stroke.width||5} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={Math.max(1,m.length)} strokeDashoffset={Math.max(0,m.length-visible)}/>
   {stroke.kind==='arrow'&&progress>=.96?(()=>{
    const pts=stroke.points,a=pts[Math.max(0,pts.length-2)],b=pts[pts.length-1],angle=Math.atan2(b[1]-a[1],b[0]-a[0]),size=22;
    const p1=[b[0]-size*Math.cos(angle-.48),b[1]-size*Math.sin(angle-.48)],p2=[b[0]-size*Math.cos(angle+.48),b[1]-size*Math.sin(angle+.48)];
    return <path d={'M'+p1.join(' ')+' L'+b.join(' ')+' L'+p2.join(' ')} fill="none" stroke={stroke.color||'#173f68'} strokeWidth={stroke.width||5} strokeLinecap="round"/>;
   })():null}
  </g>;
 });
 const labelFrames=Math.max(1,Math.round(drawFrames*.24));
 return <AbsoluteFill>
  <svg viewBox="0 0 1000 700" preserveAspectRatio="xMidYMid meet" style={{position:'absolute',left:'5%',top:'25%',width:'90%',height:'47%',overflow:'visible'}}>
   {scene.illustration ? <SBAIllustration type={scene.illustration} accent={scene.illustrationAccent || '#e1a82b'} /> : null}
   {rendered}{hand&&frame<drawFrames?<DrawingHand x={hand[0]} y={hand[1]}/>:null}
  </svg>
  <div style={{position:'absolute',left:'7%',right:'7%',top:'23%',height:'51%',pointerEvents:'none'}}>
   {labels.map((label,index)=>{
    const start=drawFrames+index*(labelFrames/Math.max(1,labels.length));
    const progress=interpolate(frame,[start,start+labelFrames/Math.max(1,labels.length)],[0,1],clamp);
    return <div key={index} style={{position:'absolute',left:Math.max(0,Math.min(96,(label.x||0)/10))+'%',top:Math.max(0,Math.min(92,(label.y||0)/7))+'%',maxWidth:'90%',whiteSpace:'nowrap'}}>
     <TegakiRenderer font={caveat} text={label.text||''} time={{mode:'controlled',value:progress,unit:'progress'}} style={{fontSize:(Math.max(16,Math.min(42,label.size||26))*1.5)+'px',fontWeight:700,color:label.color||'#173f68',lineHeight:1.1}}/>
    </div>;
   })}
  </div>
 </AbsoluteFill>;
}
