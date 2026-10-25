'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createBrowserClient } from '@/lib/supabase';

export default function QuizReviewPage() {
  const { id } = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const attemptId = searchParams.get('attempt');
  const isDraft = searchParams.get('draft') === 'true';
  const supabase = createBrowserClient();
  const [view, setView] = useState({ loading: true, error: '', title: '', attempt: null, questions: [] });

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push(`/login?next=${encodeURIComponent(`/quiz/${id}/review`)}`); return; }

      let attemptQuery = supabase.from('quiz_attempts')
        .select('id,score,total_questions,answers,completed_at')
        .eq('student_id', user.id).not('completed_at', 'is', null);
      attemptQuery = isDraft ? attemptQuery.eq('draft_quiz_id', id) : attemptQuery.eq('quiz_id', id);
      attemptQuery = attemptId
        ? attemptQuery.eq('id', attemptId)
        : attemptQuery.order('completed_at', { ascending: false }).limit(1);

      const [attempts, quiz, questions] = await Promise.all([
        attemptQuery,
        isDraft
          ? supabase.from('quiz_drafts').select('keyword,questions').eq('id', id).maybeSingle()
          : supabase.from('quizzes').select('title').eq('id', id).maybeSingle(),
        isDraft
          ? Promise.resolve({ data: null, error: null })
          : supabase.from('quiz_questions').select('*').eq('quiz_id', id).order('order_index', { ascending: true }),
      ]);
      const attempt = attempts.data?.[0] || null;
      const failure = attempts.error || questions.error;
      const normalizedQuestions = isDraft
        ? (quiz.data?.questions || []).map((q, index) => ({ ...q, id: String(index), _draft: true }))
        : (questions.data || []);
      setView({
        loading: false,
        error: failure ? failure.message : (!attempt ? 'No completed attempt found for this quiz yet.' : ''),
        title: quiz.data?.title || quiz.data?.keyword || 'Quiz',
        attempt,
        questions: normalizedQuestions,
      });
    }
    load();
  }, [id, attemptId, isDraft]);

  if (view.loading) return <div className="p-8 text-center">Loading corrections...</div>;
  if (view.error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600">{view.error}</p>
        <Link href={`/quiz/${id}`} className="underline font-bold">Take the quiz</Link>
      </div>
    );
  }

  const { attempt, questions } = view;
  const answers = attempt.answers || {};
  const matched = questions.some((q) => answers[q.id] !== undefined);

  return (
    <main className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-extrabold">{view.title}: Corrections</h1>
      <p className="text-sm text-gray-500 mb-4">
        Score {attempt.score}% · {new Date(attempt.completed_at).toLocaleString('en-NG')}
      </p>
      {!matched && (
        <p className="mb-4 rounded-lg bg-yellow-50 p-3 text-sm">
          No answers from this attempt could be matched to the questions. Retake the quiz to see full corrections.
        </p>
      )}
      <div className="space-y-4">
        {questions.map((q, index) => {
          const selected = String(answers[q.id] ?? answers[String(index)] ?? '').trim();
          const correct = String(q.correct_answer || '').trim();
          const text = (letter) => q[`option_${letter}`] || '';
          const isLetter = /^[a-d]$/i.test(correct);
          const ok = selected.toLowerCase() === correct.toLowerCase();
          const selectedDisplay = q._draft ? (selected || 'Not answered') : (isLetter ? (selected ? `${selected.toUpperCase()}. ${text(selected.toLowerCase())}` : 'Not answered') : (selected || 'Not answered'));
          const correctDisplay = q._draft ? (correct || 'Not available') : (isLetter ? `${correct.toUpperCase()}. ${text(correct.toLowerCase())}` : (correct || 'Not available'));
          return (
            <article key={q.id} className={`rounded-xl border p-4 ${ok ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
              <p className="font-bold">{index + 1}. {q.question}</p>
              <p className="mt-2 text-sm">Your answer: <strong>{selectedDisplay}</strong></p>
              <p className="text-sm">Correct answer: <strong>{correctDisplay}</strong></p>
              {q.explanation ? (
                <div className="mt-3 pt-3 border-t border-black/10">
                  <p className="text-sm font-bold">Explanation</p>
                  <p className="text-sm mt-1 whitespace-pre-wrap">{q.explanation}</p>
                </div>
              ) : (
                <p className="mt-2 text-xs text-gray-500">No explanation has been added for this question yet.</p>
              )}
            </article>
          );
        })}
      </div>
      <Link href={`/quiz/${id}`} className="inline-block mt-6 bg-brand-blue text-white px-6 py-3 rounded-full font-bold">Retake quiz</Link>
    </main>
  );
}