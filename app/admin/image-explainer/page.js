'use client';

import { useState } from 'react';
import Link from 'next/link';

const MODES=[
 ['educational','Educational explainer'],['product_ad','Product advertisement'],
 ['product_demo','Product demonstration'],['scientific','Scientific explanation'],
 ['technical','Technical explanation'],['documentary','Documentary'],['general','General explainer']
];

export default function ImageExplainerStudioPage(){
 const [file,setFile]=useState(null),[preview,setPreview]=useState(''),[mode,setMode]=useState('educational');
 const [instruction,setInstruction]=useState('Explain the important parts of this image and use supporting visuals where helpful.');
 const [title,setTitle]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[job,setJob]=useState(null);
 const [jobs,setJobs]=useState([]);
 async function loadJobs(){try{const r=await fetch('/api/admin/image-explainer',{cache:'no-store'});const d=await r.json();if(r.ok)setJobs(d.jobs||[]);}catch{}}
 async function submit(e){
  e.preventDefault();if(!file)return;setBusy(true);setError('');setJob(null);
  try{
   const form=new FormData();form.append('image',file);form.append('productionMode',mode);
   form.append('instruction',instruction);form.append('title',title||file.name);form.append('aspect','16:9');form.append('duration','90');
   const r=await fetch('/api/admin/image-explainer',{method:'POST',body:form});const d=await r.json();
   if(!r.ok)throw new Error(d.error||'Image analysis failed.');
   setJob(d.job);await loadJobs();
  }catch(err){setError(err.message||'Could not analyse image.');}finally{setBusy(false);}
 }
 function onFile(f){if(!f)return;setFile(f);setPreview(URL.createObjectURL(f));setJob(null);setError('');}
 return <main className="min-h-screen bg-slate-950 text-white px-4 py-8">
  <div className="mx-auto max-w-6xl">
   <Link href="/admin" className="text-sm text-sky-300 hover:text-sky-200">← Admin dashboard</Link>
   <header className="mt-5 mb-8"><p className="text-xs uppercase tracking-[.24em] text-sky-300">Shiney Brain Academy · Video production</p>
    <h1 className="mt-2 text-3xl md:text-4xl font-bold">Image-to-Explainer Studio</h1>
    <p className="mt-2 max-w-3xl text-slate-400">Turn a diagram, product photo or technical image into an intelligent visual explanation. Start by analysing the image and reviewing what the AI detects.</p>
   </header>
   <div className="grid gap-6 lg:grid-cols-[1.05fr_.95fr]">
    <form onSubmit={submit} className="rounded-2xl border border-slate-800 bg-slate-900 p-5 space-y-5">
     <div><label className="mb-2 block text-sm font-semibold">Upload an image</label>
      <label className="flex min-h-64 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-700 bg-slate-950/70 p-5 text-center hover:border-sky-500">
       {preview?<img src={preview} alt="Uploaded source preview" className="max-h-72 max-w-full rounded-lg object-contain"/>:<><span className="text-4xl">＋</span><span className="mt-3 font-medium">Choose a JPG, PNG or WEBP image</span><span className="mt-1 text-xs text-slate-500">Maximum 10 MB · labelled diagrams work especially well</span></>}
       <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e=>onFile(e.target.files?.[0])}/>
      </label>
     </div>
     <div><label className="mb-2 block text-sm font-semibold">Production mode</label><select value={mode} onChange={e=>setMode(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 p-3">{MODES.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></div>
     <div><label className="mb-2 block text-sm font-semibold">Project title (optional)</label><input value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. Understanding the human heart" className="w-full rounded-lg border border-slate-700 bg-slate-950 p-3"/></div>
     <div><label className="mb-2 block text-sm font-semibold">What should the video explain?</label><textarea value={instruction} onChange={e=>setInstruction(e.target.value)} rows={3} className="w-full rounded-lg border border-slate-700 bg-slate-950 p-3"/></div>
     {error?<p className="rounded-lg bg-red-950 p-3 text-sm text-red-200">{error}</p>:null}
     <button disabled={!file||busy} className="w-full rounded-xl bg-sky-500 px-4 py-3 font-semibold text-slate-950 disabled:opacity-50">{busy?'Analysing image…':'Analyse image'}</button>
     <p className="text-xs text-slate-500">This first step identifies visible components and their positions. Script, storyboard and rendering become available after the production pipeline is connected.</p>
    </form>
    <section className="space-y-5">
     <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <h2 className="text-lg font-semibold">Image understanding</h2>
      {!job?<p className="mt-3 text-sm text-slate-400">Upload an image and choose Analyse image to inspect detected labels, components and regions.</p>:<>
       <p className="mt-3 text-xl font-semibold text-sky-300">{job.vision_analysis?.subject||job.title}</p>
       <p className="mt-2 text-sm text-slate-300">{job.vision_analysis?.summary}</p>
       <div className="mt-3 flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-slate-800 px-3 py-1">{job.vision_analysis?.image_type||'image'}</span><span className="rounded-full bg-slate-800 px-3 py-1">Confidence {Math.round((job.vision_analysis?.confidence||0)*100)}%</span><span className="rounded-full bg-slate-800 px-3 py-1">{job.vision_analysis?.provider}</span></div>
       <h3 className="mt-5 font-semibold">Detected components ({job.vision_analysis?.components?.length||0})</h3>
       <div className="mt-2 max-h-[28rem] space-y-3 overflow-auto">{(job.vision_analysis?.components||[]).map((c,i)=><article key={i} className="rounded-xl border border-slate-800 bg-slate-950 p-3"><div className="flex items-start justify-between gap-3"><h4 className="font-semibold">{c.name}</h4><span className="text-xs text-slate-500">{Math.round(c.confidence*100)}%</span></div><p className="mt-1 text-sm text-slate-400">{c.description}</p><p className="mt-1 text-sm text-slate-300">{c.function}</p>{c.needs_verification?<p className="mt-2 text-xs text-amber-300">Needs verification</p>:null}<p className="mt-2 text-[11px] text-slate-500">Region: {Math.round(c.region.x)}, {Math.round(c.region.y)} · {Math.round(c.region.width)} × {Math.round(c.region.height)} px</p></article>)}</div>
       {(job.vision_analysis?.uncertainties||[]).length?<p className="mt-4 text-xs text-amber-300">Uncertainties: {job.vision_analysis.uncertainties.join(' · ')}</p>:null}
      </>}
     </div>
     <div className="rounded-2xl border border-amber-900/50 bg-amber-950/30 p-4 text-sm text-amber-100"><strong>Production status:</strong> This commit establishes secure upload, persistent projects and vision analysis. The research/storyboard/narration/render worker is the next implementation stage; no video is claimed to be generated yet.</div>
     <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><div className="flex items-center justify-between"><h2 className="font-semibold">Recent projects</h2><button onClick={loadJobs} type="button" className="text-xs text-sky-300">Refresh</button></div><div className="mt-3 space-y-2">{jobs.map(j=><button key={j.id} type="button" onClick={()=>setJob(j)} className="block w-full rounded-lg bg-slate-950 p-3 text-left"><span className="block text-sm">{j.title}</span><span className="text-xs text-slate-500">{j.status} · {new Date(j.created_at).toLocaleString()}</span></button>)}</div></div>
    </section>
   </div>
  </div>
 </main>;
}
