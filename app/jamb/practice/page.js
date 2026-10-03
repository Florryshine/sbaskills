'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { createBrowserClient } from '@/lib/supabase';
import { addPoints } from '@/lib/gamification';

const PRACTICE_SIZE = 10;
function shuffle(items) { return [...items].sort(() => Math.random() - 0.5); }
function getInitialParam(name) { return typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get(name) || ''; }

export default function JAMBPracticePage() {
  const router = useRouter();
  const supabase = createBrowserClient();
  const [subject, setSubject] = useState(() => getInitialParam('subject'));
  const [topic, setTopic] = useState(() => getInitialParam('topic'));
  const mode = topic ? 'topic' : subject ? 'subject' : 'mixed';
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => { setSubject(getInitialParam('subject')); setTopic(getInitialParam('topic')); }, []);
  useEffect(() => {
    async function load() {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return router.push('/login');
      setUser(auth.user);
      let query = supabase.from('past_questions').select('id, subject, topic, year, question, option_a, option_b, option_c, option_d, correct_answer, explanation').eq('exam_type', 'JAMB');
      if (subject) query = query.eq('subject', subject);
      if (topic) query = query.eq('topic', topic);
      const { data, error } = await query.limit(500);
      if (error) console.error('JAMB practice load error:', error);
      setQuestions(shuffle(data || []).slice(0, PRACTICE_SIZE));
      setLoading(false);
    }
    load();
  }, [subject, topic]);

  const current = questions[currentIndex];
  const title = topic || subject || 'Mixed JAMB Practice';
  const subtitle = topic ? (subject ? `${subject} • ${topic}` : topic) : (subject || 'Mixed JAMB subjects');
  const submit = async () => {
    if (saving || submitted || !questions.length || !user) return;
    setSaving(true);
    let correct = 0; const weakTopicCounts = {};
    questions.forEach((q) => { if (answers[q.id]?.toLowerCase() === q.correct_answer?.toLowerCase()) correct++; else if (q.topic) weakTopicCounts[q.topic] = (weakTopicCounts[q.topic] || 0) + 1; });
    const total = questions.length; const accuracy = Math.round((correct / total) * 100);
    const weakTopics = Object.entries(weakTopicCounts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name]) => name);
    const { error } = await supabase.from('jamb_practice_attempts').insert({ user_id: user.id, mode, subject: subject || null, topic: topic || null, question_ids: questions.map((q) => q.id), answers, score: correct, total_questions: total, weak_topics: weakTopics });
    if (!error) await addPoints(user.id, 10, 'Completed JAMB practice', 'jamb_practice'); else console.error('JAMB practice save error:', error);
    setResult({ correct, total, accuracy, weakTopics }); setSubmitted(true); setSaving(false);
  };

  if (loading) return <><Navbar /><main className="min-h-screen flex items-center justify-center bg-slate-50"><p className="font-bold text-brand-blue">Loading your practice set...</p></main><Footer /></>;
  if (!questions.length) return <><Navbar /><main className="min-h-screen bg-slate-50 py-16"><div className="mx-auto max-w-2xl px-4 text-center"><p className="text-5xl">📚</p><h1 className="mt-5 text-3xl font-black text-brand-blue">Not enough questions yet</h1><p className="mt-3 text-slate-500">There are no JAMB questions available for this practice set yet.</p><Link href="/tools/past-questions?exam=JAMB" className="mt-6 inline-block rounded-xl bg-brand-yellow px-5 py-3 font-extrabold text-brand-dark">Open JAMB question bank</Link></div></main><Footer /></>;
  if (submitted && result) return <><Navbar /><main className="min-h-screen bg-slate-50 py-12"><div className="mx-auto max-w-2xl px-4"><div className="rounded-3xl border bg-white p-8 text-center shadow-sm"><p className="text-5xl">{result.accuracy >= 70 ? '🎉' : '💪'}</p><p className="mt-5 text-xs font-extrabold uppercase tracking-[0.2em] text-brand-yellow">PRACTICE COMPLETE</p><h1 className="mt-2 text-3xl font-black text-brand-blue">{title}</h1><p className="mt-5 text-5xl font-black">{result.correct}/{result.total}</p><p className="mt-2 text-slate-500">{result.accuracy}% accuracy</p>{result.weakTopics.length > 0 && <div className="mt-7 rounded-2xl bg-red-50 p-5 text-left"><p className="font-extrabold text-red-700">Topics to revisit</p><div className="mt-3 flex flex-wrap gap-2">{result.weakTopics.map(item => <Link key={item} href={`/jamb/practice?subject=${encodeURIComponent(subject)}&topic=${encodeURIComponent(item)}`} className="rounded-full bg-white px-3 py-1.5 text-sm font-bold text-red-700 border border-red-100">{item}</Link>)}</div></div>}<div className="mt-8 flex flex-wrap justify-center gap-3"><button onClick={() => window.location.reload()} className="rounded-xl bg-brand-yellow px-5 py-3 font-extrabold text-brand-dark">Practise again</button><Link href="/jamb/study" className="rounded-xl border px-5 py-3 font-extrabold text-brand-blue">Back to subjects</Link><Link href="/jamb" className="rounded-xl border px-5 py-3 font-extrabold text-brand-blue">JAMB command centre</Link></div></div></div></main><Footer /></>;
  return <><Navbar /><main className="min-h-screen bg-slate-50 py-8"><div className="mx-auto max-w-3xl px-4"><div className="mb-5 flex items-center justify-between"><div><p className="text-xs font-extrabold uppercase tracking-[0.2em] text-brand-yellow">JAMB 2027 • CBT PRACTICE</p><h1 className="mt-1 text-2xl font-black text-brand-blue">{title}</h1><p className="text-sm text-slate-500">{subtitle} • {questions.length} questions</p></div><span className="rounded-full bg-white px-3 py-1 text-sm font-bold text-slate-600 border">{Object.keys(answers).length}/{questions.length} answered</span></div><div className="mb-4 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-brand-blue" style={{width:`${((currentIndex+1)/questions.length)*100}%`}} /></div><div className="rounded-3xl border bg-white shadow-sm"><div className="p-6 sm:p-8"><div className="flex flex-wrap gap-2 text-xs mb-4"><span className="rounded-full bg-brand-blue/10 px-2 py-1 font-bold text-brand-blue">{current.subject}</span>{current.topic && <span className="rounded-full bg-purple-100 px-2 py-1 font-bold text-purple-700">{current.topic}</span>}{current.year && <span className="rounded-full bg-slate-100 px-2 py-1 font-bold text-slate-600">{current.year}</span>}</div><p className="text-lg font-bold leading-8 text-slate-900">{currentIndex+1}. {current.question}</p><div className="mt-7 space-y-3">{['a','b','c','d'].map(letter => { const option=current[`option_${letter}`]; if(!option)return null; const selected=answers[current.id]===letter; return <button key={letter} onClick={()=>setAnswers(prev=>({...prev,[current.id]:letter}))} className={`w-full rounded-2xl border px-4 py-4 text-left ${selected?'border-brand-blue bg-blue-50':'border-slate-200 hover:border-brand-blue'}`}><span className="mr-2 font-black">{letter.toUpperCase()}.</span>{option}</button>; })}</div></div><div className="flex items-center justify-between border-t bg-slate-50 p-5"><button onClick={()=>setCurrentIndex(i=>Math.max(0,i-1))} disabled={currentIndex===0} className="rounded-xl border bg-white px-4 py-2 font-bold disabled:opacity-40">← Previous</button>{currentIndex===questions.length-1?<button onClick={submit} disabled={saving} className="rounded-xl bg-brand-yellow px-6 py-3 font-extrabold text-brand-dark">{saving?'Saving...':'Submit practice'}</button>:<button onClick={()=>setCurrentIndex(i=>Math.min(questions.length-1,i+1))} className="rounded-xl bg-brand-blue px-6 py-3 font-extrabold text-white">Next →</button>}</div></div></div></main><Footer /></>;
}
