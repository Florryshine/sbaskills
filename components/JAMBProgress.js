'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { createBrowserClient } from '@/lib/supabase';

const pct = (score, total) => total ? Math.round((score / total) * 100) : 0;
const practiceHref = (subject, topic) => {
  const p = new URLSearchParams();
  if (subject) p.set('subject', subject);
  if (topic) p.set('topic', topic);
  return `/jamb/practice?${p.toString()}`;
};

export default function JAMBProgress() {
  const supabase = createBrowserClient();
  const [user, setUser] = useState(null);
  const [curriculum, setCurriculum] = useState(null);
  const [mastery, setMastery] = useState([]);
  const [summary, setSummary] = useState(null);
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        setLoading(false);
        return;
      }

      setUser(auth.user);

      const { data: target } = await supabase
        .from('student_exam_targets')
        .select('exam_type, exam_year, curriculum_id')
        .eq('user_id', auth.user.id)
        .eq('status', 'active')
        .eq('exam_type', 'JAMB')
        .order('exam_year', { ascending: false })
        .limit(1)
        .maybeSingle();

      let curriculumId = target?.curriculum_id || null;
      let curriculumData = null;

      if (curriculumId) {
        const { data } = await supabase
          .from('curricula')
          .select('id, name, code, version, exam_start_date, exam_end_date, date_status')
          .eq('id', curriculumId)
          .maybeSingle();
        curriculumData = data;
      }

      if (!curriculumData) {
        const { data } = await supabase
          .from('curricula')
          .select('id, name, code, version, exam_start_date, exam_end_date, date_status')
          .eq('exam_type', 'JAMB')
          .eq('status', 'active')
          .order('effective_from_year', { ascending: false })
          .limit(1)
          .maybeSingle();
        curriculumData = data;
        curriculumId = data?.id || null;
      }

      const [masteryResult, summaryResult, attemptsResult] = await Promise.all([
        curriculumId
          ? supabase
              .from('student_topic_mastery')
              .select('id, curriculum_topic_id, questions_attempted, questions_correct, accuracy, mastery_score, status, last_practiced_at, curriculum_topics(id, subject, title, order_index, game_topic_id)')
              .eq('user_id', auth.user.id)
              .eq('curriculum_topics.curriculum_id', curriculumId)
              .order('mastery_score', { ascending: true })
          : Promise.resolve({ data: [] }),
        curriculumId
          ? supabase.from('student_progress_summary')
              .select('topics_total, topics_started, topics_mastered, mastery_percent')
              .eq('user_id', auth.user.id)
              .eq('curriculum_id', curriculumId)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        supabase
          .from('jamb_practice_attempts')
          .select('id, mode, subject, topic, score, total_questions, completed_at')
          .eq('user_id', auth.user.id)
          .order('completed_at', { ascending: false })
          .limit(20),
      ]);

      if (masteryResult.error) console.error('JAMB mastery load error:', masteryResult.error);
      if (summaryResult.error) console.error('JAMB summary load error:', summaryResult.error);
      if (attemptsResult.error) console.error('JAMB progress history error:', attemptsResult.error);

      setCurriculum(curriculumData);
      setMastery((masteryResult.data || []).filter(row => row.curriculum_topics));
      setSummary(summaryResult.data || null);
      setAttempts(attemptsResult.data || []);
      setLoading(false);
    }

    load().catch((error) => {
      console.error('JAMB progress load error:', error);
      setLoading(false);
    });
  }, []);

  const stats = useMemo(() => {
    const topics = mastery.map(row => {
      const topic = row.curriculum_topics;
      return {
        ...row,
        subject: topic.subject,
        title: topic.title,
        practiceHref: practiceHref(topic.subject, topic.title),
      };
    });

    const started = topics.filter(t => t.questions_attempted > 0);
    const weak = topics
      .filter(t => t.status === 'weak' || (t.questions_attempted > 0 && t.mastery_score < 60))
      .sort((a, b) => (a.mastery_score - b.mastery_score) || (b.questions_attempted - a.questions_attempted));

    const learning = topics
      .filter(t => t.status === 'learning')
      .sort((a, b) => a.mastery_score - b.mastery_score);

    const subjects = [...new Set(topics.map(t => t.subject))].map(subject => {
      const rows = topics.filter(t => t.subject === subject);
      const mastered = rows.filter(t => t.status === 'mastered').length;
      const startedCount = rows.filter(t => t.questions_attempted > 0).length;
      const average = rows.length ? Math.round(rows.reduce((sum, t) => sum + (t.mastery_score || 0), 0) / rows.length) : 0;
      return { subject, total: rows.length, mastered, started: startedCount, mastery: average };
    }).sort((a, b) => a.mastery - b.mastery);

    const totalQuestions = attempts.reduce((sum, a) => sum + (a.total_questions || 0), 0);
    const correct = attempts.reduce((sum, a) => sum + (a.score || 0), 0);

    return {
      topics,
      started,
      weak,
      learning,
      subjects,
      totalQuestions,
      overallAccuracy: pct(correct, totalQuestions),
      nextTopic: weak[0] || learning[0] || topics.find(t => t.status === 'not_started') || null,
    };
  }, [mastery, attempts]);

  if (loading) return <><Navbar /><main className="min-h-screen flex items-center justify-center bg-slate-50"><p className="font-bold text-brand-blue">Loading your mastery...</p></main><Footer /></>;

  if (!user) return <><Navbar /><main className="min-h-screen bg-slate-50 py-16"><div className="mx-auto max-w-2xl px-4 text-center"><p className="text-5xl">🔐</p><h1 className="mt-4 text-3xl font-black text-brand-blue">Log in to see your progress</h1><p className="mt-3 text-slate-500">Your learning progress is private to your account.</p><Link href="/login" className="mt-6 inline-block rounded-xl bg-brand-yellow px-5 py-3 font-extrabold text-brand-dark">Log in</Link></div></main><Footer /></>;

  const hasCurriculum = Boolean(curriculum?.id);
  const hasMappedTopics = stats.topics.length > 0;

  return <><Navbar /><main className="min-h-screen bg-slate-50 py-10"><div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
    <Link href="/jamb" className="text-sm font-bold text-brand-blue hover:underline">← Back to JAMB</Link>
    <div className="mt-7 max-w-3xl">
      <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-brand-yellow">JAMB • MASTERY</p>
      <h1 className="mt-2 text-4xl font-black text-brand-blue">Know what you actually know.</h1>
      <p className="mt-3 text-slate-500">Your practice answers now update topic mastery. The system uses your weakest mapped topics to decide what you should practise next.</p>
      {curriculum?.version && <p className="mt-2 text-xs font-bold text-slate-400">{curriculum.name} • {curriculum.date_status !== 'official' ? 'working curriculum data' : 'official curriculum data'}</p>}
    </div>

    {!hasCurriculum ? (
      <div className="mt-10 rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center">
        <p className="text-5xl">📚</p><h2 className="mt-4 text-2xl font-black text-brand-blue">Your JAMB target is not configured yet.</h2>
        <p className="mt-2 text-slate-500">Choose JAMB in your exam target so the mastery engine can personalise your preparation.</p>
        <Link href="/profile" className="mt-6 inline-block rounded-xl bg-brand-yellow px-5 py-3 font-extrabold text-brand-dark">Open profile</Link>
      </div>
    ) : !hasMappedTopics ? (
      <div className="mt-10 rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center">
        <p className="text-5xl">🧭</p><h2 className="mt-4 text-2xl font-black text-brand-blue">Mastery mapping is ready, but topics are not mapped yet.</h2>
        <p className="mt-2 text-slate-500">You can still practise normally. Once the question bank is mapped to the curriculum, every answer will feed this dashboard.</p>
        <Link href="/jamb/practice" className="mt-6 inline-block rounded-xl bg-brand-yellow px-5 py-3 font-extrabold text-brand-dark">Start practising</Link>
      </div>
    ) : <>
      <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          ['🎯', 'Curriculum mastery', `${summary?.mastery_percent || 0}%`],
          ['📚', 'Topics mastered', `${summary?.topics_mastered || 0}/${summary?.topics_total || stats.topics.length}`],
          ['🧠', 'Topics started', `${summary?.topics_started || stats.started.length}/${summary?.topics_total || stats.topics.length}`],
          ['📝', 'Recent questions', stats.totalQuestions],
        ].map(([icon, label, value]) => <div key={label} className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-2xl">{icon}</p><p className="mt-3 text-2xl font-black text-brand-blue">{value}</p><p className="mt-1 text-xs text-slate-500">{label}</p></div>)}
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-3">
        <section className="lg:col-span-2 rounded-3xl border bg-white p-6 shadow-sm">
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-brand-yellow">SUBJECT MASTERY</p>
          <h2 className="mt-2 text-2xl font-black text-brand-blue">Where you stand by subject</h2>
          <div className="mt-6 space-y-5">
            {stats.subjects.map(s => <div key={s.subject}>
              <div className="flex justify-between"><p className="font-extrabold text-slate-800">{s.subject}</p><p className="text-sm font-black text-brand-blue">{s.mastery}%</p></div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-brand-blue" style={{width:`${s.mastery}%`}} /></div>
              <p className="mt-1 text-xs text-slate-500">{s.mastered}/{s.total} mastered • {s.started} started</p>
            </div>)}
          </div>
        </section>

        <section className="rounded-3xl bg-brand-blue p-6 text-white">
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-brand-yellow">NEXT BEST MOVE</p>
          <h2 className="mt-2 text-2xl font-black">Close the biggest gap.</h2>
          {stats.nextTopic ? <><p className="mt-3 text-sm leading-6 text-blue-100">Your next focus is <strong className="text-white">{stats.nextTopic.title}</strong> in {stats.nextTopic.subject}. Current mastery: {stats.nextTopic.mastery_score}%.</p><Link href={stats.nextTopic.practiceHref} className="mt-5 inline-block rounded-xl bg-brand-yellow px-5 py-3 text-sm font-extrabold text-brand-dark">Practise this topic →</Link></> : <p className="mt-3 text-sm text-blue-100">Complete mapped practice and the engine will recommend your next topic.</p>}
        </section>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <section className="rounded-3xl border bg-white p-6 shadow-sm">
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-brand-yellow">WEAK AREAS</p>
          <h2 className="mt-2 text-2xl font-black text-brand-blue">Topics that need work</h2>
          <div className="mt-5 space-y-3">
            {(stats.weak.length ? stats.weak : stats.learning).slice(0, 8).map(t => <Link key={t.id} href={t.practiceHref} className="flex items-center justify-between gap-3 rounded-2xl border p-4 hover:border-brand-blue"><div><p className="font-extrabold text-slate-800">{t.title}</p><p className="text-xs text-slate-500">{t.subject} • {t.questions_attempted} questions • {t.mastery_score}% mastery</p></div><span className="text-sm font-extrabold text-brand-blue">Practise →</span></Link>)}
            {!stats.weak.length && !stats.learning.length && <p className="text-sm text-slate-500">No weak topics yet. Keep practising to build your mastery profile.</p>}
          </div>
        </section>

        <section className="rounded-3xl border bg-white p-6 shadow-sm">
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-brand-yellow">RECENT PRACTICE</p>
          <h2 className="mt-2 text-2xl font-black text-brand-blue">Your latest sessions</h2>
          <div className="mt-5 space-y-3">
            {attempts.slice(0, 8).map(a => <div key={a.id} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 p-4"><div><p className="font-extrabold text-slate-800">{a.topic || a.subject || 'Mixed JAMB Practice'}</p><p className="text-xs text-slate-500">{new Date(a.completed_at).toLocaleDateString('en-NG',{day:'numeric',month:'short',year:'numeric'})}</p></div><p className="font-black text-brand-blue">{a.score}/{a.total_questions} • {pct(a.score,a.total_questions)}%</p></div>)}
            {!attempts.length && <p className="text-sm text-slate-500">No practice sessions yet.</p>}
          </div>
        </section>
      </div>

      <section className="mt-8 rounded-3xl border bg-white p-6 shadow-sm">
        <div className="flex items-end justify-between gap-4"><div><p className="text-xs font-extrabold uppercase tracking-[0.2em] text-brand-yellow">ALL TOPICS</p><h2 className="mt-2 text-2xl font-black text-brand-blue">Your curriculum map</h2></div><Link href="/jamb/syllabus-mastery" className="text-sm font-extrabold text-brand-blue">Open full map →</Link></div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {stats.topics.map(t => <Link key={t.id} href={t.practiceHref} className="rounded-2xl border p-4 hover:border-brand-blue"><div className="flex items-center justify-between gap-3"><p className="font-bold text-slate-800">{t.title}</p><span className="text-xs font-black text-brand-blue">{t.mastery_score}%</span></div><p className="mt-1 text-xs text-slate-500">{t.subject} • {t.status.replace('_',' ')}</p></Link>)}
        </div>
      </section>
    </>}
  </div></main><Footer /></>;
}
