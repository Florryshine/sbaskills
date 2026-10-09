'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { createBrowserClient } from '@/lib/supabase';
import { addPoints, updateStreak } from '@/lib/gamification';

const PRACTICE_SIZE = 10;
function shuffle(items) { return [...items].sort(() => Math.random() - 0.5); }
function getInitialParam(name) { return typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get(name) || ''; }

export default function JAMBPracticePage() {
  const router = useRouter();
  const supabase = createBrowserClient();
  const [subject, setSubject] = useState(() => getInitialParam('subject'));
  const [topic, setTopic] = useState(() => getInitialParam('topic'));
  const [recommendedTopic, setRecommendedTopic] = useState(null);
  const mode = topic ? 'topic' : subject ? 'subject' : 'mixed';
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [user, setUser] = useState(null);
  const [missionItemId, setMissionItemId] = useState(() => getInitialParam('item'));

  useEffect(() => {
    setSubject(getInitialParam('subject'));
    setTopic(getInitialParam('topic'));
    setMissionItemId(getInitialParam('item'));
  }, []);

  useEffect(() => {
    async function load() {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        router.push('/login');
        return;
      }
      setUser(auth.user);

      let data = [];
      let error = null;

      if (missionItemId) {
        const { data: item, error: itemError } = await supabase
          .from('student_daily_mission_items')
          .select('id, subject, topic, question_ids')
          .eq('id', missionItemId)
          .maybeSingle();

        if (itemError) {
          error = itemError;
        } else if (item?.question_ids?.length) {
          const { data: missionQuestions, error: questionError } = await supabase
            .from('past_questions')
            .select('id, subject, topic, year, question, option_a, option_b, option_c, option_d, correct_answer, explanation')
            .in('id', item.question_ids);

          error = questionError;
          const byId = new Map((missionQuestions || []).map(q => [q.id, q]));
          data = item.question_ids.map(id => byId.get(id)).filter(Boolean);
        }
      } else if (topic || subject) {
        let query = supabase
          .from('past_questions')
          .select('id, subject, topic, year, question, option_a, option_b, option_c, option_d, correct_answer, explanation')
          .eq('exam_type', 'JAMB');
        if (subject) query = query.eq('subject', subject);
        if (topic) query = query.eq('topic', topic);
        const result = await query.limit(500);
        data = shuffle(result.data || []).slice(0, PRACTICE_SIZE);
        error = result.error;
      } else {
        // Phase B: when no explicit topic was requested, start with the student's
        // weakest mapped curriculum topic. Unmapped banks still have a safe fallback.
        const { data: target } = await supabase
          .from('student_exam_targets')
          .select('curriculum_id')
          .eq('user_id', auth.user.id)
          .eq('status', 'active')
          .eq('exam_type', 'JAMB')
          .order('exam_year', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (target?.curriculum_id) {
          const { data: weakRows } = await supabase
            .from('student_topic_mastery')
            .select('curriculum_topic_id, mastery_score, status, questions_attempted, curriculum_topics(id, subject, title)')
            .eq('user_id', auth.user.id)
            .eq('curriculum_topics.curriculum_id', target.curriculum_id)
            .order('mastery_score', { ascending: true })
            .limit(20);

          const focus = (weakRows || []).find(row => row.curriculum_topics && row.status !== 'mastered') || (weakRows || [])[0];

          if (focus?.curriculum_topic_id) {
            const { data: mappedQuestions, error: mappedError } = await supabase
              .from('past_questions')
              .select('id, subject, topic, year, question, option_a, option_b, option_c, option_d, correct_answer, explanation')
              .eq('exam_type', 'JAMB')
              .eq('curriculum_topic_id', focus.curriculum_topic_id)
              .limit(100);

            if (!mappedError && mappedQuestions?.length) {
              data = shuffle(mappedQuestions).slice(0, PRACTICE_SIZE);
              setRecommendedTopic(focus.curriculum_topics);
            }
          }
        }

        if (!data.length) {
          const result = await supabase
            .from('past_questions')
            .select('id, subject, topic, year, question, option_a, option_b, option_c, option_d, correct_answer, explanation')
            .eq('exam_type', 'JAMB')
            .limit(300);
          data = shuffle(result.data || []).slice(0, PRACTICE_SIZE);
          error = result.error;
        }
      }

      if (error) console.error('JAMB practice load error:', error);
      setQuestions(data);
      setLoading(false);
    }

    load();
  }, [subject, topic, missionItemId]);

  const current = questions[currentIndex];
  const title = topic || subject || (recommendedTopic?.title ? `Recommended: ${recommendedTopic.title}` : 'Mixed JAMB Practice');
  const subtitle = topic ? (subject ? `${subject} • ${topic}` : topic) : (subject || (recommendedTopic ? `${recommendedTopic.subject} • Based on your mastery` : 'Based on your current learning profile'));

  const submit = async () => {
    if (saving || submitted || !questions.length || !user) return;
    setSaving(true);
    let correct = 0;
    const weakTopicCounts = {};
    questions.forEach(q => {
      if (answers[q.id]?.toLowerCase() === q.correct_answer?.toLowerCase()) correct++;
      else if (q.topic) weakTopicCounts[q.topic] = (weakTopicCounts[q.topic] || 0) + 1;
    });

    const total = questions.length;
    const accuracy = Math.round((correct / total) * 100);
    const weakTopics = Object.entries(weakTopicCounts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name]) => name);

    const { error } = await supabase.from('jamb_practice_attempts').insert({
      user_id: user.id,
      mode,
      subject: subject || recommendedTopic?.subject || null,
      topic: topic || recommendedTopic?.title || null,
      question_ids: questions.map(q => q.id),
      answers,
      score: correct,
      total_questions: total,
      weak_topics: weakTopics,
    });

    if (!error) {
      setSaveError('');
      const { data: masteryResult, error: masteryError } = await supabase.rpc('record_jamb_practice_mastery', {
        p_user_id: user.id,
        p_question_ids: questions.map(q => q.id),
        p_answers: answers,
      });
      if (masteryError) console.error('JAMB mastery update error:', masteryError);
      else console.log('JAMB mastery updated:', masteryResult);

      await addPoints(user.id, 10, 'Completed JAMB practice', 'jamb_practice');
      await updateStreak(user.id);

      if (missionItemId) {
        const { data: missionResult, error: missionError } = await supabase.rpc('complete_daily_mission_item', { p_item_id: missionItemId });
        if (missionError) console.error('Daily mission completion error:', missionError);
        else console.log('Daily mission item completed:', missionResult);
      }
    } else {
      console.error('JAMB practice save error:', error);
      setSaveError('Your score was calculated, but we could not save this session to your progress. Please check your connection and try again later.');
    }

    setResult({ correct, total, accuracy, weakTopics });
    setSubmitted(true);
    setSaving(false);
  };

  if (loading) return <><Navbar /><main className="min-h-screen flex items-center justify-center bg-slate-50"><p className="font-bold text-brand-blue">Preparing your personalised practice...</p></main><Footer /></>;
  if (!questions.length) return <><Navbar /><main className="min-h-screen bg-slate-50 py-16"><div className="mx-auto max-w-2xl px-4 text-center"><p className="text-5xl">📚</p><h1 className="mt-5 text-3xl font-black text-brand-blue">Not enough questions yet</h1><p className="mt-3 text-slate-500">There are no JAMB questions available for this practice set yet.</p><Link href="/tools/past-questions?exam=JAMB" className="mt-6 inline-block rounded-xl bg-brand-yellow px-5 py-3 font-extrabold text-brand-dark">Open JAMB question bank</Link></div></main><Footer /></>;
  if (submitted && result) return <><Navbar /><main className="min-h-screen bg-slate-50 py-12"><div className="mx-auto max-w-2xl px-4"><div className="rounded-3xl border bg-white p-8 text-center shadow-sm"><p className="text-5xl">{result.accuracy >= 70 ? '🎉' : '💪'}</p><p className="mt-5 text-xs font-extrabold uppercase tracking-[0.2em] text-brand-yellow">PRACTICE COMPLETE</p><h1 className="mt-2 text-3xl font-black text-brand-blue">{title}</h1><p className="mt-5 text-5xl font-black">{result.correct}/{result.total}</p><p className="mt-2 text-slate-500">{result.accuracy}% accuracy</p>{saveError && <div role="alert" className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-left text-sm text-amber-800">{saveError}</div>}{result.weakTopics.length > 0 && <div className="mt-7 rounded-2xl bg-red-50 p-5 text-left"><p className="font-extrabold text-red-700">Topics to revisit</p><div className="mt-3 flex flex-wrap gap-2">{result.weakTopics.map(item => <Link key={item} href={`/jamb/practice?subject=${encodeURIComponent(subject || recommendedTopic?.subject || '')}&topic=${encodeURIComponent(item)}`} className="rounded-full bg-white px-3 py-1.5 text-sm font-bold text-red-700 border border-red-100">{item}</Link>)}</div></div>}<section className="mt-7 space-y-4 text-left"><h2 className="text-xl font-black text-brand-blue">Review your answers</h2>{questions.map((q, index) => { const chosen = answers[q.id]?.toLowerCase(); const correctAnswer = q.correct_answer?.toLowerCase(); const isCorrect = chosen === correctAnswer; const correctText = q['option_' + correctAnswer]; return <article key={q.id} className="rounded-2xl border border-slate-200 p-4"><p className="font-bold text-slate-900">{index + 1}. {q.question}</p><p className={'mt-3 text-sm font-bold ' + (isCorrect ? 'text-green-700' : 'text-red-700')}>{isCorrect ? '✓ Correct' : '✗ Incorrect'}{chosen ? ' — Your answer: ' + chosen.toUpperCase() : ' — Not answered'}</p><p className="mt-1 text-sm text-slate-700">Correct answer: {correctAnswer?.toUpperCase() || 'Not set'}{correctText ? '. ' + correctText : ''}</p>{q.explanation ? <p className="mt-2 rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-600"><strong>Explanation:</strong> {q.explanation}</p> : <p className="mt-2 text-xs text-slate-400">No explanation has been added for this question yet.</p>}</article>; })}</section><div className="mt-8 flex flex-wrap justify-center gap-3"><button onClick={() => window.location.reload()} className="rounded-xl bg-brand-yellow px-5 py-3 font-extrabold text-brand-dark">Practise again</button><Link href="/jamb/progress" className="rounded-xl border px-5 py-3 font-extrabold text-brand-blue">View mastery</Link><Link href="/jamb" className="rounded-xl border px-5 py-3 font-extrabold text-brand-blue">JAMB command centre</Link></div></div></div></main><Footer /></>;
  return <><Navbar /><main className="min-h-screen bg-slate-50 py-8"><div className="mx-auto max-w-3xl px-4"><div className="mb-5 flex items-center justify-between"><div><p className="text-xs font-extrabold uppercase tracking-[0.2em] text-brand-yellow">JAMB • CBT PRACTICE</p><h1 className="mt-1 text-2xl font-black text-brand-blue">{title}</h1><p className="text-sm text-slate-500">{subtitle} • {questions.length} questions</p></div><span className="rounded-full bg-white px-3 py-1 text-sm font-bold text-slate-600 border">{Object.keys(answers).length}/{questions.length} answered</span></div><div className="mb-4 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-brand-blue" style={{width:`${((currentIndex+1)/questions.length)*100}%`}} /></div><div className="rounded-3xl border bg-white shadow-sm"><div className="p-6 sm:p-8"><div className="flex flex-wrap gap-2 text-xs mb-4"><span className="rounded-full bg-brand-blue/10 px-2 py-1 font-bold text-brand-blue">{current.subject}</span>{current.topic && <span className="rounded-full bg-purple-100 px-2 py-1 font-bold text-purple-700">{current.topic}</span>}{current.year && <span className="rounded-full bg-slate-100 px-2 py-1 font-bold text-slate-600">{current.year}</span>}</div><p className="text-lg font-bold leading-8 text-slate-900">{currentIndex+1}. {current.question}</p><div className="mt-7 space-y-3">{['a','b','c','d'].map(letter => { const option=current[`option_${letter}`]; if(!option)return null; const selected=answers[current.id]===letter; return <button key={letter} onClick={()=>setAnswers(prev=>({...prev,[current.id]:letter}))} className={`w-full rounded-2xl border px-4 py-4 text-left ${selected?'border-brand-blue bg-blue-50':'border-slate-200 hover:border-brand-blue'}`}><span className="mr-2 font-black">{letter.toUpperCase()}.</span>{option}</button>; })}</div></div><div className="flex items-center justify-between border-t bg-slate-50 p-5"><button onClick={()=>setCurrentIndex(i=>Math.max(0,i-1))} disabled={currentIndex===0} className="rounded-xl border bg-white px-4 py-2 font-bold disabled:opacity-40">← Previous</button>{currentIndex===questions.length-1?<button onClick={submit} disabled={saving} className="rounded-xl bg-brand-yellow px-6 py-3 font-extrabold text-brand-dark">{saving?'Saving...':'Submit practice'}</button>:<button onClick={()=>setCurrentIndex(i=>Math.min(questions.length-1,i+1))} className="rounded-xl bg-brand-blue px-6 py-3 font-extrabold text-white">Next →</button>}</div></div></div></main><Footer /></>;
}
