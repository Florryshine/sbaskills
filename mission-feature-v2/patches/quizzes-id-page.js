'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase';
import { addPoints } from '@/lib/gamification';

// XP awarded for a content-engine (draft) quiz. Unlike the manual `quizzes`
// table, quiz_drafts has no points_reward-style column of its own, so this
// is a flat default matching STEP_XP.quiz in lib/journeyEngine.js — keep
// the two in sync if you change one.
const DRAFT_QUIZ_XP = 20;

export default function QuizAttempt() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params.id;
  const isDraft = searchParams.get('draft') === 'true';
  const supabase = createBrowserClient();

  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user || null));
  }, [supabase]);

  useEffect(() => {
    async function loadQuiz() {
      setLoading(true);
      let data, error;

      if (isDraft) {
        // Fetch from quiz_drafts
        const result = await supabase
          .from('quiz_drafts')
          .select('*')
          .eq('id', id)
          .eq('status', 'published')
          .single();
        data = result.data;
        error = result.error;
      } else {
        // Fetch from manual quizzes + questions
        const { data: quizData, error: quizError } = await supabase
          .from('quizzes')
          .select('id, title, description, points_reward')
          .eq('id', id)
          .single();
        if (quizError) {
          setError(quizError.message);
          setLoading(false);
          return;
        }
        const { data: questions, error: qError } = await supabase
          .from('quiz_questions')
          .select('*')
          .eq('quiz_id', id);
        if (qError) {
          setError(qError.message);
          setLoading(false);
          return;
        }
        // Manual quiz_questions rows use flat option_a-d columns and store
        // correct_answer as a letter ('a'/'b'/'c'/'d'), not the option text.
        // The render below only reads q.options (an array) and compares
        // answers against option TEXT, so without this normalization every
        // manually-uploaded quiz taken from this page showed no options at
        // all, and even if it had, scoring would have compared a letter
        // against full option text and always come out wrong.
        const normalizedQuestions = (questions || []).map((q) => {
          const options = [q.option_a, q.option_b, q.option_c, q.option_d].filter(Boolean);
          const letter = (q.correct_answer || '').trim().toLowerCase();
          const correctText = q[`option_${letter}`] || q.correct_answer;
          return { ...q, options, correct_answer: correctText };
        });
        data = { ...quizData, questions: normalizedQuestions };
        error = null;
      }

      if (error || !data) {
        setError('Quiz not found or not published.');
      } else {
        setQuiz(data);
      }
      setLoading(false);
    }
    loadQuiz();
  }, [id, isDraft]);

  const handleAnswer = (questionIndex, option) => {
    setAnswers({ ...answers, [questionIndex]: option });
  };

  const handleSubmit = async () => {
    // Calculate score
    const questions = quiz.questions || [];
    let correct = 0;
    questions.forEach((q, idx) => {
      if (answers[idx] === q.correct_answer) correct++;
    });
    setScore(correct);
    setSubmitted(true);

    // Previously this page only scored client-side and never wrote
    // anything to the database for draft (content-engine) quizzes — added
    // so the Journey Engine (lib/journeyEngine.js) has something to detect
    // and so students actually earn XP for these quizzes, matching what
    // the manual-quiz path (/quiz/[id]) already does.
    if (isDraft && user && questions.length > 0) {
      const scorePct = Math.round((correct / questions.length) * 100);

      await supabase.from('quiz_attempts').insert({
        student_id: user.id,
        quiz_id: id, // this is the quiz_drafts id, not a quizzes id
        score: scorePct,
        total_questions: questions.length,
        answers,
        completed_at: new Date(),
      });

      if (scorePct >= (quiz.passing_score || 70)) {
        await addPoints(user.id, DRAFT_QUIZ_XP, `Completed quiz: ${quiz.keyword || quiz.title}`, 'quiz_complete', id);
      }
    }
  };

  if (loading) return <div className="p-8 text-center">Loading quiz...</div>;
  if (error) return <div className="p-8 text-center text-red-600">{error}</div>;
  if (!quiz) return <div className="p-8 text-center">No quiz found.</div>;

  const questions = quiz.questions || [];
  const total = questions.length;

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-brand-blue mb-2">{quiz.title || quiz.keyword}</h1>
      <p className="text-sm text-gray-500 mb-4">{quiz.description}</p>
      {!submitted ? (
        <>
          {questions.map((q, idx) => (
            <div key={idx} className="mb-6 p-4 border rounded-xl bg-white shadow-sm">
              <p className="font-semibold mb-2">{idx+1}. {q.question}</p>
              <div className="space-y-2">
                {(q.options || []).map((opt, oi) => (
                  <label key={oi} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={`q${idx}`}
                      value={opt}
                      checked={answers[idx] === opt}
                      onChange={() => handleAnswer(idx, opt)}
                    />
                    {opt}
                  </label>
                ))}
              </div>
            </div>
          ))}
          <button
            onClick={handleSubmit}
            className="bg-brand-yellow px-6 py-2 rounded-full font-bold hover:opacity-90"
          >
            Submit Quiz
          </button>
        </>
      ) : (
        <div className="p-6 bg-green-50 border border-green-200 rounded-xl text-center">
          <h2 className="text-2xl font-bold text-green-700">🎉 Quiz Complete!</h2>
          <p className="text-lg mt-2">You got {score} out of {total} correct.</p>
          <p className="text-sm text-gray-500 mt-1">Score: {Math.round((score/total)*100)}%</p>
        </div>
      )}
    </div>
  );
}