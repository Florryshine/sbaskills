'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { createBrowserClient } from '@/lib/supabase';

const accuracy = (score, total) => total ? Math.round((score / total) * 100) : 0;
const practiceHref = (subject, topic) => {
  const p = new URLSearchParams();
  if (subject) p.set('subject', subject);
  if (topic) p.set('topic', topic);
  return `/jamb/practice?${p.toString()}`;
};

export default function JAMBProgress() {
  const supabase = createBrowserClient();
  const [user, setUser] = useState(null);
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return setLoading(false);
      setUser(auth.user);
      const { data, error } = await supabase
        .from('jamb_practice_attempts')
        .select('id, mode, subject, topic, score, total_questions, weak_topics, completed_at')
        .eq('user_id', auth.user.id)
        .order('completed_at', { ascending: false })
        .limit(100);
      if (error) console.error('JAMB progress load error:', error);
      setAttempts(data || []);
      setLoading(false);
    }
    load();
  }, []);

  const stats = useMemo(() => {
    let total = 0, correct = 0;
    const subjects = new Map();
    const topics = new Map();

    for (const a of attempts) {
      total += a.total_questions || 0;
      correct += a.score || 0;

      if (a.subject) {
        const s = subjects.get(a.subject) || { subject: a.subject, score: 0, total: 0, sessions: 0 };
        s.score += a.score || 0; s.total += a.total_questions || 0; s.sessions += 1;
        subjects.set(a.subject, s);
      }

      if (a.topic) {
        const t = topics.get(a.topic) || { topic: a.topic, subject: a.subject || '', score: 0, total: 0, hits: 0 };
        t.score += a.score || 0; t.total += a.total_questions || 0; t.hits += 1;
        topics.set(a.topic, t);
      }

      for (const weak of a.weak_topics || []) {
        const t = topics.get(weak) || { topic: weak, subject: a.subject || '', score: 0, total: 0, hits: 0 };
        t.hits += 1;
        topics.set(weak, t);
      }
    }

    const subjectList = [...subjects.values()]
      .map(s => ({ ...s, accuracy: accuracy(s.score, s.total) }))
      .sort((a, b) => a.accuracy - b.accuracy);

    const weakList = [...topics.values()]
      .map(t => ({ ...t, accuracy: t.total ? accuracy(t.score, t.total) : 0 }))
      .filter(t => t.hits > 0 && (!t.total || t.accuracy < 70))
      .sort((a, b) => (b.hits - a.hits) || (a.accuracy - b.accuracy))
      .slice(0, 8);

    return {
      total, overall: accuracy(correct, total), sessions: attempts.length,
      subjects: subjectList, weakTopics: weakList,
      weakestSubject: subjectList[0] || null,
      nextTopic: weakList[0] || null,
    };
  }, [attempts]);

  if (loading) return <><Navbar /><main className="min-h-screen flex items-center justify-center bg-slate-50"><p className="font-bold text-brand-blue">Loading your JAMB progress...</p></main><Footer /></>;

  if (!user) return <><Navbar /><main className="min-h-screen bg-slate-50 py-16"><div className="mx-auto max-w-2xl px-4 text-center"><p className="text-5xl">🔐</p><h1 className="mt-4 text-3xl font-black text-brand-blue">Log in to see your progress</h1><p className="mt-3 text-slate-500">Your JAMB practice history is private to your account.</p><Link href="/login" className="mt-6 inline-block rounded-xl bg-brand-yellow px-5 py-3 font-extrabold text-brand-dark">Log in</Link></div></main><Footer /></>;

  return <><Navbar /><main className="min-h-screen bg-slate-50 py-10"><div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
    <Link href="/jamb" className="text-sm font-bold text-brand-blue hover:underline">← Back to JAMB</Link>
    <div className="mt-7 max-w-3xl"><p className="text-xs font-extrabold uppercase tracking-[0.2em] text-brand-yellow">JAMB 2027 • PROGRESS</p><h1 className="mt-2 text-4xl font-black text-brand-blue">Know where you stand.</h1><p className="mt-3 text-slate-500">Your practice history shows what you have done, where you are strong and what to practise next.</p></div>

    {!attempts.length ? <div className="mt-10 rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center"><p className="text-5xl">📊</p><h2 className="mt-4 text-2xl font-black text-brand-blue">Your progress starts with your first practice.</h2><p className="mt-2 text-slate-500">Complete a JAMB practice session and your results will appear here.</p><Link href="/jamb/practice" className="mt-6 inline-block rounded-xl bg-brand-yellow px-5 py-3 font-extrabold text-brand-dark">Start practising</Link></div> : <>
      <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">{[['📝','Questions attempted',stats.total],['🎯','Overall accuracy',`${stats.overall}%`],['⚡','Practice sessions',stats.sessions],['📚','Subjects practised',stats.subjects.length]].map(([icon,label,value]) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-2xl">{icon}</p><p className="mt-3 text-2xl font-black text-brand-blue">{value}</p><p className="mt-1 text-xs text-slate-500">{label}</p></div>)}</div>

      <div className="mt-8 grid gap-8 lg:grid-cols-3">
        <section className="lg:col-span-2 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><p className="text-xs font-extrabold uppercase tracking-[0.2em] text-brand-yellow">SUBJECT BREAKDOWN</p><h2 className="mt-2 text-2xl font-black text-brand-blue">How your subjects are going</h2><div className="mt-6 space-y-5">{stats.subjects.map(s => <div key={s.subject}><div className="flex justify-between"><p className="font-extrabold text-slate-800">{s.subject}</p><p className="text-sm font-black text-brand-blue">{s.accuracy}%</p></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-brand-blue" style={{width:`${s.accuracy}%`}} /></div><p className="mt-1 text-xs text-slate-500">{s.total} questions across {s.sessions} session{s.sessions === 1 ? '' : 's'}</p></div>)}</div></section>

        <section className="rounded-3xl bg-brand-blue p-6 text-white"><p className="text-xs font-extrabold uppercase tracking-[0.2em] text-brand-yellow">YOUR NEXT MOVE • 7F</p><h2 className="mt-2 text-2xl font-black">Practise the gap.</h2>{stats.nextTopic ? <><p className="mt-3 text-sm leading-6 text-blue-100">Your history has flagged <strong className="text-white">{stats.nextTopic.topic}</strong> for another round.</p><Link href={practiceHref(stats.nextTopic.subject,stats.nextTopic.topic)} className="mt-5 inline-block rounded-xl bg-brand-yellow px-5 py-3 text-sm font-extrabold text-brand-dark">Practise this topic →</Link></> : stats.weakestSubject ? <><p className="mt-3 text-sm leading-6 text-blue-100">Your lowest practised subject is <strong className="text-white">{stats.weakestSubject.subject}</strong> at {stats.weakestSubject.accuracy}%.</p><Link href={practiceHref(stats.weakestSubject.subject)} className="mt-5 inline-block rounded-xl bg-brand-yellow px-5 py-3 text-sm font-extrabold text-brand-dark">Practise {stats.weakestSubject.subject} →</Link></> : <p className="mt-3 text-sm text-blue-100">Keep practising. More sessions will make this recommendation more specific.</p>}</section>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><p className="text-xs font-extrabold uppercase tracking-[0.2em] text-brand-yellow">WEAK TOPICS</p><h2 className="mt-2 text-2xl font-black text-brand-blue">Topics to revisit</h2>{stats.weakTopics.length ? <div className="mt-5 space-y-3">{stats.weakTopics.map(t => <Link key={t.topic} href={practiceHref(t.subject,t.topic)} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 p-4 hover:border-brand-blue"><div><p className="font-extrabold text-slate-800">{t.topic}</p><p className="text-xs text-slate-500">{t.subject || 'JAMB'}{t.total ? ` • ${t.accuracy}%` : ''}</p></div><span className="text-sm font-extrabold text-brand-blue">Practise →</span></Link>)}</div> : <p className="mt-5 text-sm text-slate-500">No clear weak topics yet. Keep practising and repeated gaps will surface.</p>}</section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><p className="text-xs font-extrabold uppercase tracking-[0.2em] text-brand-yellow">PERSONALISED PREPARATION • 7F</p><h2 className="mt-2 text-2xl font-black text-brand-blue">Your next study cycle</h2><div className="mt-5 space-y-3"><Link href="/jamb/practice" className="block rounded-2xl border border-slate-100 p-4 hover:border-brand-blue"><p className="font-extrabold text-slate-800">1. Practise</p><p className="mt-1 text-sm text-slate-500">Complete another 10-question session.</p></Link>{stats.nextTopic && <Link href={practiceHref(stats.nextTopic.subject,stats.nextTopic.topic)} className="block rounded-2xl border border-slate-100 p-4 hover:border-brand-blue"><p className="font-extrabold text-slate-800">2. Revisit {stats.nextTopic.topic}</p><p className="mt-1 text-sm text-slate-500">Turn the flagged weakness into focused practice.</p></Link>}{stats.weakestSubject && <Link href={practiceHref(stats.weakestSubject.subject)} className="block rounded-2xl border border-slate-100 p-4 hover:border-brand-blue"><p className="font-extrabold text-slate-800">3. Strengthen {stats.weakestSubject.subject}</p><p className="mt-1 text-sm text-slate-500">Run a subject-focused session and watch the accuracy move.</p></Link>}</div></section>
      </div>

      <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-end justify-between gap-4"><div><p className="text-xs font-extrabold uppercase tracking-[0.2em] text-brand-yellow">RECENT PRACTICE</p><h2 className="mt-2 text-2xl font-black text-brand-blue">Latest sessions</h2></div><Link href="/jamb/practice" className="text-sm font-extrabold text-brand-blue hover:underline">Practise again →</Link></div><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[600px] text-left text-sm"><thead><tr className="border-b text-xs uppercase tracking-wide text-slate-400"><th className="px-3 py-3">Session</th><th className="px-3 py-3">Score</th><th className="px-3 py-3">Accuracy</th><th className="px-3 py-3">Date</th></tr></thead><tbody>{attempts.slice(0,10).map(a => <tr key={a.id} className="border-b last:border-0"><td className="px-3 py-3 font-bold text-slate-800">{a.topic || a.subject || 'Mixed JAMB Practice'}</td><td className="px-3 py-3">{a.score}/{a.total_questions}</td><td className="px-3 py-3 font-bold text-brand-blue">{accuracy(a.score,a.total_questions)}%</td><td className="px-3 py-3 text-slate-500">{new Date(a.completed_at).toLocaleDateString('en-NG',{day:'numeric',month:'short',year:'numeric'})}</td></tr>)}</tbody></table></div></section>
    </>}
  </div></main><Footer /></>;
}
