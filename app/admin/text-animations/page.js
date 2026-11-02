'use client';

import React, {useMemo, useState} from 'react';
import {Player} from '@remotion/player';
import {renderMediaOnWeb, canRenderMediaOnWeb} from '@remotion/web-renderer';
import {AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig, interpolate, spring, Easing} from 'remotion';

const PRESETS = [
  {id:'impact',name:'Impact',tag:'Big, bold, punchy',accent:'#facc15',bg:'#071426'},
  {id:'editorial',name:'Editorial',tag:'Clean, premium, dramatic',accent:'#f5a8a0',bg:'#171717'},
  {id:'neon',name:'Neon Rush',tag:'Electric, fast, energetic',accent:'#67e8f9',bg:'#09051d'},
  {id:'minimal',name:'Minimal',tag:'Sharp, modern, restrained',accent:'#a3e635',bg:'#101827'},
  {id:'cinematic',name:'Cinematic',tag:'Slow build, huge payoff',accent:'#fbbf24',bg:'#111827'},
];
const STARTERS = {
  impact:[
    {text:'YOU ARE NOT',emphasis:'NOT',durationSeconds:2.5},
    {text:'BAD AT CHEMISTRY',emphasis:'CHEMISTRY',durationSeconds:2.8},
    {text:'YOU JUST HAVE NOT',emphasis:'NOT',durationSeconds:2.5},
    {text:'SEEN IT THIS WAY',emphasis:'THIS WAY',durationSeconds:3},
  ],
  editorial:[
    {text:'The difference',emphasis:'difference',durationSeconds:2.5},
    {text:'is not talent.',emphasis:'not talent.',durationSeconds:2.5},
    {text:'It is the system',emphasis:'system',durationSeconds:2.5},
    {text:'you repeat.',emphasis:'repeat.',durationSeconds:3},
  ],
  neon:[
    {text:'STOP SCROLLING',emphasis:'STOP',durationSeconds:2},
    {text:'TEST YOUR BRAIN',emphasis:'BRAIN',durationSeconds:2.5},
    {text:'ONE QUESTION',emphasis:'ONE',durationSeconds:2},
    {text:'ONE RIGHT ANSWER',emphasis:'RIGHT',durationSeconds:3},
  ],
  minimal:[
    {text:'FOCUS',emphasis:'FOCUS',durationSeconds:2.5},
    {text:'IS A SKILL',emphasis:'SKILL',durationSeconds:2.5},
    {text:'TRAIN IT',emphasis:'TRAIN',durationSeconds:3},
  ],
  cinematic:[
    {text:'EVERY TOP STUDENT',emphasis:'TOP',durationSeconds:3},
    {text:'HAS A SECRET',emphasis:'SECRET',durationSeconds:3},
    {text:'THEY PRACTISE',emphasis:'PRACTISE',durationSeconds:3},
    {text:'WHEN OTHERS REST',emphasis:'REST',durationSeconds:3},
  ],
};
const clamp={extrapolateLeft:'clamp',extrapolateRight:'clamp'};
const totalFrames=(scenes)=>scenes.reduce((n,s)=>n+Math.max(30,Math.round((Number(s.durationSeconds)||2.5)*30)),0);

function Word({word,index,frame,preset,mode,accent}) {
  const delay=index*(mode==='cascade'?3:mode==='type'?2:4);
  const p=spring({frame:Math.max(0,frame-delay),fps:30,config:{damping:mode==='bounce'?8:15,stiffness:mode==='bounce'?180:120,mass:.7}});
  const opacity=interpolate(frame,[delay,delay+7],[0,1],clamp);
  const y=interpolate(p,[0,1],[mode==='rise'?90:mode==='drop'?-100:45,0]);
  const scale=interpolate(p,[0,1],[mode==='slam'?.25:.72,1]);
  const rotate=interpolate(p,[0,1],[mode==='slam'?-12:mode==='cascade'?8:0,0]);
  return <span style={{display:'inline-block',marginRight:'.22em',opacity,transform:`translate3d(0,${y}px,0) scale(${scale}) rotate(${rotate}deg)`,transformOrigin:'50% 80%',color:word.emphasis?accent:'#fff',textShadow:preset==='neon'?'0 0 28px '+accent+'88':'0 5px 0 #0005'}}>{word.text}</span>;
}

function KineticScene({scene,index,preset,brand,animation}) {
  const frame=useCurrentFrame(); const {fps}=useVideoConfig();
  const words=String(scene.text||'YOUR NEXT BIG IDEA').trim().split(/\s+/);
  const emphasis=String(scene.emphasis||'').toLowerCase();
  const reveal=interpolate(frame,[0,16],[0,1],clamp);
  const progress=interpolate(frame,[0,Math.max(1,(scene.durationSeconds||2.5)*fps)],[0,1],clamp);
  const mode=animation==='auto'?['cascade','rise','slam','bounce','type'][index%5]:animation;
  const titleSize=words.join(' ').length>34?8.2:words.join(' ').length>22?10:12;
  const isEditorial=preset==='editorial';
  const isNeon=preset==='neon';
  const isCinematic=preset==='cinematic';
  const bg=preset==='editorial'?'#171717':preset==='neon'?'#09051d':preset==='minimal'?'#101827':preset==='cinematic'?'#111827':'#071426';
  const drift=interpolate(frame,[0,90],[-3,3],{...clamp,easing:Easing.inOut(Easing.ease)});
  return <AbsoluteFill style={{background:bg,color:'#fff',fontFamily:isEditorial?'Georgia,serif':'Arial Black,Impact,sans-serif',overflow:'hidden'}}>
    <AbsoluteFill style={{opacity:.22,transform:`scale(1.2) rotate(${drift}deg)`,background:isNeon?`radial-gradient(circle at 50% 48%, ${preset.accent}55, transparent 48%)`:isCinematic?'radial-gradient(ellipse at 50% 90%, #475569, transparent 60%)':'radial-gradient(circle at 80% 20%, #2563eb55, transparent 45%)'}}/>
    <div style={{position:'absolute',inset:'7%',border:'1px solid '+(preset.accent+'55'),opacity:.7}}/>
    {isNeon&&<div style={{position:'absolute',width:'150%',height:3,background:preset.accent,top:'18%',left:'-20%',opacity:.45,transform:`rotate(-18deg) translateX(${Math.sin(frame/9)*60}px)`,boxShadow:'0 0 30px '+preset.accent}}/>}
    <div style={{position:'absolute',top:'7%',left:'8%',right:'8%',display:'flex',justifyContent:'space-between',alignItems:'center',fontFamily:'Arial,sans-serif',fontSize:18,fontWeight:900,letterSpacing:4,color:preset.accent,opacity:reveal}}>
      <span>{brand.toUpperCase()}</span><span>{String(index+1).padStart(2,'0')}</span>
    </div>
    {isEditorial&&<div style={{position:'absolute',top:'22%',left:'8%',fontSize:22,letterSpacing:8,color:preset.accent,opacity:reveal}}>A NOTE TO REMEMBER</div>}
    <div style={{position:'absolute',left:'7%',right:'7%',top:'31%',height:'42%',display:'flex',alignItems:'center',justifyContent:'center',textAlign:'center',fontSize:`min(17vw, ${titleSize}vh)`,lineHeight:1.03,fontWeight:1000,letterSpacing:isEditorial?'-0.06em':'-.045em',textTransform:isEditorial?'none':'uppercase',wordBreak:'normal'}}>
      <div style={{maxWidth:'100%'}}>{words.map((w,i)=><Word key={i} word={{text:w,emphasis:emphasis && emphasis.includes(w.toLowerCase().replace(/[.,!?]/g,''))}} index={i} frame={frame} preset={preset.id} mode={mode} accent={preset.accent}/>)}</div>
    </div>
    <div style={{position:'absolute',left:'9%',right:'9%',bottom:'17%',height:5,background:'#ffffff22',overflow:'hidden'}}><div style={{height:'100%',width:(progress*100)+'%',background:preset.accent}}/></div>
    <div style={{position:'absolute',left:'9%',bottom:'9%',fontFamily:'Arial,sans-serif',fontSize:16,fontWeight:800,letterSpacing:3,color:'#ffffff99'}}>THINK BIG. LEARN SMARTER.</div>
    {isCinematic&&<div style={{position:'absolute',inset:0,background:'linear-gradient(0deg,#0008,transparent 35%,transparent 70%,#0007)',pointerEvents:'none'}}/>}
  </AbsoluteFill>;
}

export function TextAnimationsComposition({scenes=[],preset='impact',brand='SHINEY BRAIN ACADEMY',animation='auto'}) {
 const selected=PRESETS.find(p=>p.id===preset)||PRESETS[0]; let from=0;
 return <AbsoluteFill>{scenes.map((scene,index)=>{const duration=Math.max(30,Math.round((Number(scene.durationSeconds)||2.5)*30));const start=from;from+=duration;return <Sequence key={scene.id||index} from={start} durationInFrames={duration}><KineticScene scene={scene} index={index} preset={selected} brand={brand} animation={animation}/></Sequence>;})}</AbsoluteFill>;
}

export default function TextAnimationsPage() {
 const [preset,setPreset]=useState('impact');
 const [animation,setAnimation]=useState('auto');
 const [scenes,setScenes]=useState(STARTERS.impact.map((s,i)=>({...s,id:String(i+1)})));
 const [brand,setBrand]=useState('SHINEY BRAIN ACADEMY');
 const [ratio,setRatio]=useState('vertical');
 const [status,setStatus]=useState('');
 const [busy,setBusy]=useState(false);
 const fps=30,width=ratio==='vertical'?1080:1920,height=ratio==='vertical'?1920:1080;
 const frames=Math.max(30,totalFrames(scenes));
 const props=useMemo(()=>({scenes,preset,brand,animation}),[scenes,preset,brand,animation]);
 const update=(i,key,value)=>setScenes(old=>old.map((s,n)=>n===i?{...s,[key]:value}:s));
 function choosePreset(id){setPreset(id);setScenes(STARTERS[id].map((s,i)=>({...s,id:String(i+1)})));setStatus('Loaded '+(PRESETS.find(p=>p.id===id)?.name||'')+' starter sequence. Edit the words to make it yours.');}
 async function exportMp4(){
  setBusy(true);setStatus('Checking MP4 support…');
  try{
   if(!('VideoEncoder'in window))throw new Error('This browser does not support WebCodecs. Try an updated Chrome browser.');
   if(!await canRenderMediaOnWeb({codec:'h264',container:'mp4'}))throw new Error('MP4/H.264 export is not supported in this browser. Try current Chrome on a laptop.');
   setStatus('Rendering your kinetic typography video on this device…');
   const result=await renderMediaOnWeb({composition:{id:'SBA-Text-Animations',component:TextAnimationsComposition,durationInFrames:frames,fps,width,height},inputProps:props,videoCodec:'h264',container:'mp4',pageResponsiveness:'medium',onProgress:({progress})=>setStatus('Rendering… '+Math.round(progress*100)+'%')});
   const blob=await result.getBlob();const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='sba-text-animation-'+Date.now()+'.mp4';a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);setStatus('MP4 exported. Check your Downloads folder.');
  }catch(e){setStatus(e?.message||'Export failed.');}finally{setBusy(false);}
 }
 return <main className="mx-auto max-w-7xl space-y-5 pb-16">
  <header className="overflow-hidden rounded-3xl bg-slate-950 p-6 text-white sm:p-8"><p className="text-xs font-black tracking-[.3em] text-yellow-300">SHINEY BRAIN ACADEMY • MOTION DESIGN</p><h1 className="mt-3 text-4xl font-black sm:text-5xl">Text Animations</h1><p className="mt-3 max-w-2xl text-slate-300">Build bold kinetic typography videos with word-by-word movement, dramatic entrances, animated backgrounds and clean scene timing. Preview and export MP4 inside SBA.</p><div className="mt-6 flex flex-wrap gap-2 text-xs font-bold"><span className="rounded-full border border-white/20 px-3 py-1.5">5 visual directions</span><span className="rounded-full border border-white/20 px-3 py-1.5">5 motion styles</span><span className="rounded-full border border-white/20 px-3 py-1.5">MP4 export</span></div></header>
  <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(340px,.85fr)]">
   <section className="space-y-5 rounded-2xl border bg-white p-4 sm:p-6">
    <div><div className="flex items-center justify-between"><h2 className="font-black text-slate-900">1. Choose a visual direction</h2><span className="text-xs text-slate-500">Starter scenes reload</span></div><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">{PRESETS.map(p=><button key={p.id} onClick={()=>choosePreset(p.id)} className={'rounded-xl border p-3 text-left transition '+(preset===p.id?'border-slate-950 ring-2 ring-slate-900':'hover:bg-slate-50')}><span className="mb-2 block h-8 rounded-lg" style={{background:p.bg,border:'1px solid '+p.accent}}/><b className="block text-sm">{p.name}</b><span className="text-xs text-slate-500">{p.tag}</span></button>)}</div></div>
    <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-bold">Motion behaviour<select value={animation} onChange={e=>setAnimation(e.target.value)} className="mt-1 w-full rounded-xl border p-3"><option value="auto">Auto mix — vary each scene</option><option value="cascade">Word cascade</option><option value="rise">Rise and reveal</option><option value="slam">Dramatic slam</option><option value="bounce">Elastic bounce</option><option value="type">Type-on rhythm</option><option value="drop">Drop-in</option></select></label><label className="text-sm font-bold">Video format<select value={ratio} onChange={e=>setRatio(e.target.value)} className="mt-1 w-full rounded-xl border p-3"><option value="vertical">9:16 — Reels / TikTok / Shorts</option><option value="horizontal">16:9 — YouTube</option></select></label></div>
    <label className="block text-sm font-bold">Brand label<input value={brand} onChange={e=>setBrand(e.target.value)} className="mt-1 w-full rounded-xl border p-3"/></label>
    <div className="flex items-center justify-between"><h2 className="font-black">2. Write your scenes</h2><span className="text-xs text-slate-500">{scenes.length} scenes · {Math.round(frames/fps)} sec</span></div>
    <div className="space-y-3">{scenes.map((s,i)=><article key={s.id} className="space-y-2 rounded-xl border bg-slate-50 p-3"><div className="flex items-center justify-between"><b className="text-sm">Scene {String(i+1).padStart(2,'0')}</b><button onClick={()=>setScenes(old=>old.filter((_,n)=>n!==i))} className="text-xs font-bold text-red-600">Remove</button></div><textarea rows={2} maxLength={100} value={s.text} onChange={e=>update(i,'text',e.target.value)} placeholder="Write a short, punchy line…" className="w-full rounded-lg border bg-white p-3 text-base font-bold"/><div className="grid grid-cols-2 gap-2"><label className="text-xs font-bold text-slate-600">Emphasise these words<input value={s.emphasis||''} onChange={e=>update(i,'emphasis',e.target.value)} placeholder="e.g. CHEMISTRY" className="mt-1 w-full rounded-lg border bg-white p-2.5 text-sm"/></label><label className="text-xs font-bold text-slate-600">Duration (seconds)<input type="number" min="1" max="12" step=".5" value={s.durationSeconds} onChange={e=>update(i,'durationSeconds',Math.max(1,Math.min(12,Number(e.target.value)||1)))} className="mt-1 w-full rounded-lg border bg-white p-2.5 text-sm"/></label></div></article>)}</div>
    <button onClick={()=>setScenes(old=>[...old,{id:Date.now().toString(),text:'YOUR NEXT LINE GOES HERE',emphasis:'NEXT',durationSeconds:2.5}])} disabled={scenes.length>=12} className="w-full rounded-xl border border-dashed border-slate-400 p-3 font-bold text-slate-700 disabled:opacity-40">+ Add scene</button>
   </section>
   <aside className="space-y-4">
    <div className="rounded-2xl border bg-white p-4 sm:p-5"><div className="mb-3 flex items-center justify-between"><h2 className="font-black">Live motion preview</h2><span className="text-xs text-slate-500">{width} × {height}</span></div><div className="mx-auto overflow-hidden rounded-xl bg-black" style={{width:'100%',maxWidth:ratio==='vertical'?340:640}}><Player component={TextAnimationsComposition} inputProps={props} durationInFrames={frames} fps={fps} compositionWidth={width} compositionHeight={height} controls loop style={{width:'100%',aspectRatio:ratio==='vertical'?'9 / 16':'16 / 9'}}/></div><p className="mt-3 text-xs text-slate-500">Use Play to inspect the word entrances and scene transitions. Preview updates as you edit.</p></div>
    <div className="rounded-2xl border bg-white p-4 sm:p-5"><h2 className="font-black">3. Export your video</h2><p className="mt-1 text-sm text-slate-600">Renders an MP4 directly in this browser using the existing Remotion WebCodecs pipeline.</p><button onClick={exportMp4} disabled={busy||!scenes.length} className="mt-4 w-full rounded-xl bg-slate-950 px-5 py-4 font-black text-white disabled:opacity-50">{busy?'Rendering…':'Export MP4'}</button>{status&&<p aria-live="polite" className="mt-3 rounded-lg bg-slate-100 p-3 text-sm text-slate-800">{status}</p>}<p className="mt-3 text-xs text-slate-500">Keep this page open during export. High-resolution rendering may work better on a laptop than a phone.</p></div>
   </aside>
  </div>
 </main>;
}
