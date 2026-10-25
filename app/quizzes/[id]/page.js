'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase';
import { addPoints } from '@/lib/gamification';
import { awardEligibleBadges } from '@/lib/badges';

export default function QuizAttempt() {
  const { id } = useParams();
  const router = useRouter();
  const supabase = createBrowserClient();

  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(null);
  const [user, setUser] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      if (!cancelled) setUser(data?.user || null);
    });
    return () => { cancelled = true; };
  }, [supabase]);

  useEffect(() => {
    let cancelled = false;
    async function loadQuiz() {
      setLoading(true);
      const { data: quizData, error: quizError } = await supabase
        .from('quizzes')
        .select('id, title, description, points_reward, time_limit_minutes')
        .eq('id', id)
        .eq('is_published', true)
        .single();

      if (quizError || !quizData) {
        if (!cancelled) {
          setError('Quiz not found or not published.');
          setLoading(false);
        }
        return;
      }

      const { data: questionData, error: questionsError } = await supabase
        .from('quiz_questions')
        .select('*')
        .eq('quiz_id', id)
        .order('order_index', { ascending: true });

      if (questionsError) {
        if (!cancelled) {
          setError('Could not load quiz questions. Please try again.');
          setLoading(false);
        }
        return;
      }

      const normalizedQuestions = (questionData || []).map((q) => {
        const options = [q.option_a, q.option_b, q.option_c, q.option_d].filter(Boolean);
        const rawAnswer = String(q.correct_answer || '').trim();
        const answerLetter = rawAnswer.toLowerCase();
        const correctAnswer = options.includes(rawAnswer)
          ? rawAnswer
          : (['a', 'b', 'c', 'd'].includes(answerLetter)
            ? q[`option_${answerLetter}`]
            : rawAnswer);
        return { ...q, options, correct_answer: correctAnswer };
      });

      if (!cancelled) {
        setQuiz({ ...quizData, questions: normalizedQuestions });
        setLoading(false);
      }
    }

    loadQuiz();
    return () => { cancelled = true; };
  }, [id, supabase]);

  const handleAnswer = (questionIndex, option) => {
    setAnswers((previous) => ({ ...previous, [questionIndex]: option }));
  };

  const handleSubmit = async () => {
    if (submitted || submitting) return;

    // Quiz content is public to view, but submitting and recording a score
    // always requires a real signed-in account.
    const { data: authData } = await supabase.auth.getUser();
    const activeUser = authData?.user || null;
    setUser(activeUser);
    if (!activeUser) {
      router.push(`/login?next=${encodeURIComponent(`/quiz/${id}`)}`);
      return;
    }

    const currentQuestions = quiz?.questions || [];
    if (!currentQuestions.length) {
      setError('This quiz has no questions yet.');
      return;
    }

    setSubmitting(true);
    const correct = currentQuestions.reduce(
      (count, question, index) => count + (answers[index] === question.correct_answer ? 1 : 0),
      0
    );
    const scorePct = Math.round((correct / currentQuestions.length) * 100);
    const now = new Date().toISOString();

    const { error: attemptError } = await supabase.from('quiz_attempts').insert({
      student_id: activeUser.id,
      quiz_id: id,
      score: scorePct,
      total_questions: currentQuestions.length,
      answers,
      status: 'completed',
      started_at: now,
      updated_at: now,
      completed_at: now,
    });

    if (attemptError) {
      console.error('Could not save quiz attempt:', attemptError);
      setError('We could not save your result. Please try submitting again.');
      setSubmitting(false);
      return;
    }

    setScore(correct);
    setSubmitted(true);
    setSubmitting(false);

    if (scorePct >= 50) {
      await addPoints(activeUser.id, quiz.points_reward || 10, `Completed quiz: ${quiz.title}`, 'quiz_complete', id);
      awardEligibleBadges(supabase, activeUser.id).catch((e) => console.error('Badge check failed:', e));
    }
  };

  if (loading) return <div className="p-8 text-center">Loading quiz...</div>;
  if (error && !quiz) return <div className="p-8 text-center text-red-600">{error}</div>;
  if (!quiz) return <div className="p-8 text-center">No quiz found.</div>;

  const questions = quiz.questions || [];
  const total = questions.length;

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-brand-blue mb-2">{quiz.title}</h1>
      <p className="text-sm text-gray-500 mb-4">{quiz.description}</p>
      {!submitted ? (
        <>
          {questions.map((q, idx) => (
            <div key={q.id || idx} className="mb-6 p-4 border rounded-xl bg-white shadow-sm">
              <p className="font-semibold mb-2">{idx + 1}. {q.question}</p>
              <div className="space-y-2">
                {q.options.map((option, optionIndex) => (
                  <label key={optionIndex} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={`q${idx}`}
                      value={option}
                      checked={answers[idx] === option}
                      onChange={() => handleAnswer(idx, option)}
                    />
                    {option}
                  </label>
                ))}
              </div>
            </div>
          ))}
          {error && <p className="text-red-600 mb-3">{error}</p>}
          {!user && (
            <p className="text-sm text-gray-600 mb-3">
              You can view the questions without an account. Log in or register to submit and save your result.
            </p>
          )}
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="bg-brand-yellow px-6 py-2 rounded-full font-bold hover:opacity-90 disabled:opacity-60"
          >
            {submitting ? 'Submitting...' : user ? 'Submit Quiz' : 'Log in to Submit'}
          </button>
        </>
      ) : (
        <div className="space-y-6">
          <div className="p-6 bg-green-50 border border-green-200 rounded-xl text-center">
            <h2 className="text-2xl font-bold text-green-700">Quiz Complete!</h2>
            <p className="text-lg mt-2">You got {score} out of {total} correct.</p>
            <p className="text-sm text-gray-500 mt-1">Score: {total ? Math.round((score / total) * 100) : 0}%</p>
            <p className="text-sm text-gray-600 mt-2">Your result has been saved to your student account.</p>
            <div className="flex flex-wrap gap-3 justify-center mt-5">
              <button onClick={() => { setAnswers({}); setScore(null); setSubmitted(false); setError(null); }} className="bg-brand-blue text-white px-5 py-2 rounded-full font-bold">
                Retake Quiz
              </button>
              <a href="#quiz-corrections" className="bg-brand-yellow px-5 py-2 rounded-full font-bold">
                View Corrections
              </a>
              <a href={`/quiz/${id}/review`} className="border px-5 py-2 rounded-full font-bold">
                Review Saved Attempt
              </a>
            </div>
          </div>
          <section id="quiz-corrections" className="bg-white border rounded-xl p-5 text-left">
            <h2 className="text-xl font-extrabold mb-4">Corrections & Explanations</h2>
            <div className="space-y-4">
              {questions.map((q, idx) => {
                const chosen = answers[idx];
                const correctAnswer = q.correct_answer;
                const isCorrect = chosen === correctAnswer;
                const correctOption = q.options.find((option) => option === correctAnswer);
                const explanation = q.explanation || q.explanation_text || q.rationale || '';
                return (
                  <article key={q.id || idx} className={`border rounded-xl p-4 ${isCorrect ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                    <p className="font-bold">{idx + 1}. {q.question}</p>
                    <p className="text-sm mt-2">Your answer: <strong>{chosen || 'Not answered'}</strong></p>
                    <p className="text-sm">Correct answer: <strong>{correctOption || correctAnswer || 'Not available'}</strong></p>
                    {explanation ? (
                      <div className="border-t border-black/10 mt-3 pt-3">
                        <p className="text-sm font-bold">Explanation</p>
                        <p className="text-sm whitespace-pre-wrap mt-1">{explanation}</p>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500 mt-2">No explanation was saved for this question.</p>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
