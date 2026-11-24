import React from 'react';
import {AbsoluteFill, Audio, Easing, Img, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const SceneVisual=({scene,source})=>{
 const frame=useCurrentFrame(); const {durationInFrames,width,height,fps}=useVideoConfig();
 const progress=durationInFrames>1?frame/(durationInFrames-1):1;
 const keys=scene.camera?.keyframes||[{at:0,x:.5,y:.5,scale:1},{at:1,x:.5,y:.5,scale:1}];
 const a=keys[0],b=keys[keys.length-1];
 const p=interpolate(progress,[0,1],[0,1],{extrapolateLeft:'clamp',extrapolateRight:'clamp',easing:Easing.inOut(Easing.cubic)});
 const scale=interpolate(p,[0,1],[a.scale||1,b.scale||1]);
 const x=interpolate(p,[0,1],[a.x??.5,b.x??.5]);
 const y=interpolate(p,[0,1],[a.y??.5,b.y??.5]);
 const fade=interpolate(frame,[0,Math.min(12,durationInFrames/3)],[0,1],{extrapolateRight:'clamp'});
 const overlayVisible=(o)=>frame/fps>=o.start&&frame/fps<=o.end;
 return <AbsoluteFill style={{background:'#07111f',opacity:fade}}>
   <AbsoluteFill style={{overflow:'hidden',justifyContent:'center',alignItems:'center'}}>
    <Img src={source} style={{width:'100%',height:'100%',objectFit:'contain',transform:`scale(${scale})`,transformOrigin:`${x*100}% ${y*100}%`}}/>
    <AbsoluteFill style={{background:'linear-gradient(180deg,rgba(3,8,18,.12),transparent 35%,rgba(3,8,18,.22))'}}/>
    {scene.focus_regions?.map(r=><div key={r.component_id} style={{position:'absolute',left:`${r.region.x*100}%`,top:`${r.region.y*100}%`,width:`${r.region.width*100}%`,height:`${r.region.height*100}%`,border:'2px solid rgba(80,210,255,.9)',borderRadius:12,boxShadow:'0 0 24px rgba(40,180,255,.45)'}}/>)}
    {scene.overlays?.filter(overlayVisible).map(o=><div key={o.id} style={{position:'absolute',left:o.anchor_region?`${clamp(o.anchor_region.x+o.anchor_region.width/2,.08,.78)*100}%`:'50%',top:o.anchor_region?`${clamp(o.anchor_region.y+o.anchor_region.height/2,.08,.72)*100}%`:'42%',transform:'translate(-50%,-50%)',padding:'12px 20px',borderRadius:12,background:'rgba(5,17,32,.88)',border:'1px solid #55d8ff',color:'white',fontSize:Math.max(24,width*.025),fontWeight:800,letterSpacing:'.02em',boxShadow:'0 8px 36px rgba(0,0,0,.35)',whiteSpace:'nowrap'}}>{o.text}</div>)}
   </AbsoluteFill>
   <div style={{position:'absolute',top:height*.055,left:width*.055,right:width*.055,color:'white',fontSize:Math.max(24,width*.028),fontWeight:800,textShadow:'0 2px 14px #000'}}>{scene.headline}</div>
   <div style={{position:'absolute',bottom:height*.085,left:'7%',right:'7%',textAlign:'center',color:'white',fontSize:Math.max(23,width*.025),fontWeight:700,lineHeight:1.35,textShadow:'0 2px 12px #000',background:'rgba(4,12,24,.72)',padding:'14px 20px',borderRadius:14}}>
    {scene.subtitle_cues?.find(c=>frame/fps>=c.start&&frame/fps<c.end)?.text||''}
   </div>
   <div style={{position:'absolute',bottom:height*.025,right:width*.04,color:'rgba(255,255,255,.72)',fontSize:Math.max(14,width*.012),letterSpacing:'.08em'}}>SHINEY BRAIN ACADEMY</div>
 </AbsoluteFill>;
};

export const ImageExplainerVideo=({sourceImage,scenes,title})=>{
 const {fps}=useVideoConfig();
 return <AbsoluteFill style={{background:'#07111f',fontFamily:'Arial, sans-serif'}}>
  {scenes.map(scene=><Sequence key={scene.id} from={scene.start_frame} durationInFrames={scene.duration_frames} name={scene.headline||scene.id}>
   <SceneVisual scene={scene} source={sourceImage}/>
   <Audio src={staticFile(scene.audio_file)} volume={1}/>
  </Sequence>)}
  <AbsoluteFill style={{pointerEvents:'none',justifyContent:'center',alignItems:'center',opacity:0}}>
   <div>{title}</div>
  </AbsoluteFill>
 </AbsoluteFill>;
};
