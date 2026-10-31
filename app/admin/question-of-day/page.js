'use client';
import { useEffect, useState } from 'react';
import { createBrowserClient } from '@/lib/supabase';

export default function QuestionOfTheDayPage() {
  const [mode, setMode] = useState('bank');
  const [questions, setQuestions] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [subject, setSubject] = useState('');
  const [search, setSearch] = useState('');
  const [questionId, setQuestionId] = useState('');
  const [templateReady, setTemplateReady] = useState(false);
  const [templateFile, setTemplateFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [history, setHistory] = useState([]);
  const [active, setActive] = useState(null);
  const [error, setError] = useState('');
  const [manual, setManual] = useState({ subject:'Chemistry', topic:'', question:'', option_A:'', option_B:'', option_C:'', option_D:'', correctOptionId:'', explanation:'' });

  useEffect(() => {
    const db = createBrowserClient();
    db.from('past_questions').select('subject').then(({data}) => setSubjects([...new Set((data||[]).map(x=>x.subject).filter(Boolean))].sort()));
    checkTemplate(); loadHistory();
  }, []);
  async function checkTemplate(){ try{const r=await fetch('/api/admin/question-of-day/template');const j=await r.json();setTemplateReady(!!j.uploaded);}catch{} }
  async function loadHistory(){try{const r=await fetch('/api/admin/question-of-day');const j=await r.json();if(r.ok)setHistory(j.data||[]);}catch{}}
  async function searchQuestions(){
    setError('');
    let q=createBrowserClient().from('past_questions').select('id,subject,topic,year,question,option_a,option_b,option_c,option_d,correct_answer,explanation').limit(40).order('id',{ascending:false});
    if(subject) q=q.eq('subject',subject);
    if(search.trim()) q=q.ilike('question','%'+search.trim()+'%');
    const {data,error}=await q;
    if(error){setError(error.message);return;}
    setQuestions(data||[]);
  }
  async function uploadTemplate(){
    if(!templateFile)return;setUploading(true);setError('');
    try{const f=new FormData();f.append('template',templateFile);const r=await fetch('/api/admin/question-of-day/template',{method:'POST',body:f});const j=await r.json();if(!r.ok)throw new Error(j.error);setTemplateReady(true);setTemplateFile(null);}
    catch(e){setError(e.message);}finally{setUploading(false);}
  }
  async function render(selectedId){
    setRendering(true);setError('');setActive(null);
    try{const payload=selectedId?{questionId:selectedId}:manual;const r=await fetch('/api/admin/question-of-day',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const j=await r.json();if(!r.ok)throw new Error(j.error||'Could not render image');setActive(j.question);await loadHistory();}
    catch(e){setError(e.message);}finally{setRendering(false);}
  }
  function openHistory(item){setActive({id:item.id,question:item.body,subject:item.metadata?.subject,topic:item.metadata?.topic,options:item.metadata?.options||[],correctOptionId:item.metadata?.correctOptionId,explanation:item.metadata?.explanation,imageUrl:item.media_files?.[0]?.url||item.metadata?.image_url,caption:item.metadata?.caption});}
  const field='w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm';
  return <main className="mx-auto max-w-6xl space-y-5 p-4 md:p-6">
    <header><p className="text-xs font-bold uppercase tracking-widest text-yellow-600">Shiney Brain Academy</p><h1 className="mt-1 text-2xl font-extrabold text-brand-blue">Question of the Day</h1><p className="mt-1 text-sm text-gray-500">Choose a saved question or type your own. The classroom template stays the same.</p></header>
    <section className="rounded-2xl border bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-bold">Classroom template</h2><p className="text-xs text-gray-500">Upload once. Reuse every day.</p></div><span className={templateReady?'text-sm font-bold text-green-700':'text-sm font-bold text-amber-700'}>{templateReady?'✓ Template saved':'Template needed'}</span></div>
      {!templateReady&&<div className="mt-3 flex flex-wrap gap-2"><input type="file" accept="image/*" onChange={e=>setTemplateFile(e.target.files?.[0]||null)} className="flex-1 text-sm"/><button onClick={uploadTemplate} disabled={!templateFile||uploading} className="rounded-lg bg-brand-blue px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{uploading?'Saving…':'Save template'}</button></div>}
    </section>
    <section className="rounded-2xl border bg-white p-4">
      <div className="flex gap-2"><button onClick={()=>setMode('bank')} className={'rounded-full px-4 py-2 text-sm font-bold '+(mode==='bank'?'bg-brand-blue text-white':'bg-slate-100')}>Choose from question bank</button><button onClick={()=>setMode('manual')} className={'rounded-full px-4 py-2 text-sm font-bold '+(mode==='manual'?'bg-brand-blue text-white':'bg-slate-100')}>Type my own</button></div>
      {mode==='bank'?<div className="mt-4 space-y-3"><div className="grid gap-2 sm:grid-cols-[180px_1fr_auto]"><select className={field} value={subject} onChange={e=>setSubject(e.target.value)}><option value="">All subjects</option>{subjects.map(s=><option key={s}>{s}</option>)}</select><input className={field} placeholder="Search question text…" value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>e.key==='Enter'&&searchQuestions()}/><button onClick={searchQuestions} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white">Search bank</button></div>
        <div className="max-h-96 space-y-2 overflow-y-auto">{questions.map(q=><button key={q.id} onClick={()=>setQuestionId(q.id)} className={'w-full rounded-xl border p-3 text-left '+(questionId===q.id?'border-blue-500 bg-blue-50':'hover:bg-slate-50')}><span className="text-xs font-bold text-brand-blue">{q.subject} · {q.topic||'General'} {q.year?'· '+q.year:''}</span><span className="mt-1 block text-sm">{q.question}</span></button>)}</div>
        {questionId&&<button disabled={!templateReady||rendering} onClick={()=>render(questionId)} className="w-full rounded-xl bg-brand-blue px-4 py-3 font-bold text-white disabled:opacity-50">{rendering?'Rendering…':'Render selected question'}</button>}
      </div>:<div className="mt-4 space-y-3"><div className="grid gap-2 sm:grid-cols-2"><input className={field} placeholder="Subject" value={manual.subject} onChange={e=>setManual({...manual,subject:e.target.value})}/><input className={field} placeholder="Topic (optional)" value={manual.topic} onChange={e=>setManual({...manual,topic:e.target.value})}/></div><textarea className={field} rows="3" placeholder="Type the question…" value={manual.question} onChange={e=>setManual({...manual,question:e.target.value})}/>{['A','B','C','D'].map(id=><input key={id} className={field} placeholder={'Option '+id} value={manual['option_'+id]} onChange={e=>setManual({...manual,['option_'+id]:e.target.value})}/>)}
        <select className={field} value={manual.correctOptionId} onChange={e=>setManual({...manual,correctOptionId:e.target.value})}><option value="">Choose correct answer</option>{['A','B','C','D'].map(x=><option key={x} value={x}>Option {x}</option>)}</select><textarea className={field} rows="2" placeholder="Explanation (optional)" value={manual.explanation} onChange={e=>setManual({...manual,explanation:e.target.value})}/><button disabled={!templateReady||rendering} onClick={()=>render(null)} className="w-full rounded-xl bg-brand-blue px-4 py-3 font-bold text-white disabled:opacity-50">{rendering?'Rendering…':'Render my question'}</button></div>}
      {error&&<p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    </section>
    {active&&<section className="grid gap-4 rounded-2xl border bg-white p-4 lg:grid-cols-[minmax(0,380px)_1fr]"><img src={active.imageUrl} alt="Question image preview" className="w-full rounded-xl"/><div><h2 className="font-bold">Image ready — saved as a draft</h2><p className="mt-2 text-sm">{active.question}</p><div className="mt-3 space-y-2">{(active.options||[]).map(o=><p key={o.id} className="text-sm"><b>{o.id}.</b> {o.text} {o.id===active.correctOptionId?'✓':''}</p>)}</div><div className="mt-4 flex flex-wrap gap-2"><a href={active.imageUrl} target="_blank" rel="noreferrer" className="rounded-lg border px-4 py-2 text-sm font-bold">Open image</a><button onClick={()=>navigator.clipboard.writeText(active.caption||'')} className="rounded-lg border px-4 py-2 text-sm font-bold">Copy caption</button><a href="/admin/social-engine" className="rounded-lg bg-brand-blue px-4 py-2 text-sm font-bold text-white">Open Social Engine</a></div></div></section>}
    <section><div className="mb-2 flex justify-between"><h2 className="font-bold">Recent drafts</h2><button onClick={loadHistory} className="text-sm font-bold text-brand-blue">Refresh</button></div><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{history.map(item=><button key={item.id} onClick={()=>openHistory(item)} className="rounded-xl border bg-white p-3 text-left text-sm hover:border-blue-400"><b>{item.metadata?.subject||'Question'}</b><span className="mt-1 block line-clamp-2">{item.body}</span></button>)}</div></section>
  </main>;
}
