'use client';
import React,{useMemo,useRef,useState} from 'react';
import {Player} from '@remotion/player';
import {renderMediaOnWeb,canRenderMediaOnWeb} from '@remotion/web-renderer';
import {StudioComposition} from '@/remotion/StudioComposition';

const examples={
 explainer:[{heading:'What is photosynthesis?',text:'Plants use sunlight, water and carbon dioxide to make glucose and release oxygen.',durationSeconds:5},{heading:'Where does it happen?',text:'The process takes place mainly in chloroplasts, which contain chlorophyll.',durationSeconds:5},{heading:'Remember this for JAMB',text:'Light energy is converted into chemical energy stored in glucose.',durationSeconds:5}],
 whiteboard:[{heading:'Understand the big idea',text:'Break a difficult topic into clear steps. Explain one idea at a time.',durationSeconds:6},{heading:'Connect the steps',text:'Use diagrams, arrows and examples to show how ideas relate.',durationSeconds:6}],
 question:[{heading:'Which organelle is the site of photosynthesis?',text:'Choose the correct answer. Pause before checking.',options:['Mitochondrion','Chloroplast','Ribosome','Nucleus'],durationSeconds:7},{heading:'Correct answer: Chloroplast',text:'Chloroplasts contain chlorophyll, which absorbs light energy for photosynthesis.',durationSeconds:6}],
 story:[{heading:'She had one more chance.',text:'The exam was three weeks away. Every failed mock felt like proof that she could not do it.',durationSeconds:6},{heading:'Then she changed her strategy.',text:'One topic. One focused session. One timed test every day. Small wins began to add up.',durationSeconds:6}]
};
const choices=[['explainer','Educational explainer'],['whiteboard','Whiteboard lesson'],['question','JAMB question'],['story','Story / reel']];
const totalFrames=s=>s.reduce((n,x)=>n+Math.max(60,Math.round((Number(x.durationSeconds)||5)*30)),0);
export default function VideoStudio(){
 const [kind,setKind]=useState('explainer'),[scenes,setScenes]=useState(examples.explainer),[title,setTitle]=useState('Photosynthesis — JAMB Biology'),[ratio,setRatio]=useState('vertical'),[accent,setAccent]=useState('#f4c542'),[brand,setBrand]=useState('SHINEY BRAIN ACADEMY'),[status,setStatus]=useState(''),[busy,setBusy]=useState(false),[audio,setAudio]=useState(null);
 const fileRef=useRef(null),audioUrl=useMemo(()=>audio?URL.createObjectURL(audio):null,[audio]),fps=30,frames=totalFrames(scenes),width=ratio==='vertical'?1080:1920,height=ratio==='vertical'?1920:1080;
 const props={title,scenes:scenes.map((s,i)=>({...s,audioSrc:i===0?audioUrl:null})),template:kind,brand,accent};
 const edit=(i,k,v)=>setScenes(old=>old.map((s,n)=>n===i?{...s,[k]:v}:s));
 function selectKind(k){setKind(k);setScenes(examples[k].map(s=>({...s})));setTitle(({explainer:'Educational Explainer',whiteboard:'Whiteboard Lesson',question:'JAMB Practice Question',story:'A Story That Matters'})[k]);}
 async function exportMp4(){
  setBusy(true);setStatus('Checking browser support…');
  try{
   if(!('VideoEncoder'in window))throw new Error('This browser does not support WebCodecs video encoding. Try an updated Chrome browser.');
   const supported=await canRenderMediaOnWeb({codec:'h264',container:'mp4'});
   if(!supported)throw new Error('MP4/H.264 export is not supported by this browser. Try current Chrome on a laptop.');
   setStatus('Rendering on this device. Keep this tab open…');
   const result=await renderMediaOnWeb({composition:{id:'ShineyBrainStudio',component:StudioComposition,durationInFrames:frames,fps,width,height,calculateMetadata:null},inputProps:props,codec:'h264',container:'mp4'});
   const blob=await result.getBlob(),url=URL.createObjectURL(blob),a=document.createElement('a');
   a.href=url;a.download=(title||'shiney-brain-video').replace(/[^a-z0-9-_]+/gi,'-').toLowerCase()+'.mp4';a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);setStatus('MP4 exported. Check your Downloads folder.');
  }catch(e){setStatus(e?.message||'Export failed.');}finally{setBusy(false);}
 }
 return <main className="mx-auto max-w-7xl space-y-5 pb-16">
  <header className="rounded-3xl bg-gradient-to-r from-blue-950 via-blue-800 to-blue-600 p-6 text-white sm:p-8"><div className="text-xs font-black tracking-[.25em] text-yellow-300">SHINEY BRAIN ACADEMY</div><h1 className="mt-2 text-3xl font-black sm:text-4xl">Video Studio</h1><p className="mt-2 max-w-2xl text-blue-100">Create educational videos, whiteboard lessons, JAMB questions and story reels. Preview and export MP4 directly in your browser.</p></header>
  <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(340px,.85fr)]">
   <section className="space-y-4 rounded-2xl border bg-white p-4 sm:p-6">
    <div><h2 className="font-extrabold">1. Choose a format</h2><div className="mt-3 grid grid-cols-2 gap-2">{choices.map(([k,label])=><button key={k} onClick={()=>selectKind(k)} className={'rounded-xl border p-3 text-left text-sm font-bold '+(kind===k?'border-blue-700 bg-blue-50 text-blue-800':'hover:bg-slate-50')}>{label}</button>)}</div></div>
    <label className="block text-sm font-bold">Video title<input value={title} onChange={e=>setTitle(e.target.value)} className="mt-1 w-full rounded-xl border p-3"/></label>
    <div className="grid grid-cols-2 gap-3"><label className="text-sm font-bold">Aspect ratio<select value={ratio} onChange={e=>setRatio(e.target.value)} className="mt-1 w-full rounded-xl border p-3"><option value="vertical">9:16 — Reels / TikTok</option><option value="horizontal">16:9 — YouTube</option></select></label><label className="text-sm font-bold">Accent colour<input type="color" value={accent} onChange={e=>setAccent(e.target.value)} className="mt-1 h-12 w-full rounded-xl border p-1"/></label></div>
    <label className="block text-sm font-bold">Brand name<input value={brand} onChange={e=>setBrand(e.target.value)} className="mt-1 w-full rounded-xl border p-3"/></label>
    <div className="flex items-center justify-between"><h2 className="font-extrabold">2. Edit scenes</h2><span className="text-xs text-slate-500">{scenes.length}/12</span></div>
    {scenes.map((s,i)=><article key={i} className="space-y-2 rounded-xl border bg-slate-50 p-3"><div className="flex justify-between"><b className="text-sm">Scene {i+1}</b><button onClick={()=>setScenes(old=>old.filter((_,n)=>n!==i))} className="text-xs font-bold text-red-600">Remove</button></div><input value={s.heading||''} onChange={e=>edit(i,'heading',e.target.value)} placeholder="Heading" className="w-full rounded-lg border bg-white p-2.5 font-semibold"/><textarea rows={3} value={s.text||''} onChange={e=>edit(i,'text',e.target.value)} placeholder="Scene text / narration" className="w-full rounded-lg border bg-white p-2.5"/>{kind==='question'&&<input value={(s.options||[]).join(' | ')} onChange={e=>edit(i,'options',e.target.value.split('|').map(x=>x.trim()).filter(Boolean))} placeholder="Options separated by |" className="w-full rounded-lg border bg-white p-2.5"/>}<label className="flex items-center gap-2 text-xs text-slate-600">Duration <input type="number" min="2" max="30" value={s.durationSeconds||5} onChange={e=>edit(i,'durationSeconds',Math.max(2,Math.min(30,Number(e.target.value)||2)))} className="w-20 rounded-lg border bg-white p-2"/> seconds</label></article>)}
    <button onClick={()=>setScenes(old=>[...old,{heading:'New scene',text:'Add your explanation here.',durationSeconds:5}])} disabled={scenes.length>=12} className="w-full rounded-xl border border-dashed border-blue-400 p-3 font-bold text-blue-700 disabled:opacity-40">+ Add scene</button>
    <div className="rounded-xl border p-3"><b className="text-sm">3. Add narration audio (optional)</b><p className="mt-1 text-xs text-slate-500">Upload an MP3/WAV. It plays with the first scene. Text-to-speech is not yet connected in this browser version.</p><input ref={fileRef} type="file" accept="audio/*" onChange={e=>setAudio(e.target.files?.[0]||null)} className="mt-2 block w-full text-sm"/>{audio&&<button onClick={()=>{setAudio(null);if(fileRef.current)fileRef.current.value='';}} className="mt-2 text-xs font-bold text-red-600">Remove audio</button>}</div>
   </section>
   <aside className="space-y-4"><div className="rounded-2xl border bg-white p-4 sm:p-5"><div className="mb-3 flex justify-between"><h2 className="font-extrabold">Live preview</h2><span className="text-xs text-slate-500">{ratio==='vertical'?'9:16':'16:9'}</span></div><div className="mx-auto overflow-hidden rounded-xl bg-slate-900" style={{width:'100%',maxWidth:ratio==='vertical'?360:600}}><Player component={StudioComposition} inputProps={props} durationInFrames={frames} fps={fps} compositionWidth={width} compositionHeight={height} controls loop style={{width:'100%',aspectRatio:ratio==='vertical'?'9 / 16':'16 / 9'}}/></div><p className="mt-3 text-xs text-slate-500">About {Math.ceil(frames/fps)} seconds • {width} × {height}</p></div>
    <div className="rounded-2xl border bg-white p-4 sm:p-5"><h2 className="font-extrabold">4. Export MP4</h2><p className="mt-1 text-sm text-slate-600">Remotion renders the actual video file on this device using WebCodecs — no screen recording or rendering server.</p><button onClick={exportMp4} disabled={busy||!scenes.length} className="mt-4 w-full rounded-xl bg-blue-700 px-5 py-4 font-extrabold text-white shadow hover:bg-blue-800 disabled:opacity-50">{busy?'Rendering…':'Export MP4'}</button>{status&&<p aria-live="polite" className="mt-3 rounded-lg bg-blue-50 p-3 text-sm text-blue-900">{status}</p>}<p className="mt-3 text-xs text-slate-500">Keep this page open. Longer videos and high resolutions need more memory; use a laptop if your phone struggles.</p></div>
   </aside>
  </div>
 </main>;
}
