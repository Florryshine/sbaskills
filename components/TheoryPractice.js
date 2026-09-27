'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function TheoryPractice({ subject, topic, questions }) {
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [revealed, setRevealed] = useState(false);
  const q = questions[index];

  if (!q) return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-3xl px-4 py-16">
        <Link href={`/waec-neco/study/${encodeURIComponent(subject)}/${encodeURIComponent(topic)}`} className="font-bold text-brand-blue">← Back to topic</Link>
        <div className="mt-8 rounded-3xl border border-dashed bg-white p-10 text-center">
          <div className="text-4xl">✍️</div>
          <h1 className="mt-3 text-2xl font-black text-brand-blue">Theory practice isn't published yet</h1>
          <p className="mt-2 text-slate-500">Once a theory question is published for this topic, it will appear here.</p>
        </div>
      </div>
    </main>
  );

  const next = () => { setIndex(i => Math.min(i + 1, questions.length - 1)); setAnswer(''); setRevealed(false); };

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Link href={`/waec-neco/study/${encodeURIComponent(subject)}/${encodeURIComponent(topic)}`} className="text-sm font-bold text-brand-blue">← Back to {topic}</Link>
        <div className="mt-5 rounded-3xl bg-brand-blue p-7 text-white">
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-brand-yellow">WAEC & NECO • THEORY</p>
          <h1 className="mt-2 text-3xl font-black">{topic}</h1>
          <p className="mt-2 text-blue-100">Question {index + 1} of {questions.length}</p>
        </div>

        <section className="mt-5 rounded-3xl border bg-white p-7 shadow-sm">
          <div className="flex flex-wrap gap-2 text-xs font-bold">
            {q.exam_type.map(x => <span key={x} className="rounded-full bg-brand-blue/10 px-2 py-1 text-brand-blue">{x}</span>)}
          </div>
          <h2 className="mt-5 text-xl font-black text-slate-900">{q.question}</h2>
          <textarea value={answer} onChange={e=>setAnswer(e.target.value)} rows={9} placeholder="Write your answer here before checking the marking points..." className="mt-5 w-full rounded-2xl border p-4" />
          {!revealed ? (
            <button onClick={()=>setRevealed(true)} className="mt-4 rounded-xl bg-brand-yellow px-5 py-3 font-black">Reveal marking guide</button>
          ) : (
            <div className="mt-6 space-y-5">
              <div className="rounded-2xl bg-slate-50 p-5">
                <h3 className="font-black text-brand-blue">Marking points</h3>
                <ul className="mt-3 list-disc space-y-2 pl-5 text-slate-700">{(q.marking_points || []).map((p,i)=><li key={i}>{p}</li>)}</ul>
              </div>
              {q.model_answer && <div className="rounded-2xl border p-5"><h3 className="font-black text-brand-blue">Model answer</h3><p className="mt-3 whitespace-pre-wrap leading-7 text-slate-700">{q.model_answer}</p></div>}
              {q.explanation && <div className="rounded-2xl border p-5"><h3 className="font-black text-brand-blue">Examiner tip</h3><p className="mt-3 whitespace-pre-wrap leading-7 text-slate-700">{q.explanation}</p></div>}
            </div>
          )}
        </section>

        <div className="mt-5 flex justify-between gap-3">
          <button onClick={()=>{setIndex(i=>Math.max(i-1,0));setAnswer('');setRevealed(false)}} disabled={index===0} className="rounded-xl bg-white px-5 py-3 font-bold disabled:opacity-40">← Previous</button>
          <button onClick={next} disabled={index===questions.length-1} className="rounded-xl bg-brand-blue px-5 py-3 font-bold text-white disabled:opacity-40">Next →</button>
        </div>
      </div>
    </main>
  );
}
