'use client';

import React from 'react';
import { TegakiRenderer } from 'tegaki';
import caveat from 'tegaki/fonts/caveat';
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

function WhiteboardScene({scene,brand,accent,index,narrationVolume}) {
 const intro=interpolate(useCurrentFrame(),[0,12],[0,1],clamp);
 return <AbsoluteFill style={{opacity:intro,background:'#fffef8',fontFamily:'Trebuchet MS, Arial, sans-serif',color:C.ink}}>
  <svg width="100%" height="100%" viewBox="0 0 1080 1920" preserveAspectRatio="none" style={{position:'absolute',inset:0}}><defs><pattern id={'paperDots-'+index} width="34" height="34" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.1" fill="#d8e0e5" opacity=".55"/></pattern></defs><rect width="1080" height="1920" fill={'url(#paperDots-'+index+')'}/></svg>
  <div style={{position:'absolute',top:55,left:65,fontSize:27,fontWeight:900,letterSpacing:2,color:C.blue}}>{brand.toUpperCase()}</div>
  <div style={{position:'absolute',top:55,right:65,fontSize:19,fontWeight:800,color:'#8794a1'}}>LET’S DRAW IT OUT</div>
  <div style={{position:'absolute',top:'13%',left:'8%',right:'8%',fontSize:54,fontWeight:900,lineHeight:1.08,color:C.navy}}>{scene.heading||'Let’s understand this'}</div>
  <DrawnVisual scene={scene}/>
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

function storyLines(text,maxChars) {
 const words=String(text||'').trim().split(/\s+/).filter(Boolean), lines=[]; let line='';
 words.forEach(word=>{const next=line?line+' '+word:word;if(next.length>maxChars&&line){lines.push(line);line=word;}else line=next;});
 if(line) lines.push(line); return lines;
}
function StoryArt({index,progress,accent}) {
 if(index===0) return <svg viewBox="0 0 900 650" width="100%" height="100%">
  <path d="M170 80 H600 L720 200 V560 H170 Z" fill="#f8e8c7" stroke="#e9bd73" strokeWidth="8" transform={'translate('+interpolate(progress,[0,1],[70,0],clamp)+' 0)'}/>
  <path d="M600 80 V200 H720 M235 185 H535 M235 250 H465" stroke="#9c7042" strokeWidth="14" fill="none"/>
  <text x="450" y="380" textAnchor="middle" fontSize="112" fontWeight="900" fill="#9c382d">21 DAYS</text>
  <path d="M255 490 L310 545 L405 465" stroke="#16856b" strokeWidth="17" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="220" strokeDashoffset={interpolate(progress,[.35,.8],[220,0],clamp)}/>
  <circle cx="740" cy="115" r="58" fill={accent}/><path d="M740 78 V115 L772 136" stroke="#17243c" strokeWidth="10" fill="none" strokeLinecap="round"/>
 </svg>;
 if(index===1) return <svg viewBox="0 0 900 650" width="100%" height="100%">
  <circle cx="450" cy="300" r="205" fill="#20243c" stroke="#f07a65" strokeWidth="12"/>
  {Array.from({length:12},(_,i)=><path key={i} d="M450 105 V145" transform={'rotate('+(i*30)+' 450 300)'} stroke="#f6c7a8" strokeWidth="9" strokeLinecap="round"/> )}
  <path d="M450 300 L450 170 M450 300 L560 350" stroke="#fff0df" strokeWidth="17" strokeLinecap="round"/>
  <path d="M140 180 Q220 70 320 150 Q390 50 485 140 Q620 75 700 190 Q820 220 745 330 Q800 430 680 455 H230 Q100 420 160 320 Q85 250 140 180" fill="#5b3655" opacity=".9"/>
  <text x="450" y="530" textAnchor="middle" fill="#ffe1cb" fontSize="45" fontWeight="900">FEAR STEALS TIME</text>
 </svg>;
 if(index===2) return <svg viewBox="0 0 900 650" width="100%" height="100%">
  {['ONE TOPIC','PRACTISE','TIME IT','REVIEW'].map((label,i)=>{const y=70+i*140;return <g key={label} opacity={interpolate(progress,[i*.13,i*.13+.2],[0,1],clamp)}><rect x="170" y={y} width="560" height="105" rx="24" fill={i%2?'#e8f1ff':'#fff8e7'} stroke={i%2?'#6b9bd1':'#d9ae59'} strokeWidth="5"/><circle cx="230" cy={y+52} r="27" fill="#16856b"/><path d={'M216 '+(y+52)+' l12 13 25 -29'} stroke="#fff" strokeWidth="8" fill="none" strokeLinecap="round" strokeLinejoin="round"/><text x="290" y={y+67} fontSize="43" fontWeight="900" fill="#172b4d">{label}</text></g>;})}
 </svg>;
 if(index===3) return <svg viewBox="0 0 900 650" width="100%" height="100%">
  <path d="M120 540 H790" stroke="#a8c9b7" strokeWidth="8"/>
  {[130,250,370,490,610].map((x,i)=><rect key={x} x={x} y={520-(i+1)*68} width="76" height={(i+1)*68} rx="12" fill={i===4?'#f4c542':'#42a68a'} opacity={interpolate(progress,[i*.12,i*.12+.2],[0,1],clamp)}/>)}
  <path d="M150 440 Q270 390 355 330 T560 215 T755 100" stroke="#fff" strokeWidth="20" fill="none" strokeLinecap="round" strokeDasharray="900" strokeDashoffset={interpolate(progress,[.15,.85],[900,0],clamp)}/>
  <path d="M700 100 L755 100 L745 155" stroke="#fff" strokeWidth="18" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
  <text x="450" y="610" textAnchor="middle" fontSize="43" fontWeight="900" fill="#eafff4">SMALL WINS. REAL PROGRESS.</text>
 </svg>;
 return <svg viewBox="0 0 900 650" width="100%" height="100%">
  <circle cx="450" cy="315" r="190" fill="#ffd66b" opacity=".18"/><circle cx="450" cy="315" r="130" fill="#ffd66b" opacity=".35"/>
  <path d="M170 470 Q450 80 730 470 M450 70 V190 M220 180 L300 250 M680 180 L600 250 M260 490 H640" stroke="#fff2bf" strokeWidth="13" fill="none" strokeLinecap="round"/>
  <path d="M450 360 V505 M390 445 L450 505 L510 445" stroke="#fff" strokeWidth="17" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
  <text x="450" y="585" textAnchor="middle" fontSize="44" fontWeight="900" fill="#fff">YOUR NEXT CHAPTER</text>
 </svg>;
}
function StoryScene({scene,index,brand,accent}) {
 const f=useCurrentFrame(), {fps,width,height}=useVideoConfig(), vertical=height>width;
 const heading=scene.heading||'A story worth remembering', body=scene.text||'Every great result begins with one small decision.';
 const palettes=[{bg:'#101a35',glow:'#244d78',ink:'#fff8e8',muted:'#c5d6eb',hot:'#f4c542'},{bg:'#25182d',glow:'#693b55',ink:'#fff0e7',muted:'#f0c9bd',hot:'#ff8b70'},{bg:'#102d3b',glow:'#1b6c70',ink:'#f4fff9',muted:'#c2e8df',hot:'#f4c542'},{bg:'#123a32',glow:'#24745b',ink:'#f2fff5',muted:'#c8e9d3',hot:'#f4c542'},{bg:'#17264b',glow:'#a45d42',ink:'#fff8e8',muted:'#f4dfc5',hot:'#ffd36a'}];
 const p=palettes[Math.min(index,4)], reveal=interpolate(f,[5,22],[0,1],smooth);
 const hLines=storyLines(heading,vertical?17:29), bLines=storyLines(body,vertical?27:52);
 const maxH=Math.max(...hLines.map(x=>x.length),10), maxB=Math.max(...bLines.map(x=>x.length),18);
 const hSize=Math.min(vertical?112:94,(vertical?920:1450)/(maxH*.56));
 const bSize=Math.min(vertical?66:56,(vertical?930:1480)/(maxB*.55));
 const titleY=height*(vertical?.15:.19), artTop=height*(vertical?.34:.30), artHeight=height*(vertical?.24:.42), bodyY=height*(vertical?.60:.64);
 const label=['THE LAST CHANCE','THE REAL ENEMY','A BETTER PLAN','THE TURNING POINT','YOUR MOVE'][Math.min(index,4)];
 const titleLines=hLines.map((line,i)=><div key={i} style={{opacity:interpolate(f,[8+i*4,20+i*4],[0,1],clamp),transform:'translateX('+interpolate(f,[8+i*4,24+i*4],[55,0],clamp)+'px)'}}>{line.split(' ').map((word,j)=><React.Fragment key={j}><span style={{color:((index===0&&/chance|one/i.test(word))||(index===4&&/now|chapter/i.test(word)))?p.hot:'inherit'}}>{word}</span>{j<line.split(' ').length-1?' ':''}</React.Fragment>)}</div>);
 return <AbsoluteFill style={{background:p.bg,color:p.ink,fontFamily:'Arial,Helvetica,sans-serif',overflow:'hidden',opacity:interpolate(f,[0,18],[0,1],clamp)}}>
  <svg width="100%" height="100%" viewBox={'0 0 '+width+' '+height} preserveAspectRatio="none" style={{position:'absolute',inset:0}}>
   <defs><linearGradient id={'sbg'+index} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={p.bg}/><stop offset="1" stopColor={p.glow}/></linearGradient><radialGradient id={'sglow'+index}><stop offset="0" stopColor={p.hot} stopOpacity=".3"/><stop offset="1" stopColor={p.hot} stopOpacity="0"/></radialGradient></defs>
   <rect width={width} height={height} fill={'url(#sbg'+index+')'}/><ellipse cx={width*.78} cy={height*.22} rx={width*.55} ry={height*.28} fill={'url(#sglow'+index+')'}/>
   <path d={'M0 '+height*.84+' Q'+width*.42+' '+height*.72+' '+width+' '+height*.91} stroke={p.hot} strokeOpacity=".14" strokeWidth={width*.012} fill="none"/>
   <circle cx={width*.9} cy={height*.1} r={width*.14} fill={p.hot} opacity=".07"/>
  </svg>
  <div style={{position:'absolute',top:height*(vertical?.045:.06),left:width*.075,fontSize:Math.max(17,width*.022),fontWeight:900,letterSpacing:3,color:p.muted}}>{brand.toUpperCase()}</div>
  <div style={{position:'absolute',top:height*(vertical?.045:.06),right:width*.075,fontSize:Math.max(15,width*.018),fontWeight:800,letterSpacing:2,color:p.muted}}>{String(index+1).padStart(2,'0')} / 05</div>
  <div style={{position:'absolute',left:width*(vertical?.085:.09),right:width*.075,top:titleY,opacity:reveal}}>
   <div style={{fontSize:Math.max(16,width*.021),fontWeight:900,letterSpacing:4,color:p.hot,marginBottom:height*(vertical?.018:.025)}}>{label}</div>
   <div style={{fontSize:hSize,lineHeight:vertical?1.02:1.06,fontWeight:950,letterSpacing:-2,color:p.ink,textShadow:'0 8px 30px rgba(0,0,0,.22)',overflowWrap:'anywhere'}}>{titleLines}</div>
   <div style={{height:Math.max(7,width*.009),width:interpolate(f,[20,38],[0,Math.min(width*.42,520)],clamp),background:p.hot,borderRadius:20,marginTop:height*.025}}/>
  </div>
  <div style={{position:'absolute',left:width*(vertical?.07:.09),right:width*(vertical?.07:.09),top:artTop,height:artHeight,transform:'translateY('+interpolate(f,[0,fps*7],[25,-25],clamp)+'px)',opacity:interpolate(f,[12,30],[0,1],clamp)}}><StoryArt index={index} progress={interpolate(f,[8,Math.max(9,fps*3)],[0,1],clamp)} accent={p.hot}/></div>
  <div style={{position:'absolute',left:width*(vertical?.085:.09),right:width*(vertical?.085:.09),top:bodyY,height:height*(vertical?.22:.22),display:'flex',flexDirection:'column'}}>
   <div style={{fontSize:Math.max(16,width*.019),fontWeight:900,letterSpacing:3,color:p.hot,marginBottom:height*.012}}>{index===4?'TAKE THE FIRST STEP':'THE STORY CONTINUES'}</div>
   <div style={{fontSize:bSize,lineHeight:1.18,fontWeight:650,color:p.muted,textShadow:'0 3px 14px rgba(0,0,0,.18)'}}>{bLines.map((line,i)=><div key={i} style={{opacity:interpolate(f,[Math.round(fps*.7)+i*5,Math.round(fps*.7)+i*5+9],[0,1],clamp),transform:'translateY('+interpolate(f,[Math.round(fps*.7)+i*5,Math.round(fps*.7)+i*5+9],[22,0],clamp)+'px)'}}>{line}</div>)}</div>
  </div>
  <div style={{position:'absolute',left:width*.075,right:width*.075,bottom:height*.045,display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:Math.max(14,width*.016),fontWeight:900,letterSpacing:2,color:p.muted}}><span>SHINEY BRAIN • STORY REEL</span><span style={{color:p.hot}}>{index===4?'START TODAY':'KEEP GOING'}</span></div>
 </AbsoluteFill>;
}
function Scene({scene,index,template,brand,accent,narrationVolume}) {
 let visual;
 if(template==='whiteboard') visual=<WhiteboardScene scene={scene} brand={brand} accent={accent} index={index}/>;
 else if(template==='question') visual=<QuestionScene scene={scene} brand={brand} accent={accent} index={index}/>;
 else if(template==='story') visual=<StoryScene scene={scene} brand={brand} accent={accent} index={index}/>;
 else visual=<ExplainerScene scene={scene} brand={brand} accent={accent} index={index}/>;
 return <>{visual}{scene.audioSrc?<Audio src={scene.audioSrc} volume={narrationVolume}/>:null}</>;
}

export function StudioComposition({title='Shiney Brain Video',scenes=[],template='explainer',brand='SHINEY BRAIN ACADEMY',accent='#f4c542',musicSrc=null,musicVolume=0.12,narrationVolume=1}) {
 let from=0;
 return <AbsoluteFill>{scenes.map((scene,index)=>{const duration=Math.max(60,Math.round((Number(scene.durationSeconds)||5)*30));const start=from;from+=duration;return <Sequence key={scene.id||index} from={start} durationInFrames={duration}><Scene scene={scene} index={index} template={template} brand={brand} accent={accent} narrationVolume={narrationVolume}/></Sequence>;})}{musicSrc?<Audio src={musicSrc} volume={musicVolume} loop/>:null}</AbsoluteFill>;
}
