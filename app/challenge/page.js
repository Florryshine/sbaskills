'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Link from 'next/link';
import { addPoints } from '@/lib/gamification';

export default function DailyChallengePage() {
  const [challenge, setChallenge] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState(null);
  const [user, setUser] = useState(null);
  const [streak, setStreak] = useState(0);
  const [error, setError] = useState(false);
  const router = useRouter();
  const supabase = createBrowserClient();

  useEffect(() => {
    async function loadChallenge() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.push('/login');
          return;
        }
        setUser(user);

        // Get user streak
        const { data: profile } = await supabase
          .from('profiles')
          .select('streak_days')
          .eq('id', user.id)
          .single();
        setStreak(profile?.streak_days || 0);

        const today = new Date().toISOString().split('T')[0];
        const { data: challengeData, error: challengeError } = await supabase
          .from('daily_challenges')
          .select('*')
          .eq('date', today)
          .maybeSingle();

        if (challengeError) {
          console.error('Error fetching challenge:', challengeError);
          setError(true);
          setLoading(false);
          return;
        }

        if (!challengeData) {
          setError(true);
          setLoading(false);
          return;
        }

        setChallenge(challengeData);
        setTimeLeft(challengeData.time_limit_minutes * 60);

        // Fetch question details
        const questionIds = challengeData.questions || [];
        if (questionIds.length > 0) {
          const { data: qs, error: qError } = await supabase
            .from('past_questions')
            .select('*')
            .in('id', questionIds);
          if (qError) {
            console.error('Error fetching questions:', qError);
            setError(true);
            setLoading(false);
            return;
          }
          setQuestions(qs || []);
        }

        // Check if user already attempted today
        const { data: existing, error: existingError } = await supabase
          .from('challenge_attempts')
          .select('*')
          .eq('user_id', user.id)
          .eq('challenge_id', challengeData.id)
          .maybeSingle();

        if (existing) {
          setSubmitted(true);
          setResult({
            score: existing.score,
            total: existing.total_questions,
          });
        }

        setLoading(false);
      } catch (err) {
        console.error('Error loading challenge:', err);
        setError(true);
        setLoading(false);
      }
    }

    loadChallenge();
  }, []);

  // Timer effect
  useEffect(() => {
    if (submitted || timeLeft === null || timeLeft <= 0) {
      if (timeLeft === 0 && !submitted && !loading) {
        handleSubmit();
      }
      return;
    }
    const timer = setInterval(() => {
      setTimeLeft(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft, submitted, loading]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleAnswer = (questionId, selected) => {
    setAnswers({ ...answers, [questionId]: selected });
  };

  const handleSubmit = async () => {
    if (submitted) return;
    setSubmitted(true);

    let correct = 0;
    const total = questions.length;

    questions.forEach(q => {
      if (answers[q.id] === q.correct_answer) correct++;
    });

    const score = correct;

    try {
      // Save attempt
      await supabase
        .from('challenge_attempts')
        .insert({
          user_id: user.id,
          challenge_id: challenge.id,
          score: score,
          total_questions: total,
          answers: answers,
          time_taken_seconds: (challenge.time_limit_minutes * 60) - timeLeft,
          completed_at: new Date(),
        });

      // Award XP
      const xp = score >= 8 ? 50 : score >= 5 ? 25 : 10;
      await addPoints(user.id, xp, 'Daily Challenge completed', 'daily_challenge', challenge.id);

      // Update streak
      await supabase
        .from('profiles')
        .update({ streak_days: streak + 1 })
        .eq('id', user.id);
    } catch (err) {
      console.error('Error saving attempt:', err);
    }

    setResult({ score, total });
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-blue"></div>
        </div>
        <Footer />
      </>
    );
  }

  if (error || !challenge) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen flex items-center justify-center flex-col p-4">
          <p className="text-4xl mb-4">⚡</p>
          <h1 className="text-2xl font-bold text-brand-blue">No Challenge Today</h1>
          <p className="text-gray-500">Check back tomorrow for a new challenge!</p>
          <Link href="/dashboard" className="mt-4 bg-brand-yellow px-6 py-3 rounded-full font-bold">
            Go to Dashboard
          </Link>
        </div>
        <Footer />
      </>
    );
  }

  const question = questions[currentIndex];
  const totalQuestions = questions.length;

  if (submitted && result) {
    const passed = result.score >= Math.ceil(result.total / 2);
    return (
      <>
        <Navbar />
        <main className="min-h-screen bg-gray-50 py-12">
          <div className="max-w-2xl mx-auto px-4">
            <div className="bg-white rounded-2xl shadow-sm border p-8 text-center">
              <p className="text-5xl mb-4">{passed ? '🎉' : '💪'}</p>
              <h1 className="text-2xl font-extrabold">Challenge Complete!</h1>
              <p className="text-4xl font-extrabold text-brand-blue mt-4">{result.score}/{result.total}</p>
              <p className="text-gray-600 mt-2">Accuracy: {Math.round((result.score / result.total) * 100)}%</p>
              <p className="text-sm text-gray-500 mt-2">🔥 {streak + 1} day streak!</p>
              {result.score === result.total && (
                <div className="mt-3 bg-yellow-50 rounded-xl p-3 text-brand-blue font-bold">⭐ Perfect Score!</div>
              )}
              <Link href="/dashboard" className="mt-6 inline-block bg-brand-yellow px-6 py-3 rounded-full font-bold">
                Back to Dashboard
              </Link>
            </div>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  if (!question || totalQuestions === 0) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen flex items-center justify-center flex-col p-4">
          <p className="text-4xl mb-4">❌</p>
          <h1 className="text-2xl font-bold text-brand-blue">No Questions Found</h1>
          <p className="text-gray-500">The daily challenge hasn't been set up yet. Check back later!</p>
          <Link href="/dashboard" className="mt-4 bg-brand-yellow px-6 py-3 rounded-full font-bold">
            Go to Dashboard
          </Link>
        </div>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-3xl mx-auto px-4">
          <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
            <div className="p-6 border-b bg-gradient-to-r from-brand-blue to-blue-600 text-white">
              <div className="flex justify-between items-center">
                <div>
                  <h1 className="text-xl font-extrabold">🔥 Today's Challenge</h1>
                  <p className="text-sm opacity-80">{challenge.subject || 'Mixed'} • {challenge.difficulty || 'Medium'}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold">⏱️ {formatTime(timeLeft)}</p>
                  <p className="text-xs opacity-80">Question {currentIndex + 1} of {totalQuestions}</p>
                </div>
              </div>
            </div>

            <div className="p-6">
              <p className="text-lg font-medium mb-6">{question.question}</p>
              <div className="space-y-3">
                {['a', 'b', 'c', 'd'].map((letter) => {
                  const option = question[`option_${letter}`];
                  if (!option) return null;
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
                onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                disabled={currentIndex === 0}
                className="px-4 py-2 rounded-full border border-gray-300 hover:bg-gray-100 disabled:opacity-50"
              >
                Previous
              </button>
              {currentIndex === totalQuestions - 1 ? (
                <button
                  onClick={handleSubmit}
                  className="bg-brand-yellow text-brand-dark px-6 py-2 rounded-full font-bold hover:opacity-90"
                >
                  Submit Challenge
                </button>
              ) : (
                <button
                  onClick={() => setCurrentIndex(prev => Math.min(totalQuestions - 1, prev + 1))}
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