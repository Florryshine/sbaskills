'use client';

import React from 'react';
import { DrawnVisual } from './DrawnVisual';
import {AbsoluteFill, Sequence, Audio, useCurrentFrame, useVideoConfig, interpolate, Easing} from 'remotion';

const C={blue:'#1261a0',navy:'#102b4e',yellow:'#f4c542',ink:'#172b4d'};
const clamp={extrapolateLeft:'clamp',extrapolateRight:'clamp'};
const smooth={...clamp,easing:Easing.out(Easing.cubic)};

function Hand({x=0,y=0,scale=1,visible=true,tilt=0}) {
  return <div style={{position:'absolute',left:x,top:y,transform:`translate(-12%,-12%) rotate(${tilt}deg) scale(${scale})`,transformOrigin:'15% 15%',opacity:visible?1:0,zIndex:20,pointerEvents:'none',filter:'drop-shadow(2px 4px 2px #0003)'}}>
    <svg width="94" height="112" viewBox="0 0 94 112" overflow="visible">
      <path d="M28 48 L28 15 Q28 5 37 5 Q46 5 46 15 L46 45 L46 10 Q46 0 55 0 Q64 0 64 10 L64 47 L64 20 Q64 10 73 10 Q82 10 82 20 L82 56 Q89 43 96 49 Q102 54 97 64 L82 91 Q74 107 55 107 L39 107 Q23 106 17 92 L5 69 Q0 59 8 55 Q16 51 22 61 L28 72 Z" fill="#f0bd91" stroke="#754b39" strokeWidth="3" strokeLinejoin="round"/>
      <path d="M29 50 L29 70 M47 46 L47 66 M65 49 L65 67" stroke="#d4946d" strokeWidth="3" strokeLinecap="round"/>
      <path d="M27 17 Q28 9 36 9" stroke="#fff2e8" strokeWidth="3" fill="none" strokeLinecap="round"/>
      <path d="M8 57 L-2 42" stroke="#f4c542" strokeWidth="6" strokeLinecap="round"/>
    </svg>
  </div>;
}

function BoardBackground({brand}) {
 return <AbsoluteFill style={{background:'#fffef8',fontFamily:'Trebuchet MS, Arial, sans-serif',color:C.ink}}>
  <svg width="100%" height="100%" viewBox="0 0 1080 1920" preserveAspectRatio="none" style={{position:'absolute',inset:0}}>
   <defs><pattern id="paperDots" width="34" height="34" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.1" fill="#d8e0e5" opacity=".55"/></pattern></defs>
   <rect width="1080" height="1920" fill="url(#paperDots)"/>
   <path d="M55 145 Q540 128 1025 145" stroke="#e4e8e7" strokeWidth="3" fill="none"/>
  </svg>
  <div style={{position:'absolute',top:55,left:65,fontSize:27,fontWeight:900,letterSpacing:2,color:C.blue}}>{brand.toUpperCase()}</div>
  <div style={{position:'absolute',top:55,right:65,fontSize:19,fontWeight:800,color:'#8794a1'}}>LET’S DRAW IT OUT</div>
 </AbsoluteFill>;
}

function WhiteboardScene({scene,brand,accent,index}) {
 const intro=interpolate(useCurrentFrame(),[0,12],[0,1],clamp);
 return <AbsoluteFill style={{opacity:intro,background:'#fffef8',fontFamily:'Trebuchet MS, Arial, sans-serif',color:C.ink}}>
  <svg width="100%" height="100%" viewBox="0 0 1080 1920" preserveAspectRatio="none" style={{position:'absolute',inset:0}}><defs><pattern id={'paperDots-'+index} width="34" height="34" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.1" fill="#d8e0e5" opacity=".55"/></pattern></defs><rect width="1080" height="1920" fill={'url(#paperDots-'+index+')'}/></svg>
  <div style={{position:'absolute',top:55,left:65,fontSize:27,fontWeight:900,letterSpacing:2,color:C.blue}}>{brand.toUpperCase()}</div>
  <div style={{position:'absolute',top:55,right:65,fontSize:19,fontWeight:800,color:'#8794a1'}}>LET’S DRAW IT OUT</div>
  <div style={{position:'absolute',top:'13%',left:'8%',right:'8%',fontSize:54,fontWeight:900,lineHeight:1.08,color:C.navy}}>{scene.heading||'Let’s understand this'}</div>
  <DrawnVisual scene={scene}/>
  {scene.audioSrc ? <Audio src={scene.audioSrc} volume={1}/> : null}
  <div style={{position:'absolute',left:'9%',right:'9%',bottom:'12%',fontSize:33,lineHeight:1.28,fontWeight:700,color:C.navy}}>{scene.narration}</div>
  <div style={{position:'absolute',left:'8%',bottom:'5%',fontSize:20,fontWeight:800,color:'#8794a1'}}>SHINEY BRAIN • {String(index+1).padStart(2,'0')}</div>
 </AbsoluteFill>;
}
function BondingDoodle({progress,accent}) {
 const stroke=(delay=0)=>({strokeDasharray:1200,strokeDashoffset:interpolate(progress,[delay,Math.min(1,delay+.35)],[1200,0],clamp)});
 return <>
  <g fill="none" strokeLinecap="round" strokeLinejoin="round">
   <circle cx="245" cy="300" r="120" stroke={C.blue} strokeWidth="8" style={stroke(0)}/>
   <circle cx="245" cy="300" r="76" stroke="#8eb4d1" strokeWidth="5" strokeDasharray="10 14"/>
   <circle cx="655" cy="300" r="120" stroke="#d18b27" strokeWidth="8" style={stroke(.12)}/>
   <circle cx="655" cy="300" r="76" stroke="#e7c58e" strokeWidth="5" strokeDasharray="10 14"/>
   <path d="M245 180 Q130 300 245 420 Q360 300 245 180" stroke={C.blue} strokeWidth="5" opacity=".65"/>
   <path d="M655 180 Q540 300 655 420 Q770 300 655 180" stroke="#d18b27" strokeWidth="5" opacity=".65"/>
   <path d="M370 300 C430 220 470 220 530 300" stroke={accent} strokeWidth="12" style={stroke(.35)}/>
   <path d="M495 270 L530 300 L492 326" stroke={accent} strokeWidth="12" style={stroke(.48)}/>
  </g>
  <g fontFamily="Arial" fontWeight="900" textAnchor="middle">
   <text x="245" y="315" fontSize="74" fill={C.blue}>Na</text><text x="655" y="315" fontSize="74" fill="#c27b19">Cl</text>
   <text x="245" y="470" fontSize="34" fill={C.blue}>Sodium</text><text x="655" y="470" fontSize="34" fill="#c27b19">Chlorine</text>
   <text x="450" y="190" fontSize="29" fill={C.navy}>electron transfer</text>
   <text x="450" y="570" fontSize="46" fill={C.navy}>Na⁺  +  Cl⁻</text>
   <text x="450" y="625" fontSize="28" fill={C.blue}>opposite charges attract</text>
  </g>
  {[{x:340,y:270},{x:370,y:300},{x:400,y:330}].map((p,i)=><circle key={i} cx={p.x} cy={p.y} r="13" fill={accent} opacity={progress>.45?1:0}/>)}
 </>;
}

function GenericDoodle({progress,accent}) {
 const paths=['M140 210 C250 80 380 80 470 200','M470 200 L430 160 M470 200 L420 225','M170 470 Q300 340 430 470 T700 470','M170 600 L700 600'];
 return <>
  <g fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="10" stroke={C.blue}>
   {paths.map((d,i)=><path key={i} d={d} strokeDasharray="1200" strokeDashoffset={interpolate(progress,[i*.16,Math.min(1,i*.16+.3)],[1200,0],clamp)}/>)}
  </g>
  <circle cx="270" cy="340" r="75" fill="#fff" stroke={accent} strokeWidth="10" opacity={progress}/>
  <path d="M245 340 l20 22 42 -52" stroke={C.blue} strokeWidth="12" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="150" strokeDashoffset={interpolate(progress,[.5,.8],[150,0],clamp)}/>
  <text x="560" y="360" fontSize="46" fontWeight="900" fill={C.navy}>IDEA</text>
  <text x="450" y="700" textAnchor="middle" fontSize="34" fontWeight="800" fill={C.navy}>Draw • Explain • Remember</text>
 </>;
}

function ExplainerScene({scene,index,brand,accent}) {
 const f=useCurrentFrame(); const enter=interpolate(f,[0,14],[0,1],clamp);
 const y=interpolate(f,[0,18],[60,0],smooth);
 const words=(scene.text||'').split(' ').length;
 return <AbsoluteFill style={{background:'#f2f7fc',fontFamily:'Arial, sans-serif',opacity:enter}}>
  <div style={{position:'absolute',top:65,left:70,fontSize:25,fontWeight:900,color:C.blue,letterSpacing:2}}>{brand.toUpperCase()}</div>
  <div style={{position:'absolute',top:180,left:75,right:75,fontSize:57,fontWeight:900,lineHeight:1.08,color:C.navy,transform:`translateY(${y}px)`}}>{scene.heading}</div>
  <svg viewBox="0 0 900 600" style={{position:'absolute',top:'34%',left:'8%',width:'84%',height:'38%'}}>
   <circle cx="450" cy="270" r="155" fill="#fff" stroke={accent} strokeWidth="14"/>
   <circle cx="450" cy="270" r="112" fill="#dceeff"/>
   <path d="M450 145 C380 215 390 315 450 390 C510 315 520 215 450 145" fill="#5ba66b"/>
   <path d="M450 170 L450 365 M450 255 L380 210 M450 300 L520 240" stroke="#fff" strokeWidth="9" fill="none" strokeLinecap="round"/>
   <path d="M175 280 Q260 110 340 190 M560 190 Q650 110 725 280" stroke={C.blue} strokeWidth="12" fill="none" strokeLinecap="round" strokeDasharray="18 18"/>
   <path d="M300 175 l40 15 -25 35 M680 260 l45 20 -36 27" fill="none" stroke={C.blue} strokeWidth="10" strokeLinecap="round" strokeLinejoin="round"/>
   <text x="450" y="500" textAnchor="middle" fontSize="34" fontWeight="900" fill={C.navy}>SEE THE PROCESS</text>
  </svg>
  <div style={{position:'absolute',left:80,right:80,bottom:'12%',fontSize:35,lineHeight:1.3,fontWeight:650,color:C.navy}}>{scene.text}</div>
  <div style={{position:'absolute',bottom:55,left:80,fontSize:20,fontWeight:800,color:C.blue}}>CONCEPT {index+1}</div>
 </AbsoluteFill>;
}

function QuestionScene({scene,index,brand,accent}) {
 const f=useCurrentFrame(); const fade=interpolate(f,[0,12],[0,1],clamp);
 return <AbsoluteFill style={{background:'#102b4e',color:'#fff',fontFamily:'Arial,sans-serif',padding:'8%',opacity:fade}}>
  <div style={{fontSize:24,fontWeight:900,color:accent,letterSpacing:2}}>{brand.toUpperCase()} • JAMB PRACTICE</div>
  <div style={{marginTop:'13%',fontSize:54,fontWeight:900,lineHeight:1.12}}>{scene.heading}</div>
  <div style={{marginTop:35,fontSize:31,lineHeight:1.3,color:'#dce8f4'}}>{scene.text}</div>
  <div style={{marginTop:65,display:'grid',gridTemplateColumns:'1fr 1fr',gap:22}}>
   {(scene.options||['Option A','Option B','Option C','Option D']).map((o,i)=><div key={i} style={{border:'2px solid #7ca4ca',borderRadius:22,padding:24,fontSize:27,fontWeight:800,background:'#183b62'}}>{String.fromCharCode(65+i)}. {o}</div>)}
  </div>
  <div style={{position:'absolute',bottom:75,left:85,fontSize:22,color:accent,fontWeight:800}}>THINK BEFORE YOU ANSWER</div>
 </AbsoluteFill>;
}

function StoryScene({scene,index,brand,accent}) {
 const f=useCurrentFrame(); const scale=interpolate(f,[0,30],[1.08,1],clamp);
 return <AbsoluteFill style={{background:'linear-gradient(145deg,#07182e,#163f68 60%,#081525)',color:'#fff',fontFamily:'Arial,sans-serif',padding:'9%',transform:`scale(${scale})`}}>
  <div style={{fontSize:22,fontWeight:900,color:accent,letterSpacing:3}}>{brand.toUpperCase()}</div>
  <div style={{position:'absolute',left:'9%',right:'9%',top:'27%',fontSize:66,lineHeight:1.1,fontWeight:900}}>{scene.heading}</div>
  <div style={{position:'absolute',left:'9%',right:'9%',bottom:'19%',fontSize:34,lineHeight:1.35,color:'#d8e8f8'}}>{scene.text}</div>
  <div style={{position:'absolute',bottom:'7%',fontSize:20,fontWeight:900,color:accent}}>HER NEXT CHAPTER STARTS NOW</div>
 </AbsoluteFill>;
}

function Scene({scene,index,template,brand,accent}) {
 if(template==='whiteboard') return <WhiteboardScene scene={scene} brand={brand} accent={accent} index={index}/>;
 if(template==='question') return <QuestionScene scene={scene} brand={brand} accent={accent} index={index}/>;
 if(template==='story') return <StoryScene scene={scene} brand={brand} accent={accent} index={index}/>;
 return <ExplainerScene scene={scene} brand={brand} accent={accent} index={index}/>;
}

export function StudioComposition({title='Shiney Brain Video',scenes=[],template='explainer',brand='SHINEY BRAIN ACADEMY',accent='#f4c542',audioSrc=null}) {
 let from=0;
 return <AbsoluteFill>{scenes.map((scene,index)=>{const duration=Math.max(60,Math.round((Number(scene.durationSeconds)||5)*30));const start=from;from+=duration;return <Sequence key={scene.id||index} from={start} durationInFrames={duration}><Scene scene={scene} index={index} template={template} brand={brand} accent={accent}/></Sequence>;})}{audioSrc?<Audio src={audioSrc} volume={0.9}/>:null}</AbsoluteFill>;
}
