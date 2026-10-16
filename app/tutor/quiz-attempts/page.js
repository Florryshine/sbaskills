'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createBrowserClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function QuizAttemptsPage() {
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
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
        .select('id,student_id,quiz_id,score,total_questions,completed_at,answers')
        .in('quiz_id', quizzes.map(q => q.id))
        .order('completed_at', { ascending: false });

      if (attemptsError) setError(attemptsError.message);
      else setAttempts((data || []).map(a => ({ ...a, quiz_title: quizMap[a.quiz_id] || 'Quiz' })));
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
          <p className="text-sm text-gray-600 mt-1">Attempts recorded for quizzes you created. Students who take a quiz as guests are not included because their attempts are not linked to an account.</p>
        </div>
        {error && <div role="alert" className="bg-red-50 text-red-700 border border-red-200 rounded-xl p-4">Could not load attempts: {error}. Check the quiz_attempts table permissions in Supabase.</div>}
        {!attempts.length && !error && <div className="bg-white rounded-2xl border p-6 text-gray-600">No saved quiz attempts yet.</div>}
        {attempts.length > 0 && <div className="bg-white rounded-2xl border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-left"><tr><th className="p-3">Quiz</th><th className="p-3">Student ID</th><th className="p-3">Score</th><th className="p-3">Submitted</th><th className="p-3">Answers</th></tr></thead>
            <tbody>{attempts.map(a => <tr key={a.id} className="border-t align-top">
              <td className="p-3 font-semibold">{a.quiz_title}</td>
              <td className="p-3 break-all">{a.student_id || 'Guest / unknown'}</td>
              <td className="p-3 whitespace-nowrap">{a.score}% ({Math.round((Number(a.score) || 0) * (Number(a.total_questions) || 0) / 100)} / {a.total_questions})</td>
              <td className="p-3 whitespace-nowrap">{a.completed_at ? new Date(a.completed_at).toLocaleString() : '—'}</td>
              <td className="p-3">{a.answers ? Object.keys(a.answers).length : 0} responses</td>
            </tr>)}</tbody>
          </table>
        </div>}
      </div>
    </main>
  );
}
