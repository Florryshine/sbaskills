'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export default function BossBattleDetail() {
  const params = useParams();
  const id = params.id;
  const supabase = createBrowserClient();

  const [boss, setBoss] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState(null);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [showResult, setShowResult] = useState(false);

  useEffect(() => {
    async function loadBoss() {
      setLoading(true);
      const { data, error } = await supabase
        .from('boss_battle_drafts')
        .select('*')
        .eq('id', id)
        .eq('status', 'published')
        .single();

      if (error || !data) {
        setError('Boss not found or not published.');
      } else {
        setBoss(data);
      }
      setLoading(false);
    }
    loadBoss();
  }, [id]);

  const handleAnswer = (option) => {
    if (answered) return;
    setSelectedOption(option);
    setAnswered(true);

    const currentQ = boss.questions[currentIndex];
    if (option === currentQ.correct_answer) {
      setScore(score + 1);
    }
  };

  const nextQuestion = () => {
    if (currentIndex < boss.questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setSelectedOption(null);
      setAnswered(false);
    } else {
      setShowResult(true);
    }
  };

  if (loading) return <><Navbar /><div className="p-8 text-center">Loading boss...</div><Footer /></>;
  if (error) return <><Navbar /><div className="p-8 text-center text-red-600">{error}</div><Footer /></>;
  if (!boss) return <><Navbar /><div className="p-8 text-center">Boss not found.</div><Footer /></>;

  const questions = boss.questions || [];
  if (questions.length === 0) {
    return <><Navbar /><div className="p-8 text-center">No questions found for this boss.</div><Footer /></>;
  }

  if (showResult) {
    const total = questions.length;
    const percentage = Math.round((score / total) * 100);
    return (
      <>
        <Navbar />
        <div className="p-8 max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold text-brand-blue mb-4">🏁 Boss Battle Complete!</h1>
          <div className="bg-white rounded-2xl shadow-lg border p-6 text-center">
            <p className="text-4xl mb-2">🎉</p>
            <p className="text-xl font-bold">You scored {score} out of {total}!</p>
            <p className="text-lg text-gray-600">{percentage}% correct</p>
            {score === total && <p className="text-green-600 font-bold mt-2">🔥 Perfect! You defeated the boss!</p>}
            <a href="/boss-battles" className="inline-block mt-4 bg-brand-yellow px-6 py-2 rounded-xl font-bold">Back to Bosses</a>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  const q = questions[currentIndex];
  return (
    <>
      <Navbar />
      <div className="p-8 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-brand-blue mb-2">{boss.keyword}</h1>
        <p className="text-sm text-gray-500 mb-4">Question {currentIndex+1} of {questions.length}</p>
        <div className="bg-white rounded-2xl shadow-lg border p-6">
          <p className="text-lg font-semibold mb-4">{q.question}</p>
          <div className="space-y-3">
            {q.options.map((opt, idx) => {
              const isSelected = selectedOption === opt;
              const isCorrect = opt === q.correct_answer;
              let className = 'w-full text-left px-4 py-3 rounded-xl border transition';
              if (answered) {
                if (isCorrect) className += ' bg-green-100 border-green-400';
                else if (isSelected) className += ' bg-red-100 border-red-400';
                else className += ' bg-gray-50';
              } else {
                className += ' hover:bg-blue-50 hover:border-blue-300';
              }
              return (
                <button
                  key={idx}
                  onClick={() => handleAnswer(opt)}
                  disabled={answered}
                  className={className}
                >
                  {opt}
                </button>
              );
            })}
          </div>
          {answered && (
            <div className="mt-4 p-3 bg-gray-50 rounded-xl">
              <p className="text-sm font-semibold text-green-700">✅ Correct answer: {q.correct_answer}</p>
              <p className="text-sm text-gray-600 mt-1">{q.explanation}</p>
            </div>
          )}
          {answered && (
            <button
              onClick={nextQuestion}
              className="mt-4 bg-brand-blue text-white px-6 py-2 rounded-xl font-bold hover:opacity-90"
            >
              {currentIndex === questions.length - 1 ? 'See Results' : 'Next Question'}
            </button>
          )}
        </div>
      </div>
      <Footer />
    </>
  );
}