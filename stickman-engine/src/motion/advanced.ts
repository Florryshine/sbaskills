import { clamp, easeInOut, lerp, V2 } from '../rig/geometry';
import { CharStyle, FaceEvent, SkeletonFrame } from '../rig/character';
import { buildFrame, PoseParams } from './poses';

export type AdvancedOpts = { style: CharStyle; startFrame: number; frames: number; fps: number; x: number; facing: 1 | -1 };
export type AdvancedResult = { frames: SkeletonFrame[]; events: FaceEvent[]; shake?: { frame: number; amp: number; dur: number }[] };
const ground = (s: CharStyle) => -(s.thigh + s.shin + s.ankleH);
function pose(s:CharStyle,x:number,y:number,f:1|-1,lean:number,headTilt:number,armL:PoseParams['armL'],armR:PoseParams['armR'],legL:PoseParams['legL'],legR:PoseParams['legR']) {
 return buildFrame(s,{x,y,facing:f,lean,headTilt,armL,armR,legL,legR});
}
function result(frames:SkeletonFrame[],events:FaceEvent[]=[]):AdvancedResult{return {frames,events};}

export function jumpStream(o:AdvancedOpts & {height?:number}):AdvancedResult {
 const s=o.style,h=clamp(o.height??105,35,220),out:SkeletonFrame[]=[];
 for(let i=0;i<o.frames;i++){const t=i/Math.max(1,o.frames-1),lift=Math.sin(Math.PI*t)*h,anticipation=1-easeInOut(clamp(t/.18,0,1)),air=lift>2;
 out.push(pose(s,o.x,ground(s)-lift+anticipation*10,o.facing,-8+lift/h*5,-10,
 {mode:'fk',sh:lerp(8,-145,lift/h),el:lerp(12,-24,lift/h)},{mode:'fk',sh:lerp(-8,145,lift/h),el:lerp(12,24,lift/h)},
 {mode:'ik',foot:[o.x-12,air?-lift*.45:0]},{mode:'ik',foot:[o.x+12,air?-lift*.45:0]}));}
 return result(out,[{frame:o.startFrame+1,emo:'surprised'},{frame:o.startFrame+Math.floor(o.frames*.3),emo:'happy'},{frame:o.startFrame+o.frames-3,emo:'neutral'}]);
}
export function clapStream(o:AdvancedOpts):AdvancedResult {
 const out:SkeletonFrame[]=[],s=o.style;
 for(let i=0;i<o.frames;i++){const pulse=(Math.sin(i/o.fps*Math.PI*3.2)+1)/2,gap=lerp(30,2,pulse),y=ground(s);
 out.push(pose(s,o.x,y,o.facing,1,-2,{mode:'ik',target:[o.x-o.facing*gap,y-s.torso-35],bend:-1},{mode:'ik',target:[o.x+o.facing*gap,y-s.torso-35],bend:1},{mode:'ik',foot:[o.x-11,0]},{mode:'ik',foot:[o.x+11,0]}));}
 return result(out,[{frame:o.startFrame+1,emo:'happy'}]);
}
export function danceStream(o:AdvancedOpts):AdvancedResult {
 const out:SkeletonFrame[]=[],s=o.style;
 for(let i=0;i<o.frames;i++){const t=i/o.fps,sway=Math.sin(t*Math.PI*2*1.15),bounce=Math.abs(Math.sin(t*Math.PI*2*2.3))*9,x=o.x+sway*8,y=ground(s)-bounce;
 out.push(pose(s,x,y,o.facing,sway*13,-sway*8,{mode:'fk',sh:42+Math.sin(t*7)*55,el:25+Math.cos(t*8)*28},{mode:'fk',sh:-42-Math.sin(t*7+1)*55,el:25+Math.sin(t*8)*28},{mode:'ik',foot:[x-12+sway*13,0]},{mode:'ik',foot:[x+12-sway*13,0]}));}
 return result(out,[{frame:o.startFrame+1,emo:'happy'}]);
}
export function pullStream(o:AdvancedOpts & {propX:number;propH:number}):AdvancedResult {
 const out:SkeletonFrame[]=[],s=o.style,f=o.facing;
 for(let i=0;i<o.frames;i++){const strain=Math.sin(i/o.fps*5.5),x=o.x-strain*2,y=ground(s)+5+Math.abs(strain)*2;
 out.push(pose(s,x,y,f,-25-strain*4,12,{mode:'ik',target:[o.propX-f*8,-o.propH+12],bend:f===1?-1:1},{mode:'ik',target:[o.propX-f*22,-o.propH+18],bend:f===1?-1:1},{mode:'ik',foot:[x-f*30,0]},{mode:'ik',foot:[x-f*62,0]}));}
 return result(out,[{frame:o.startFrame+1,emo:'strain'}]);
}
export function pickupStream(o:AdvancedOpts & {propX:number;propH:number}):AdvancedResult {
 const out:SkeletonFrame[]=[],s=o.style,f=o.facing;
 for(let i=0;i<o.frames;i++){const t=clamp(i/Math.max(1,o.frames-1),0,1),bend=easeInOut(clamp(t/.58,0,1)),y=ground(s)+bend*34,targetY=-o.propH+8;
 out.push(pose(s,o.x,y,f,lerp(2,25,bend),lerp(0,12,bend),{mode:'ik',target:[o.propX-f*12,targetY],bend:f===1?-1:1},{mode:'ik',target:[o.propX-f*2,targetY+7],bend:f===1?-1:1},{mode:'ik',foot:[o.x-11,0]},{mode:'ik',foot:[o.x+11,0]}));}
 return result(out,[{frame:o.startFrame+1,emo:'focused' as any},{frame:o.startFrame+Math.floor(o.frames*.65),emo:'proud'}]);
}
export function carryStream(o:AdvancedOpts):AdvancedResult {
 const out:SkeletonFrame[]=[],s=o.style;
 for(let i=0;i<o.frames;i++){const bob=Math.sin(i/o.fps*6)*2,y=ground(s)-bob;
 out.push(pose(s,o.x,y,o.facing,3,-2,{mode:'fk',sh:48,el:68},{mode:'fk',sh:-48,el:68},{mode:'ik',foot:[o.x-11,0]},{mode:'ik',foot:[o.x+11,0]}));}
 return result(out,[{frame:o.startFrame+1,emo:'focused' as any}]);
}
export function throwStream(o:AdvancedOpts):AdvancedResult {
 const out:SkeletonFrame[]=[],s=o.style,f=o.facing;
 for(let i=0;i<o.frames;i++){const t=clamp(i/Math.max(1,o.frames-1),0,1),reach=Math.sin(Math.PI*clamp(t*1.25,0,1));
 out.push(pose(s,o.x,ground(s)-reach*8,f,lerp(-8,18,easeInOut(t)),lerp(-8,12,t),{mode:'fk',sh:lerp(65,155,easeInOut(t)),el:lerp(70,12,t)},{mode:'fk',sh:lerp(30,15,t),el:35},{mode:'ik',foot:[o.x-11,0]},{mode:'ik',foot:[o.x+11,0]}));}
 return result(out,[{frame:o.startFrame+1,emo:'focused' as any},{frame:o.startFrame+Math.floor(o.frames*.55),emo:'happy'}]);
}
export function fallStream(o:AdvancedOpts):AdvancedResult {
 const out:SkeletonFrame[]=[],s=o.style,f=o.facing;
 for(let i=0;i<o.frames;i++){const t=clamp(i/Math.max(1,o.frames-1),0,1),drop=easeInOut(clamp(t/.72,0,1)),x=o.x+f*drop*25,y=ground(s)+drop*52,tilt=drop*72;
 out.push(pose(s,x,y,f,tilt,-18,{mode:'fk',sh:lerp(10,-105,drop),el:lerp(15,75,drop)},{mode:'fk',sh:lerp(-10,115,drop),el:lerp(15,80,drop)},{mode:'fk',hip:lerp(0,82,drop),knee:lerp(5,88,drop)},{mode:'fk',hip:lerp(0,95,drop),knee:lerp(5,80,drop)}));}
 return {frames:out,events:[{frame:o.startFrame+1,emo:'fear'},{frame:o.startFrame+Math.floor(o.frames*.65),emo:'sad'}],shake:[{frame:o.startFrame+Math.floor(o.frames*.55),amp:5,dur:.25}]};
}
export function getUpStream(o:AdvancedOpts):AdvancedResult {
 const out:SkeletonFrame[]=[],s=o.style;
 for(let i=0;i<o.frames;i++){const t=easeInOut(clamp(i/Math.max(1,o.frames-1),0,1)),y=ground(s)+lerp(52,0,t);
 out.push(pose(s,o.x,y,o.facing,lerp(72,0,t),lerp(-15,0,t),{mode:'fk',sh:lerp(-95,8,t),el:lerp(70,10,t)},{mode:'fk',sh:lerp(110,-8,t),el:lerp(72,10,t)},{mode:'fk',hip:lerp(85,0,t),knee:lerp(82,5,t)},{mode:'fk',hip:lerp(92,0,t),knee:lerp(80,5,t)}));}
 return result(out,[{frame:o.startFrame+1,emo:'sad'},{frame:o.startFrame+Math.floor(o.frames*.8),emo:'neutral'}]);
}
export function turnStream(o:AdvancedOpts & {facing:1|-1}):AdvancedResult {
 const out:SkeletonFrame[]=[],s=o.style;
 for(let i=0;i<o.frames;i++){const t=easeInOut(clamp(i/Math.max(1,o.frames-1),0,1)),f:1|-1=t<.5?o.facing===1?-1:1:o.facing,twist=Math.sin(Math.PI*t)*12;
 out.push(pose(s,o.x,ground(s),f,twist,twist*.35,{mode:'fk',sh:8,el:8},{mode:'fk',sh:-8,el:8},{mode:'ik',foot:[o.x-11,0]},{mode:'ik',foot:[o.x+11,0]}));}
 return result(out);
}

export function landStream(o:AdvancedOpts):AdvancedResult {
 const out:SkeletonFrame[]=[],s=o.style;
 for(let i=0;i<o.frames;i++){
  const t=clamp(i/Math.max(1,o.frames-1),0,1),compress=Math.sin(Math.PI*t),y=ground(s)+compress*16;
  out.push(pose(s,o.x,y,o.facing,-5+compress*9,4,
   {mode:'fk',sh:lerp(95,8,t),el:lerp(48,12,t)},
   {mode:'fk',sh:lerp(-95,-8,t),el:lerp(48,12,t)},
   {mode:'ik',foot:[o.x-11,0]},{mode:'ik',foot:[o.x+11,0]}));
 }
 return result(out,[{frame:o.startFrame+1,emo:'surprised'},{frame:o.startFrame+Math.floor(o.frames*.55),emo:'neutral'}]);
}
