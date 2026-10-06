'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { createBrowserClient } from '@/lib/supabase';
import { getUserPoints, updateStreak } from '@/lib/gamification';
import { getLevelInfo } from '@/lib/levels';

function daysUntil(date) {
  return Math.max(0, Math.ceil((date.getTime() - Date.now()) / 86400000));
}

function pct(correct, total) {
  return total ? Math.round((correct / total) * 100) : 0;
}

export default function StudentCommandCenter() {
  const supabase = createBrowserClient();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [mission, setMission] = useState(null);
  const [attempts, setAttempts] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [points, setPoints] = useState(0);
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);
  const [mastery, setMastery] = useState(null);
  const [curriculum, setCurriculum] = useState(null);
  const [target, setTarget] = useState(null);

  useEffect(() => {
    let active = true;

    async function load() {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) {
        window.location.href = '/login';
        return;
      }

      const userId = auth.user.id;
      setUser(auth.user);

      // Keep the existing streak system, but do not award a new login bonus here.
      await updateStreak(userId);

      const [profileResult, pointsResult, targetResult, attemptsResult, notificationsResult] = await Promise.all([
        supabase.from('profiles').select('full_name, target_score, target_course, interests').eq('id', userId).maybeSingle(),
        getUserPoints(userId),
        supabase.from('student_exam_targets').select('exam_type, exam_year, curriculum_id').eq('user_id', userId).eq('status', 'active').eq('exam_type', 'JAMB').order('exam_year', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('jamb_practice_attempts').select('id, subject, topic, score, total_questions, weak_topics, completed_at').eq('user_id', userId).order('completed_at', { ascending: false }).limit(20),
        supabase.from('student_notifications').select('id, type, title, body, action_url, created_at, read_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(5),
      ]);

      let curriculum = null;
      if (targetResult.data?.curriculum_id) {
        const { data } = await supabase.from('curricula').select('id, code, name, exam_start_date, exam_end_date, date_status, effective_from_year, effective_to_year').eq('id', targetResult.data.curriculum_id).maybeSingle();
        curriculum = data;
      }
      if (!curriculum) {
        const { data } = await supabase.from('curricula')
          .select('id, code, name, exam_start_date, exam_end_date, date_status, effective_from_year, effective_to_year')
          .eq('exam_type', 'JAMB')
          .eq('status', 'active')
          .order('effective_from_year', { ascending: false })
          .limit(1)
          .maybeSingle();
        curriculum = data;
      }

      let masteryResult = { data: null };
      if (curriculum?.id) {
        masteryResult = await supabase.from('student_progress_summary')
          .select('mastery_percent, topics_total, topics_started, topics_mastered')
          .eq('user_id', userId)
          .eq('curriculum_id', curriculum.id)
          .maybeSingle();
      }

      let missionResult = { data: null };
      if (curriculum?.id) {
        missionResult = await supabase
          .from('student_daily_missions')
          .select('id, title, mission_date, status, target_minutes, completed_at, student_daily_mission_items(id, item_order, activity_type, subject, topic, target_count, completed, question_ids, knowledge_asset_id, game_topic_id)')
          .eq('user_id', userId)
          .eq('curriculum_id', curriculum.id)
          .eq('mission_date', new Date().toISOString().slice(0, 10))
          .maybeSingle();
      }

      if (!active) return;
      setProfile(profileResult.data);
      setPoints(pointsResult.total_points || 0);
      setStreak(pointsResult.streak_days || 0);
      setAttempts(attemptsResult.data || []);
      setNotifications(notificationsResult.data || []);
      setMastery(masteryResult.data || null);
      setMission(missionResult.data || null);
      setCurriculum(curriculum);
      setTarget(targetResult.data || null);
      setLoading(false);
    }

    load().catch((error) => {
      console.error('Command centre load error:', error);
      if (active) setLoading(false);
    });

    return () => { active = false; };
  }, []);

  const stats = useMemo(() => {
    const total = attempts.reduce((sum, a) => sum + (a.total_questions || 0), 0);
    const correct = attempts.reduce((sum, a) => sum + (a.score || 0), 0);
    const subjectTotals = {};
    attempts.forEach((a) => {
      if (!a.subject) return;
      subjectTotals[a.subject] ||= { correct: 0, total: 0 };
      subjectTotals[a.subject].correct += a.score || 0;
      subjectTotals[a.subject].total += a.total_questions || 0;
    });
    const ranked = Object.entries(subjectTotals)
      .map(([subject, v]) => ({ subject, accuracy: pct(v.correct, v.total) }))
      .sort((a, b) => b.accuracy - a.accuracy);

    return {
      accuracy: pct(correct, total),
      attempts: attempts.length,
      strongest: ranked[0] || null,
      weakest: ranked[ranked.length - 1] || null,
    };
  }, [attempts]);

  const level = getLevelInfo(points);
  const examDate = curriculum?.exam_start_date ? new Date(`${curriculum.exam_start_date}T00:00:00+01:00`) : null;
  const examDays = examDate ? daysUntil(examDate) : null;
  const targetLabel = target?.exam_year ? `${target.exam_type} ${target.exam_year}` : 'JAMB';
  const masteryPercent = mastery?.mastery_percent || 0;
  const missionItems = [...(mission?.student_daily_mission_items || [])].sort((a, b) => (a.item_order || 0) - (b.item_order || 0));
  const completedItems = missionItems.filter((item) => item.completed).length;
  const missionProgress = missionItems.length ? Math.round((completedItems / missionItems.length) * 100) : 0;
  const firstItem = missionItems.find((item) => !item.completed) || missionItems[0];
  const firstHref = firstItem?.id
    ? `/jamb/practice?item=${encodeURIComponent(firstItem.id)}`
    : '/jamb/practice';

  if (loading) {
    return (
      <>
        <Navbar />
        <main className="min-h-screen bg-slate-50 flex items-center justify-center">
          <div className="text-center"><p className="text-4xl">🎯</p><p className="mt-3 font-bold text-brand-blue">Preparing your command centre...</p></div>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-slate-50 pb-16">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
          <section className="rounded-3xl bg-brand-blue p-6 text-white shadow-sm sm:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-blue-100">{targetLabel} • STUDENT COMMAND CENTRE</p>
                <h1 className="mt-2 text-3xl font-black sm:text-4xl">
                  What are we doing today, {profile?.full_name?.split(' ')[0] || user?.email?.split('@')[0]}?
                </h1>
                <p className="mt-2 max-w-2xl text-sm text-blue-100">One clear mission. Then your next best action. No feature hunting.</p>
              </div>
              <div className="rounded-2xl bg-white/10 px-5 py-4 text-left lg:min-w-52">
                <p className="text-xs font-bold text-blue-100">Exam countdown</p>
                <p className="mt-1 text-3xl font-black">{examDays === null ? '—' : `${examDays} days`}</p>
                <p className="text-xs text-blue-100">{curriculum?.exam_start_date ? `${new Date(`${curriculum.exam_start_date}T00:00:00+01:00`).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}${curriculum.date_status !== 'official' ? ' • working date' : ''}` : 'Exam date not set'}</p>
              </div>
            </div>
          </section>

          <section className="mt-5 grid gap-5 lg:grid-cols-[1.5fr_1fr]">
            <div className="rounded-3xl border bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-brand-yellow">TODAY'S MISSION</p>
                  <h2 className="mt-1 text-2xl font-black text-slate-900">{mission?.title || 'Your mission is being prepared'}</h2>
                  <p className="mt-1 text-sm text-slate-500">{mission?.target_minutes || 30} minutes • {missionItems.length || 0} activities</p>
                </div>
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-extrabold text-brand-blue">{mission?.status || 'Not ready'}</span>
              </div>
              <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-brand-blue transition-all" style={{ width: `${missionProgress}%` }} />
              </div>
              <p className="mt-2 text-xs font-bold text-slate-500">{completedItems}/{missionItems.length || 0} complete</p>

              {missionItems.length ? (
                <div className="mt-5 space-y-3">
                  {missionItems.map((item, index) => (
                    <div key={item.id} className="flex items-center gap-3 rounded-2xl border p-4">
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-black ${item.completed ? 'bg-green-100 text-green-700' : 'bg-blue-50 text-brand-blue'}`}>
                        {item.completed ? '✓' : index + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-extrabold text-slate-800">{item.activity_type === 'practice' ? 'Practice' : item.activity_type || 'Study'}{item.subject ? ` • ${item.subject}` : ''}</p>
                        {item.topic && <p className="mt-0.5 truncate text-xs text-slate-500">{item.topic}</p>}
                      </div>
                      <span className="text-xs font-bold text-slate-400">{item.target_count || 1}x</span>
                    </div>
                  ))}
                  <Link href={firstHref} className="mt-2 block rounded-2xl bg-brand-yellow px-5 py-3 text-center font-black text-brand-dark">
                    {mission.status === 'completed' ? 'Mission complete ✓' : 'Start mission →'}
                  </Link>
                </div>
              ) : (
                <div className="mt-5 rounded-2xl bg-slate-50 p-5">
                  <p className="font-bold text-slate-800">No mission has been generated yet.</p>
                  <p className="mt-1 text-sm text-slate-500">The external Daily Mission worker will prepare it automatically.</p>
                  <Link href="/jamb/practice" className="mt-4 inline-block rounded-xl bg-brand-blue px-4 py-2 text-sm font-extrabold text-white">Quick practice →</Link>
                </div>
              )}
            </div>

            <div className="space-y-5">
              <div className="rounded-3xl border bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div><p className="text-xs font-extrabold uppercase tracking-[0.18em] text-slate-400">YOUR LEVEL</p><p className="mt-1 text-2xl font-black text-brand-blue">Level {level.level}</p></div>
                  <span className="text-3xl">🔥</span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-slate-50 p-3"><p className="text-xl font-black">{points}</p><p className="text-xs text-slate-500">XP</p></div>
                  <div className="rounded-2xl bg-slate-50 p-3"><p className="text-xl font-black">{streak}</p><p className="text-xs text-slate-500">day streak</p></div>
                </div>
                <div className="mt-4 h-2 rounded-full bg-slate-100"><div className="h-full rounded-full bg-brand-blue" style={{width:`${Math.min(100, level.progressPct || 0)}%`}} /></div>
              </div>

              <div className="rounded-3xl border bg-white p-6 shadow-sm">
                <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-slate-400">PERFORMANCE</p>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div><p className="text-2xl font-black">{stats.accuracy}%</p><p className="text-xs text-slate-500">accuracy</p></div>
                  <div><p className="text-2xl font-black">{stats.attempts}</p><p className="text-xs text-slate-500">practice sessions</p></div>
                </div>
                <div className="mt-4 text-sm">
                  <p><span className="font-bold text-green-700">Strongest:</span> {stats.strongest ? `${stats.strongest.subject} (${stats.strongest.accuracy}%)` : 'Not enough data'}</p>
                  <p className="mt-1"><span className="font-bold text-red-700">Weakest:</span> {stats.weakest ? `${stats.weakest.subject} (${stats.weakest.accuracy}%)` : 'Not enough data'}</p>
                </div>
                <div className="mt-4 flex flex-wrap gap-3"><Link href="/jamb/progress" className="text-sm font-extrabold text-brand-blue">View full progress →</Link><Link href="/jamb/syllabus-mastery" className="text-sm font-extrabold text-brand-blue">Syllabus mastery →</Link></div>
              </div>
            </div>
          </section>

          <section className="mt-5 grid gap-5 md:grid-cols-3">
            <div className="rounded-3xl border bg-white p-6 shadow-sm">
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-slate-400">EXAM TARGET</p>
              <h2 className="mt-2 text-xl font-black text-brand-blue">{targetLabel}</h2>
              <p className="mt-1 text-sm text-slate-500">{profile?.target_course ? `Target course: ${profile.target_course}` : "Set your target course in your profile."}</p>
              {profile?.target_score ? <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-sm font-extrabold">Target score: {profile.target_score}</p> : null}
            </div>
            <div className="rounded-3xl border bg-white p-6 shadow-sm">
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-slate-400">SYLLABUS MASTERY</p>
              <div className="mt-2 flex items-end justify-between gap-3"><h2 className="text-3xl font-black text-brand-blue">{masteryPercent}%</h2><span className="text-xs font-bold text-slate-500">{mastery?.topics_mastered || 0}/{mastery?.topics_total || 0} mastered</span></div>
              <div className="mt-3 h-2 rounded-full bg-slate-100"><div className="h-full rounded-full bg-brand-blue" style={{ width: `${masteryPercent}%` }} /></div>
              <Link href="/jamb/syllabus-mastery" className="mt-3 inline-block text-sm font-extrabold text-brand-blue">Open mastery →</Link>
            </div>
            <div className="rounded-3xl border bg-white p-6 shadow-sm">
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-slate-400">KEEP THE STREAK</p>
              <h2 className="mt-2 text-xl font-black">{streak} day{streak === 1 ? "" : "s"}</h2>
              <p className="mt-1 text-sm text-slate-500">Practice today to keep building momentum.</p>
              <Link href="/jamb/practice" className="mt-3 inline-block rounded-xl bg-brand-yellow px-4 py-2 text-sm font-black text-brand-dark">Practice now →</Link>
            </div>
          </section>
          <section className="mt-5 grid gap-5 md:grid-cols-2">
            <div className="rounded-3xl border bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between"><h2 className="text-xl font-black">Next best actions</h2><span>⚡</span></div>
              <div className="mt-4 space-y-3">
                <Link href="/jamb/practice" className="flex items-center justify-between rounded-2xl border p-4 hover:border-brand-blue"><span><b>Quick practice</b><br/><small className="text-slate-500">Do 10 JAMB questions</small></span><span>→</span></Link>
                <Link href="/jamb/study" className="flex items-center justify-between rounded-2xl border p-4 hover:border-brand-blue"><span><b>Study your subjects</b><br/><small className="text-slate-500">Continue your syllabus journey</small></span><span>→</span></Link>
                <Link href="/jamb/progress" className="flex items-center justify-between rounded-2xl border p-4 hover:border-brand-blue"><span><b>Check weak areas</b><br/><small className="text-slate-500">See what needs more work</small></span><span>→</span></Link>
              </div>
            </div>

            <div className="rounded-3xl border bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between"><h2 className="text-xl font-black">Notifications</h2><Link href="/notifications" className="text-sm font-extrabold text-brand-blue">View all →</Link></div>
              {notifications.length ? (
                <div className="mt-4 space-y-3">
                  {notifications.slice(0, 3).map((n) => (
                    <Link key={n.id} href={n.action_url || '#'} className={`block rounded-2xl p-4 ${n.read_at ? 'bg-slate-50' : 'bg-blue-50'}`}>
                      <p className="font-bold text-slate-800">{n.title}</p>
                      <p className="mt-1 text-xs text-slate-500">{n.body}</p>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">Nothing new. Keep moving.</p>
              )}
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
