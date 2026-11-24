import React from 'react';
import {AbsoluteFill, Audio, Easing, Img, Video, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const toCanvasPoint=(x,y,dims,width,height)=>{const iw=Number(dims?.width)||width,ih=Number(dims?.height)||height;const scale=Math.min(width/iw,height/ih);const rw=iw*scale,rh=ih*scale;return {x:((width-rw)/2+x*rw)/width,y:((height-rh)/2+y*rh)/height};};
const toCanvasRegion=(r,dims,width,height)=>{if(!r)return null;const iw=Number(dims?.width)||width,ih=Number(dims?.height)||height;const scale=Math.min(width/iw,height/ih);const rw=iw*scale,rh=ih*scale;return {x:((width-rw)/2+r.x*rw)/width,y:((height-rh)/2+r.y*rh)/height,width:r.width*rw/width,height:r.height*rh/height};};
const SceneVisual=({scene,source,sourceDimensions})=>{
 const frame=useCurrentFrame(); const {durationInFrames,width,height,fps}=useVideoConfig();
 const progress=durationInFrames>1?frame/(durationInFrames-1):1;
 const keys=scene.camera?.keyframes||[{at:0,x:.5,y:.5,scale:1},{at:1,x:.5,y:.5,scale:1}];
 const a=keys[0],b=keys[keys.length-1];
 const p=interpolate(progress,[0,1],[0,1],{extrapolateLeft:'clamp',extrapolateRight:'clamp',easing:Easing.inOut(Easing.cubic)});
 const scale=interpolate(p,[0,1],[a.scale||1,b.scale||1]);
 const pointA=toCanvasPoint(a.x??.5,a.y??.5,sourceDimensions,width,height),pointB=toCanvasPoint(b.x??.5,b.y??.5,sourceDimensions,width,height);
 const x=interpolate(p,[0,1],[pointA.x,pointB.x]);
 const y=interpolate(p,[0,1],[pointA.y,pointB.y]);
 const fade=interpolate(frame,[0,Math.min(12,durationInFrames/3)],[0,1],{extrapolateRight:'clamp'});
 const overlayVisible=(o)=>frame/fps>=o.start&&frame/fps<=o.end;
 return <AbsoluteFill style={{background:'#07111f',opacity:fade}}>
   <AbsoluteFill style={{overflow:'hidden',justifyContent:'center',alignItems:'center'}}>
    <div style={{position:'absolute',inset:0,overflow:'hidden',transform:`translate(${(0.5-x)*100*scale}%,${(0.5-y)*100*scale}%) scale(${scale})`,transformOrigin:'50% 50%'}}>
     <Img src={staticFile(source)} style={{width:'100%',height:'100%',objectFit:'contain'}}/>
     {(scene.supporting_assets||[]).map((asset,index)=>{
      const pip=asset.placement==='picture_in_picture'||index>0;
      const box=pip?{position:'absolute',right:'4%',bottom:'8%',width:'34%',height:'32%',border:'3px solid rgba(255,255,255,.9)',borderRadius:16,overflow:'hidden',boxShadow:'0 12px 36px rgba(0,0,0,.5)',zIndex:5}:{position:'absolute',inset:'5% 5% 10% 5%',borderRadius:18,overflow:'hidden',opacity:.82,zIndex:2};
      return <div key={asset.id||index} style={box}>
       {asset.media_type==='video'?<Video src={staticFile(asset.asset_file)} muted loop style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<Img src={staticFile(asset.asset_file)} style={{width:'100%',height:'100%',objectFit:'cover'}}/>}
       <div style={{position:'absolute',left:0,right:0,bottom:0,padding:'6px 10px',background:'rgba(0,0,0,.68)',color:'white',fontSize:Math.max(12,width*.012)}}>{asset.attribution_required?asset.attribution:asset.title}</div>
      </div>;
     })}
     {scene.focus_regions?.map(r=>{const region=toCanvasRegion(r.region,sourceDimensions,width,height);return <div key={r.component_id} style={{position:'absolute',left:`${region.x*100}%`,top:`${region.y*100}%`,width:`${region.width*100}%`,height:`${region.height*100}%`,border:'2px solid rgba(80,210,255,.9)',borderRadius:12,boxShadow:'0 0 24px rgba(40,180,255,.45)'}}/>})}
     {scene.overlays?.filter(overlayVisible).map(o=>{const anchor=toCanvasRegion(o.anchor_region,sourceDimensions,width,height);return <div key={o.id} style={{position:'absolute',left:anchor?`${clamp(anchor.x+anchor.width/2,.08,.78)*100}%`:'50%',top:anchor?`${clamp(anchor.y+anchor.height/2,.08,.72)*100}%`:'42%',transform:'translate(-50%,-50%)',padding:'12px 20px',borderRadius:12,background:'rgba(5,17,32,.88)',border:'1px solid #55d8ff',color:'white',fontSize:Math.max(24,width*.025),fontWeight:800,letterSpacing:'.02em',boxShadow:'0 8px 36px rgba(0,0,0,.35)',whiteSpace:'nowrap'}}>{o.text}</div>})}
    </div>
    <AbsoluteFill style={{background:'linear-gradient(180deg,rgba(3,8,18,.12),transparent 35%,rgba(3,8,18,.22))'}}/>
   </AbsoluteFill>
   <div style={{position:'absolute',top:height*.055,left:width*.055,right:width*.055,color:'white',fontSize:Math.max(24,width*.028),fontWeight:800,textShadow:'0 2px 14px #000'}}>{scene.headline}</div>
   <div style={{position:'absolute',bottom:height*.085,left:'7%',right:'7%',textAlign:'center',color:'white',fontSize:Math.max(23,width*.025),fontWeight:700,lineHeight:1.35,textShadow:'0 2px 12px #000',background:'rgba(4,12,24,.72)',padding:'14px 20px',borderRadius:14}}>
    {scene.subtitle_cues?.find(c=>frame/fps>=c.start&&frame/fps<c.end)?.text||''}
   </div>
   <div style={{position:'absolute',bottom:height*.025,right:width*.04,color:'rgba(255,255,255,.72)',fontSize:Math.max(14,width*.012),letterSpacing:'.08em'}}>SHINEY BRAIN ACADEMY</div>
 </AbsoluteFill>;
};

export const ImageExplainerVideo=({sourceImage,sourceDimensions,scenes,title})=>{
 const {fps}=useVideoConfig();
 return <AbsoluteFill style={{background:'#07111f',fontFamily:'Arial, sans-serif'}}>
  {scenes.map(scene=><Sequence key={scene.id} from={scene.start_frame} durationInFrames={scene.duration_frames} name={scene.headline||scene.id}>
   <SceneVisual scene={scene} source={sourceImage} sourceDimensions={sourceDimensions}/>
   <Audio src={staticFile(scene.audio_file)} volume={1}/>
  </Sequence>)}
  <AbsoluteFill style={{pointerEvents:'none',justifyContent:'center',alignItems:'center',opacity:0}}>
   <div>{title}</div>
  </AbsoluteFill>
 </AbsoluteFill>;
};
