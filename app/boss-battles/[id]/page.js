'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

const DIFFICULTY_CONFIG = {
  1: { timePerQuestion: 60, xpMultiplier: 1.0, label: 'Easy' },
  2: { timePerQuestion: 50, xpMultiplier: 1.2, label: 'Moderate' },
  3: { timePerQuestion: 40, xpMultiplier: 1.5, label: 'Hard' },
  4: { timePerQuestion: 30, xpMultiplier: 1.8, label: 'Expert' },
  5: { timePerQuestion: 20, xpMultiplier: 2.0, label: 'Master' },
};

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
  const [timeLeft, setTimeLeft] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const [selectedDifficulty, setSelectedDifficulty] = useState(3);
  const [battleStarted, setBattleStarted] = useState(false);

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
        // Use boss difficulty if available, else default to 3
        if (data.difficulty) {
          setSelectedDifficulty(Math.min(Math.max(data.difficulty, 1), 5));
        }
      }
      setLoading(false);
    }
    loadBoss();
  }, [id]);

  // Timer logic – only run when battle started and not showing result
  useEffect(() => {
    if (!battleStarted || !boss || showResult) return;

    const config = DIFFICULTY_CONFIG[selectedDifficulty] || DIFFICULTY_CONFIG[3];
    const timePerQuestion = config.timePerQuestion;
    setTotalTime(timePerQuestion);
    setTimeLeft(timePerQuestion);

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          if (!answered) {
            // Time's up: mark as answered (no score)
            setAnswered(true);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [battleStarted, currentIndex, selectedDifficulty, boss, showResult]);

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

  const startBattle = () => {
    setBattleStarted(true);
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
    const config = DIFFICULTY_CONFIG[selectedDifficulty] || DIFFICULTY_CONFIG[3];
    const baseXP = boss.xp_reward || 100;
    const xpEarned = Math.round(baseXP * config.xpMultiplier);

    return (
      <>
        <Navbar />
        <div className="p-8 max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold text-brand-blue mb-4">🏁 Boss Battle Complete!</h1>
          <div className="bg-white rounded-2xl shadow-lg border p-6 text-center">
            <p className="text-4xl mb-2">🎉</p>
            <p className="text-xl font-bold">You scored {score} out of {total}!</p>
            <p className="text-lg text-gray-600">{percentage}% correct</p>
            <p className="text-lg text-brand-yellow font-bold mt-2">+{xpEarned} XP earned</p>
            {score === total && <p className="text-green-600 font-bold mt-2">🔥 Perfect! You defeated the boss!</p>}
            <a href="/boss-battles" className="inline-block mt-4 bg-brand-yellow px-6 py-2 rounded-xl font-bold">Back to Bosses</a>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  // ── Difficulty selection before battle ──────────────────
  if (!battleStarted) {
    const config = DIFFICULTY_CONFIG[selectedDifficulty] || DIFFICULTY_CONFIG[3];
    return (
      <>
        <Navbar />
        <div className="p-8 max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold text-brand-blue mb-2">{boss.keyword}</h1>
          <p className="text-sm text-gray-500 mb-4">Choose your difficulty level to start the battle.</p>
          <div className="bg-white rounded-2xl shadow-lg border p-6">
            <label className="block text-sm font-semibold mb-2">Select Difficulty</label>
            <select
              value={selectedDifficulty}
              onChange={(e) => setSelectedDifficulty(parseInt(e.target.value))}
              className="w-full rounded-xl border border-slate-200 px-4 py-2 mb-4"
            >
              {Object.entries(DIFFICULTY_CONFIG).map(([level, cfg]) => (
                <option key={level} value={parseInt(level)}>
                  Level {level}: {cfg.label} – {cfg.timePerQuestion}s per question (XP x{cfg.xpMultiplier})
                </option>
              ))}
            </select>
            <div className="bg-slate-50 p-4 rounded-xl mb-4">
              <p className="text-sm">
                <span className="font-semibold">Questions:</span> {questions.length}
              </p>
              <p className="text-sm">
                <span className="font-semibold">Time per question:</span> {config.timePerQuestion}s
              </p>
              <p className="text-sm">
                <span className="font-semibold">Total time:</span> {questions.length * config.timePerQuestion}s
              </p>
              <p className="text-sm">
                <span className="font-semibold">Base XP:</span> {boss.xp_reward || 100} × {config.xpMultiplier} = {Math.round((boss.xp_reward || 100) * config.xpMultiplier)} XP
              </p>
            </div>
            <button
              onClick={startBattle}
              className="w-full bg-brand-yellow text-brand-dark py-3 rounded-xl font-bold hover:opacity-90"
            >
              Start Battle
            </button>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  // ── Battle mode ──────────────────────────────────────────
  const q = questions[currentIndex];
  const progress = ((currentIndex + 1) / questions.length) * 100;

  return (
    <>
      <Navbar />
      <div className="p-8 max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-2">
          <h1 className="text-2xl font-bold text-brand-blue">{boss.keyword}</h1>
          <div className="text-sm font-semibold">
            <span className={`${timeLeft <= 10 ? 'text-red-600' : 'text-gray-600'}`}>
              ⏱️ {timeLeft}s
            </span>
          </div>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Question {currentIndex+1} of {questions.length}
        </p>

        <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
          <div
            className="bg-brand-yellow h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

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