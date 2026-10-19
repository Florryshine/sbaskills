'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { createBrowserClient } from '@/lib/supabase';

const CHALLENGES = {
  Biology: { target: 300, reward: 150, title: 'Biology Beast', emoji: '🧬' },
  Physics: { target: 300, reward: 150, title: 'Physics Fighter', emoji: '⚡' },
  Chemistry: { target: 200, reward: 100, title: 'Chemistry Champion', emoji: '🧪' },
  CRS: { target: 200, reward: 100, title: 'CRS Champion', emoji: '📖' },
};
const BATCH_SIZE = 50;
const MEDALS = ['🥇', '🥈', '🥉'];

function lagosDate() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return values.year + '-' + values.month + '-' + values.day;
}
function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
function showAccuracy(value) {
  return Number(value || 0).toFixed(1).replace(/\.0$/, '') + '%';
}

export default function DailyChallengePage() {
  const supabase = createBrowserClient();
  const [user, setUser] = useState(null);
  const [today, setToday] = useState('');
  const [subject, setSubject] = useState('Biology');
  const [progress, setProgress] = useState({ questions_attempted: 0, questions_correct: 0, accuracy: 0 });
  const [rankings, setRankings] = useState([]);
  const [names, setNames] = useState({});
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [rewardClaimed, setRewardClaimed] = useState(false);
  const [notice, setNotice] = useState('');

  const config = CHALLENGES[subject] || CHALLENGES.Biology;

  const load = useCallback(async () => {
    setLoading(true);
    setNotice('');
    const date = lagosDate();
    setToday(date);
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth?.user) {
      window.location.href = '/login';
      return;
    }
    setUser(auth.user);

    // Everyone receives the same rotating challenge for the Nigeria calendar day.
    const dayNumber = Math.floor(new Date(date + 'T00:00:00+01:00').getTime() / 86400000);
    const subjects = Object.keys(CHALLENGES);
    const activeSubject = subjects[((dayNumber % subjects.length) + subjects.length) % subjects.length];
    setSubject(activeSubject);

    const [mine, board] = await Promise.all([
      supabase.from('daily_challenge_scores')
        .select('user_id, subject, challenge_date, questions_attempted, questions_correct, accuracy, first_attempt_at, last_attempt_at')
        .eq('user_id', auth.user.id).eq('subject', activeSubject).eq('challenge_date', date).maybeSingle(),
      supabase.from('daily_challenge_scores')
        .select('user_id, subject, challenge_date, questions_attempted, questions_correct, accuracy, first_attempt_at, last_attempt_at')
        .eq('subject', activeSubject).eq('challenge_date', date).limit(1000),
    ]);

    if (mine.error || board.error) setNotice('Could not refresh the live rankings. Please try again.');
    setProgress(mine.data || { questions_attempted: 0, questions_correct: 0, accuracy: 0 });
    const rows = board.data || [];
    setRankings(rows);
    const ids = [...new Set(rows.map(row => row.user_id).concat(auth.user.id))];
    if (ids.length) {
      const { data: profiles } = await supabase.from('leaderboard_profiles')
        .select('id, full_name').in('id', ids);
      setNames(Object.fromEntries((profiles || []).map(p => [p.id, p.full_name || 'Student'])));
    }

    const attempted = Number(mine.data?.questions_attempted || 0);
    if (attempted >= (CHALLENGES[activeSubject]?.target || 300)) {
      const { data: claim } = await supabase.from('daily_challenge_reward_claims')
        .select('id').eq('user_id', auth.user.id).eq('subject', activeSubject).eq('challenge_date', date).maybeSingle();
      setRewardClaimed(Boolean(claim));
    } else {
      setRewardClaimed(false);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  const ranked = useMemo(() => [...rankings].sort((a, b) =>
    Number(b.questions_attempted) - Number(a.questions_attempted) ||
    Number(b.accuracy || 0) - Number(a.accuracy || 0) ||
    new Date(a.last_attempt_at || a.first_attempt_at).getTime() -
      new Date(b.last_attempt_at || b.first_attempt_at).getTime()
  ), [rankings]);

  const myRank = user ? ranked.findIndex(row => row.user_id === user.id) + 1 : 0;
  const attempted = Number(progress.questions_attempted || 0);
  const correct = Number(progress.questions_correct || 0);
  const accuracy = attempted ? correct / attempted * 100 : 0;
  const completion = Math.min(100, Math.round(attempted / config.target * 100));
  const remaining = Math.max(0, config.target - attempted);

  async function startBatch() {
    if (!user || starting || remaining <= 0) return;
    setStarting(true);
    setNotice('');
    const start = new Date(today + 'T00:00:00+01:00');
    const tomorrow = new Date(start.getTime() + 86400000);
    const { data: past, error: pastError } = await supabase.from('jamb_practice_attempts')
      .select('question_ids, answers').eq('user_id', user.id).eq('subject', subject)
      .gte('completed_at', start.toISOString()).lt('completed_at', tomorrow.toISOString());
    if (pastError) {
      setNotice('Could not load your earlier questions. Please try again.');
      setStarting(false);
      return;
    }
    const attemptedIds = new Set((past || []).flatMap(row =>
      Object.keys(row.answers || {}).filter(id => (row.question_ids || []).includes(id))
    ));
    const { data: pool, error: poolError } = await supabase.from('past_questions')
      .select('id').eq('exam_type', 'JAMB').eq('subject', subject).limit(1000);
    if (poolError || !pool?.length) {
      setNotice("Questions for today's challenge are temporarily unavailable.");
      setStarting(false);
      return;
    }
    const fresh = shuffle(pool.filter(q => !attemptedIds.has(q.id))).slice(0, Math.min(BATCH_SIZE, remaining));
    if (!fresh.length) {
      setNotice('You have attempted all unique questions currently available for this subject today.');
      setStarting(false);
      return;
    }
    window.location.href = '/jamb/practice?challenge=1&subject=' +
      encodeURIComponent(subject) + '&ids=' + fresh.map(q => q.id).join(',');
  }

  async function claimReward() {
    if (claiming || attempted < config.target || rewardClaimed) return;
    setClaiming(true);
    const { data, error } = await supabase.rpc('claim_daily_challenge_reward', { p_subject: subject });
    if (error || !data?.success) {
      setNotice(data?.message || 'Could not claim the reward. Please refresh and try again.');
    } else {
      setRewardClaimed(true);
      setNotice('🎉 Challenge completed! ' + data.points_awarded + ' points added to your all-time score.');
    }
    setClaiming(false);
  }

  if (loading) return <><Navbar /><main className="min-h-screen flex items-center justify-center bg-slate-50"><p className="font-bold text-brand-blue">Loading today’s challenge…</p></main><Footer /></>;

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-slate-50 pb-16">
        <div className="mx-auto max-w-5xl px-4 py-8">
          <section className="rounded-3xl bg-brand-blue p-6 text-white shadow-sm sm:p-8">
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-blue-100">SHINEY BRAIN ACADEMY · DAILY MISSION</p>
            <h1 className="mt-3 text-3xl font-black sm:text-4xl">{config.emoji} {config.title}</h1>
            <p className="mt-2 max-w-2xl text-blue-100">Answer today’s {config.target} unique {subject} questions. The more you attempt, the higher you climb. Accuracy breaks ties.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <span className="rounded-full bg-white/15 px-4 py-2 text-sm font-bold">🎯 Target: {config.target} questions</span>
              <span className="rounded-full bg-white/15 px-4 py-2 text-sm font-bold">🏆 Reward: +{config.reward} points</span>
              <span className="rounded-full bg-white/15 px-4 py-2 text-sm font-bold">📅 {today}</span>
            </div>
          </section>

          {notice && <div role="status" className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{notice}</div>}

          <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['Questions attempted', attempted + '/' + config.target],
              ['Correct answers', String(correct)],
              ['Accuracy', showAccuracy(accuracy)],
              ['Your daily rank', myRank ? '#' + myRank : 'Not ranked yet'],
            ].map(([label, value]) => <div key={label} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"><p className="text-sm font-semibold text-slate-500">{label}</p><p className="mt-2 text-2xl font-black text-brand-blue">{value}</p></div>)}
          </section>

          <section className="mt-5 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4"><h2 className="text-lg font-extrabold text-slate-900">Your mission progress</h2><span className="text-sm font-bold text-brand-blue">{completion}%</span></div>
            <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-brand-yellow transition-all" style={{ width: completion + '%' }} /></div>
            <p className="mt-3 text-sm text-slate-600">{remaining ? remaining + ' unique questions left to complete today’s mission.' : 'Mission target completed! Keep practising.'}</p>
            <button onClick={startBatch} disabled={starting || remaining === 0} className="mt-5 w-full rounded-xl bg-brand-yellow px-5 py-3 font-extrabold text-brand-dark disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto">{starting ? 'Preparing questions…' : remaining === 0 ? '🎉 Mission completed' : 'Answer ' + Math.min(BATCH_SIZE, remaining) + ' questions'}</button>
            {attempted >= config.target && <button onClick={claimReward} disabled={claiming || rewardClaimed} className="mt-3 w-full rounded-xl bg-green-600 px-5 py-3 font-extrabold text-white disabled:opacity-60 sm:ml-3 sm:mt-5 sm:w-auto">{claiming ? 'Claiming reward…' : rewardClaimed ? '✓ Reward claimed' : 'Claim +' + config.reward + ' points'}</button>}
            <button onClick={load} className="ml-0 mt-3 rounded-xl border border-slate-200 px-5 py-3 font-bold text-slate-700 sm:ml-3">Refresh rankings</button>
            <p className="mt-3 text-xs text-slate-500">Only unique questions with submitted answers count. Your first answer to each question is used for today’s score.</p>
          </section>

          <section className="mt-6 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
            <div className="border-b p-5"><h2 className="text-xl font-black text-slate-900">🏆 Today’s {subject} rankings</h2><p className="mt-1 text-sm text-slate-500">Most questions attempted wins. Accuracy breaks ties.</p></div>
            {ranked.length ? <div className="divide-y divide-slate-100">{ranked.map((row, index) => {
              const isMe = row.user_id === user?.id;
              return <div key={row.user_id} className={'flex items-center gap-3 p-4 sm:gap-4 ' + (isMe ? 'bg-yellow-50' : 'bg-white')}>
                <span className="w-9 text-center text-lg font-black">{MEDALS[index] || '#' + (index + 1)}</span>
                <div className="min-w-0 flex-1"><p className="truncate font-extrabold text-slate-900">{names[row.user_id] || (isMe ? 'You' : 'Student')}{isMe ? ' (You)' : ''}</p><p className="text-xs text-slate-500">{row.questions_attempted}/{config.target} questions · {row.questions_correct} correct</p></div>
                <div className="text-right"><p className="font-black text-brand-blue">{showAccuracy(row.accuracy)}</p><p className="text-xs text-slate-400">accuracy</p></div>
              </div>;
            })}</div> : <div className="p-10 text-center"><p className="text-3xl">🚀</p><p className="mt-2 font-bold text-slate-700">Be the first on today’s board.</p><p className="mt-1 text-sm text-slate-500">Attempt a question to enter the competition.</p></div>}
          </section>

          <div className="mt-6 flex flex-wrap gap-3"><Link href="/leaderboard" className="rounded-xl border border-slate-200 bg-white px-5 py-3 font-bold text-slate-700">View all-time leaderboard</Link><Link href="/dashboard" className="rounded-xl border border-slate-200 bg-white px-5 py-3 font-bold text-slate-700">Back to dashboard</Link></div>
        </div>
      </main>
      <Footer />
    </>
  );
}
