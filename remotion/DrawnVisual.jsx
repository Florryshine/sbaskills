'use client';
import React from 'react';
import { TegakiRenderer } from 'tegaki';
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
  // The pen nib is positioned at the SVG coordinate (x,y).
  return <g transform={`translate(${x} ${y})`} pointerEvents="none" filter="drop-shadow(2px 3px 2px #0003)">
    <path d="M0 0 L-10 -22 L-2 -28 L8 -7 Z" fill="#e0b33b" stroke="#765a21" strokeWidth="2"/>
    <path d="M-10 -22 L-2 -28 L-5 -34 L-14 -27 Z" fill="#27384a" stroke="#172b3d" strokeWidth="1.5"/>
    <path d="M-8 -24 L-4 -27" stroke="#fff0b0" strokeWidth="2"/>
    <path d="M8 -7 C15 -25 27 -43 42 -48 C55 -53 68 -45 72 -33 L80 -4 C84 10 75 25 61 30 L35 37 C21 40 9 32 6 19 L1 5 Z" fill="#8b563e" stroke="#593a2e" strokeWidth="3" strokeLinejoin="round"/>
    <path d="M13 3 C24 -8 33 -19 43 -29 C49 -35 58 -35 63 -29 C67 -23 63 -16 58 -11 L39 10" fill="none" stroke="#c98d6c" strokeWidth="8" strokeLinecap="round"/>
    <path d="M8 13 Q22 28 40 24" fill="none" stroke="#c98d6c" strokeWidth="5" strokeLinecap="round"/>
    <path d="M45 -39 Q55 -47 64 -38" fill="none" stroke="#e7b398" strokeWidth="3" strokeLinecap="round"/>
  </g>;
}
export function DrawnVisual({scene}) {
 const frame=useCurrentFrame(), {fps}=useVideoConfig();
 const strokes=Array.isArray(scene?.strokes)?scene.strokes.filter(s=>Array.isArray(s.points)&&s.points.length>1):[];
 const labels=Array.isArray(scene?.labels)?scene.labels:[];
 const drawFrames=Math.max(1,Math.round(Math.max(2,scene?.durationSeconds||8)*fps*.76));
 const hasAsset=Boolean(scene?.illustration);
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
 // Reusable SVG artwork is revealed in a controlled drawing pass, not faded in.
 // The hand tracks the reveal edge while the illustration is progressively uncovered.
 const assetProgress=interpolate(frame,[0,drawFrames],[0,1],clamp);
 const assetX=80+840*assetProgress;
 const labelFrames=Math.max(1,Math.round(drawFrames*.24));
 const activeHand=hasAsset&&frame<drawFrames?[assetX,350]:hand;
 return <AbsoluteFill>
  <svg viewBox="0 0 1000 700" preserveAspectRatio="xMidYMid meet" style={{position:'absolute',left:'5%',top:'25%',width:'90%',height:'47%',overflow:'visible'}}>
   {hasAsset ? <g>
    <defs><clipPath id={'sba-reveal-'+String(scene.id||scene.illustration).replace(/[^a-z0-9_-]/gi,'-')}><rect x="0" y="0" width={assetX} height="700"/></clipPath></defs>
    <g clipPath={'url(#sba-reveal-'+String(scene.id||scene.illustration).replace(/[^a-z0-9_-]/gi,'-')+')'}>
      <SBAIllustration type={scene.illustration} accent={scene.illustrationAccent || '#e1a82b'} animated={false}/>
    </g>
   </g>:null}
   {!hasAsset?rendered:null}
   {activeHand&&frame<drawFrames?<DrawingHand x={activeHand[0]} y={activeHand[1]}/>:null}
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
