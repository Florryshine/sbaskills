'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createBrowserClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function QuizAttemptsPage() {
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [leaderboard, setLeaderboard] = useState([]);
  const supabase = createBrowserClient();
  const router = useRouter();

  useEffect(() => {
    async function loadAttempts() {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;
      if (!user) { router.push('/login'); return; }

      const { data: quizzes, error: quizError } = await supabase
        .from('quizzes')
        .select('id,title')
        .eq('tutor_id', user.id);

      if (quizError) {
        setError(quizError.message);
        setLoading(false);
        return;
      }
      if (!quizzes?.length) {
        setAttempts([]);
        setLoading(false);
        return;
      }

      const quizMap = Object.fromEntries(quizzes.map(q => [q.id, q.title]));
      const { data, error: attemptsError } = await supabase
        .from('quiz_attempts')
        .select('id,student_id,quiz_id,score,total_questions,completed_at,answers,status,started_at,updated_at')
        .in('quiz_id', quizzes.map(q => q.id))
        .order('updated_at', { ascending: false });

      if (attemptsError) {
        setError(attemptsError.message);
      } else {
        const rows = data || [];
        const studentIds = [...new Set(rows.map(a => a.student_id).filter(Boolean))];
        let profiles = [];
        if (studentIds.length) {
          const { data: profileRows } = await supabase.from('profiles')
            .select('id,full_name,email').in('id', studentIds);
          profiles = profileRows || [];
        }
        const profileMap = Object.fromEntries(profiles.map(p => [p.id, p]));
        const now = Date.now();
        const hydrated = rows.map(a => {
          const profile = profileMap[a.student_id] || {};
          const stale = a.status !== 'completed' && a.updated_at &&
            now - new Date(a.updated_at).getTime() > 30 * 60 * 1000;
          return {
            ...a,
            quiz_title: quizMap[a.quiz_id] || 'Quiz',
            student_name: profile.full_name || profile.email || 'Student profile unavailable',
            display_status: a.status === 'completed' || a.completed_at ? 'Completed' :
              stale ? 'Abandoned / inactive (inferred)' : 'In progress',
          };
        });
        setAttempts(hydrated);
        const bestByStudentQuiz = new Map();
        hydrated.filter(a => a.display_status === 'Completed').forEach(a => {
          const key = `${a.quiz_id}:${a.student_id}`;
          if (!bestByStudentQuiz.has(key) || Number(a.score || 0) > Number(bestByStudentQuiz.get(key).score || 0)) bestByStudentQuiz.set(key, a);
        });
        setLeaderboard([...bestByStudentQuiz.values()].sort((a,b) => a.quiz_title.localeCompare(b.quiz_title) || Number(b.score || 0) - Number(a.score || 0)));
      }
      setLoading(false);
    }
    loadAttempts();
  }, [router]);

  if (loading) return <div className="p-6">Loading quiz attempts...</div>;

  return (
    <main className="min-h-screen bg-gray-50 p-4 sm:p-8">
      <div className="max-w-5xl mx-auto space-y-5">
        <div className="bg-white rounded-2xl border p-6">
          <Link href="/tutor" className="text-sm text-blue-700 underline">← Tutor Dashboard</Link>
          <h1 className="text-2xl font-extrabold mt-3">Quiz Attempts</h1>
          <p className="text-sm text-gray-600 mt-1">Includes completed and saved in-progress attempts. Inactivity is only an estimate of abandonment, not proof.</p>
        </div>
        {error && <div role="alert" className="bg-red-50 text-red-700 border border-red-200 rounded-xl p-4">Could not load attempts: {error}. Check the quiz_attempts table permissions in Supabase.</div>}
        {!attempts.length && !error && <div className="bg-white rounded-2xl border p-6 text-gray-600">No saved quiz attempts yet.</div>}
        {leaderboard.length > 0 && <section className="bg-white rounded-2xl border overflow-x-auto">
          <div className="p-5 border-b"><h2 className="text-xl font-extrabold">Leaderboard — best score per student within each quiz</h2><p className="text-sm text-gray-500 mt-1">Scores are ranked separately within each quiz. Ties should be resolved using recorded submission times and the competition rules.</p></div>
          <table className="w-full text-sm"><thead className="bg-gray-100 text-left"><tr><th className="p-3">Rank</th><th className="p-3">Quiz</th><th className="p-3">Student</th><th className="p-3">Best score</th><th className="p-3">Submitted</th></tr></thead>
          <tbody>{leaderboard.map((a, i) => <tr key={a.id} className="border-t"><td className="p-3">{leaderboard.slice(0, i).filter(prev => prev.quiz_id === a.quiz_id).length + 1}</td><td className="p-3">{a.quiz_title}</td><td className="p-3">{a.student_name}</td><td className="p-3 font-bold">{a.score}%</td><td className="p-3">{a.completed_at ? new Date(a.completed_at).toLocaleString() : '—'}</td></tr>)}</tbody></table>
        </section>}
        {attempts.length > 0 && <div className="bg-white rounded-2xl border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-left"><tr><th className="p-3">Quiz</th><th className="p-3">Student</th><th className="p-3">Score</th><th className="p-3">Status</th><th className="p-3">Started / Updated</th><th className="p-3">Answers</th></tr></thead>
            <tbody>{attempts.map(a => <tr key={a.id} className="border-t align-top">
              <td className="p-3 font-semibold">{a.quiz_title}</td>
              <td className="p-3"><div className="font-semibold">{a.student_name}</div><div className="text-xs text-gray-500 break-all">{a.student_id || 'Unknown ID'}</div></td>
              <td className="p-3 whitespace-nowrap">{a.score}% ({Math.round((Number(a.score) || 0) * (Number(a.total_questions) || 0) / 100)} / {a.total_questions})</td>
              <td className="p-3 whitespace-nowrap">{a.display_status}</td><td className="p-3 whitespace-nowrap">Started: {a.started_at ? new Date(a.started_at).toLocaleString() : '—'}<br/>Updated: {a.updated_at ? new Date(a.updated_at).toLocaleString() : '—'}<br/>Submitted: {a.completed_at ? new Date(a.completed_at).toLocaleString() : '—'}</td>
              <td className="p-3">{a.answers ? Object.keys(a.answers).length : 0} answered / {Math.max(0, (Number(a.total_questions) || 0) - (a.answers ? Object.keys(a.answers).length : 0))} unanswered</td>
            </tr>)}</tbody>
          </table>
        </div>}
      </div>
    </main>
  );
}
