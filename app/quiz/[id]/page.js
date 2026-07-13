'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import { useParams, useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { addPoints } from '@/lib/gamification';
import { awardEligibleBadges } from '@/lib/badges';

export default function TakeQuiz() {
  const [quiz, setQuiz] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState(null);
  const { id } = useParams();
  const router = useRouter();
  const supabase = createBrowserClient();

  useEffect(() => {
    async function loadQuiz() {
      const { data: quizData } = await supabase
        .from('quizzes')
        .select('*')
        .eq('id', id)
        .eq('is_published', true)
        .single();

      if (!quizData) {
        router.push('/courses');
        return;
      }
      setQuiz(quizData);
      setTimeLeft(quizData.time_limit_minutes * 60);

      const { data: questionData } = await supabase
        .from('quiz_questions')
        .select('*')
        .eq('quiz_id', id)
        .order('order_index', { ascending: true });

      setQuestions(questionData || []);
      setLoading(false);
    }

    loadQuiz();
  }, [id, router]);

  useEffect(() => {
    if (timeLeft === null || submitted) return;
    if (timeLeft <= 0) {
      handleSubmit();
      return;
    }
    const timer = setInterval(() => {
      setTimeLeft(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft, submitted]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleAnswer = (questionId, answer) => {
    setAnswers({ ...answers, [questionId]: answer });
  };

  const handleSubmit = async () => {
    if (submitted) return;
    setSubmitted(true);

    let correct = 0;
    let total = questions.length;

    questions.forEach(q => {
      if (answers[q.id] === q.correct_answer) {
        correct++;
      }
    });

    const scorePercent = Math.round((correct / total) * 100);
    setScore(scorePercent);

    const { data: { user } } = await supabase.auth.getUser();

    // Save attempt
    await supabase
      .from('quiz_attempts')
      .insert({
        student_id: user.id,
        quiz_id: id,
        score: scorePercent,
        total_questions: total,
        answers: answers,
        completed_at: new Date(),
      });

    // Award points if passing
    if (scorePercent >= 50) {
      await addPoints(user.id, quiz.points_reward || 10, `Completed quiz: ${quiz.title}`, 'quiz_complete', id);
      awardEligibleBadges(supabase, user.id).catch((e) => console.error('Badge check failed:', e));
    }
  };

  if (loading) return (
    <>
      <Navbar />
      <div className="min-h-screen flex items-center justify-center">Loading quiz...</div>
      <Footer />
    </>
  );

  if (submitted) {
    const passed = score >= 50;
    return (
      <>
        <Navbar />
        <main className="min-h-screen bg-gray-50 py-12">
          <div className="max-w-2xl mx-auto px-4">
            <div className="bg-white rounded-2xl shadow-sm border p-8 text-center">
              <p className="text-6xl mb-4">{passed ? '🎉' : '💪'}</p>
              <h1 className="text-3xl font-extrabold">{passed ? 'Quiz Completed!' : 'Keep Practicing!'}</h1>
              <p className="text-2xl font-bold text-brand-blue mt-4">{score}%</p>
              <p className="text-gray-600 mt-2">
                {passed
                  ? `You earned ${quiz.points_reward || 10} points!`
                  : 'Review the material and try again.'}
              </p>
              <div className="mt-6 flex gap-4 justify-center">
                <button onClick={() => router.push('/courses')} className="bg-brand-blue text-white px-6 py-3 rounded-full font-bold hover:opacity-90">
                  Browse Courses
                </button>
                <button onClick={() => router.push('/dashboard')} className="bg-brand-yellow text-brand-dark px-6 py-3 rounded-full font-bold hover:opacity-90">
                  Dashboard
                </button>
              </div>
            </div>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  const question = questions[currentQuestion];
  const totalQuestions = questions.length;

  if (totalQuestions === 0) {
    return (
      <>
        <Navbar />
        <main className="min-h-screen bg-gray-50 py-12">
          <div className="max-w-2xl mx-auto px-4 text-center">
            <div className="bg-white rounded-2xl shadow-sm border p-8">
              <p className="text-5xl mb-4">📭</p>
              <h1 className="text-2xl font-bold text-gray-800">This quiz has no questions yet</h1>
              <p className="text-gray-500 mt-2">Please check back later.</p>
              <button onClick={() => router.push('/courses')} className="mt-6 bg-brand-blue text-white px-6 py-3 rounded-full font-bold hover:opacity-90">
                Browse Courses
              </button>
            </div>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-3xl mx-auto px-4">
          <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
            <div className="p-6 border-b">
              <div className="flex justify-between items-center">
                <div>
                  <h1 className="text-xl font-extrabold text-gray-900">{quiz.title}</h1>
                  <p className="text-xs text-gray-500 mt-1">Question {currentQuestion + 1} of {totalQuestions}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-brand-blue">⏱️ {formatTime(timeLeft)}</p>
                  <p className="text-xs text-gray-500">Points: {quiz.points_reward || 10}</p>
                </div>
              </div>
            </div>

            <div className="p-6">
              <p className="text-lg font-medium mb-6">{question.question}</p>
              <div className="space-y-3">
                {['a', 'b', 'c', 'd'].map((letter) => {
                  const option = question[`option_${letter}`];
                  return (
                    <button
                      key={letter}
                      onClick={() => handleAnswer(question.id, letter)}
                      className={`w-full text-left px-4 py-3 rounded-xl border transition ${
                        answers[question.id] === letter
                          ? 'border-brand-blue bg-blue-50'
                          : 'border-gray-200 hover:border-brand-blue hover:bg-gray-50'
                      }`}
                    >
                      <span className="font-bold mr-2">{letter.toUpperCase()}.</span> {option}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="p-6 border-t bg-gray-50 flex justify-between">
              <button
                onClick={() => setCurrentQuestion(prev => Math.max(0, prev - 1))}
                disabled={currentQuestion === 0}
                className="px-4 py-2 rounded-full border border-gray-300 hover:bg-gray-100 disabled:opacity-50"
              >
                Previous
              </button>
              {currentQuestion === totalQuestions - 1 ? (
                <button
                  onClick={handleSubmit}
                  className="bg-brand-yellow text-brand-dark px-6 py-2 rounded-full font-bold hover:opacity-90"
                >
                  Submit Quiz
                </button>
              ) : (
                <button
                  onClick={() => setCurrentQuestion(prev => Math.min(totalQuestions - 1, prev + 1))}
                  className="bg-brand-blue text-white px-6 py-2 rounded-full font-bold hover:opacity-90"
                >
                  Next
                </button>
              )}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}