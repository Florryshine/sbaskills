'use client';
import {useState} from 'react';
const starter=[
 {visual_cue:'How ionic bonding begins',text:'Ionic bonding usually happens when a metal transfers one or more electrons to a non-metal.'},
 {visual_cue:'Electron transfer: sodium to chlorine',text:'A sodium atom loses its outer electron. Chlorine gains that electron to complete its outer shell.'},
 {visual_cue:'Formation of Na plus and Cl minus',text:'Sodium becomes a positive ion, Na plus, while chlorine becomes a negative ion, Cl minus.'},
 {visual_cue:'Electrostatic attraction',text:'The oppositely charged ions attract each other strongly. This electrostatic force is ionic bonding.'}
];
export default function WhiteboardStudio(){
 const [title,setTitle]=useState('Ionic Bonding — JAMB Chemistry');const [scenes,setScenes]=useState(starter);const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');
 function edit(i,key,value){setScenes(old=>old.map((s,n)=>n===i?{...s,[key]:value}:s));}
 async function submit(){setBusy(true);setMessage('');try{const res=await fetch('/api/admin/whiteboard',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title,scenes})});const data=await res.json();if(!res.ok)throw new Error(data.error||'Save failed');setMessage('Test lesson saved to the video queue (ID: '+data.job.id+'). Rendering is not connected yet; the existing stock-video worker must not process this job.');}catch(e){setMessage(e.message);}finally{setBusy(false);}}
 return <main className="max-w-4xl mx-auto p-5 space-y-6"><header><p className="text-sm font-bold text-blue-700">SHINEY BRAIN ACADEMY</p><h1 className="text-3xl font-black">Whiteboard Studio</h1><p className="text-gray-600 mt-2">Draft a narrated whiteboard lesson. This is an isolated prototype.</p></header>
 <label className="block font-semibold">Lesson title<input className="mt-1 w-full border rounded-xl p-3" value={title} onChange={e=>setTitle(e.target.value)}/></label>
 {scenes.map((s,i)=><section key={i} className="border rounded-2xl p-4 space-y-3"><div className="flex justify-between"><h2 className="font-bold">Scene {i+1}</h2><button className="text-red-600 text-sm" onClick={()=>setScenes(old=>old.filter((_,n)=>n!==i))}>Remove</button></div><label className="block text-sm font-semibold">Board heading<input className="mt-1 w-full border rounded-lg p-2" value={s.visual_cue} onChange={e=>edit(i,'visual_cue',e.target.value)}/></label><label className="block text-sm font-semibold">Narration<textarea rows={3} className="mt-1 w-full border rounded-lg p-2" value={s.text} onChange={e=>edit(i,'text',e.target.value)}/></label></section>)}
 <div className="flex flex-wrap gap-3"><button onClick={()=>setScenes(old=>[...old,{visual_cue:'New whiteboard idea',text:''}])} disabled={scenes.length>=8} className="border rounded-xl px-4 py-3 font-semibold">+ Add scene</button><button onClick={submit} disabled={busy||scenes.length<2} className="bg-blue-700 text-white rounded-xl px-5 py-3 font-bold disabled:opacity-50">{busy?'Saving…':'Save test lesson'}</button></div>
 {message&&<p className="rounded-xl bg-blue-50 p-4 text-sm">{message}</p>}<p className="text-xs text-gray-500">No paid AI API is used. MP4 rendering and Nigerian-English narration are the next integration step; this prototype does not yet render a video.</p></main>;
}