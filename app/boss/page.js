'use client';

import { useEffect, useState, useRef } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Link from 'next/link';
import { addPoints } from '@/lib/gamification';
import { awardEligibleBadges } from '@/lib/badges';

// Harder bosses give you less time per question. Difficulty 1 -> 30s,
// difficulty 5 -> 10s, in steps of 5, clamped to the 10-30s range.
function timeForDifficulty(difficulty) {
  const d = difficulty || 3;
  const seconds = 30 - (d - 1) * 5;
  return Math.max(10, Math.min(30, seconds));
}

export default function BossBattlesPage() {
  const [bosses, setBosses] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedBoss, setSelectedBoss] = useState(null);
  const [battleState, setBattleState] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [timeLeft, setTimeLeft] = useState(null);
  const timerRef = useRef(null);
  const router = useRouter();
  const supabase = createBrowserClient();

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      setUser(user);

      const { data: points } = await supabase
        .from('user_points')
        .select('total_points')
        .eq('user_id', user.id)
        .single();
      const userXp = points?.total_points || 0;

      const { data: bossData } = await supabase
        .from('boss_battles')
        .select('*')
        .order('difficulty', { ascending: true });

      const { data: attempts } = await supabase
        .from('boss_attempts')
        .select('boss_id, completed')
        .eq('user_id', user.id);

      const completedIds = attempts?.filter(a => a.completed).map(a => a.boss_id) || [];

      const bossesWithStatus = (bossData || []).map(boss => ({
        ...boss,
        isCompleted: completedIds.includes(boss.id),
        isUnlocked: userXp >= (boss.required_xp || 0),
      }));

      setBosses(bossesWithStatus);
      setLoading(false);
    }

    loadData();
  }, []);

  // Countdown timer — resets every time the question changes, cleans up on
  // unmount / when the battle ends.
  useEffect(() => {
    if (!selectedBoss || !battleState || battleState.completed) {
      clearInterval(timerRef.current);
      return;
    }

    const duration = timeForDifficulty(selectedBoss.difficulty);
    setTimeLeft(duration);

    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          handleAnswer(null, null); // time's up — counts as a wrong answer
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBoss, battleState?.currentQuestionIndex]);

  const startBattle = async (boss) => {
    // Fetch the full questions from past_questions
    const questionIds = boss.questions || [];
    if (questionIds.length === 0) {
      alert('This boss has no questions!');
      return;
    }
    const { data: qs } = await supabase
      .from('past_questions')
      .select('*')
      .in('id', questionIds);
    if (!qs || qs.length === 0) {
      alert('No questions found for this boss.');
      return;
    }
    setQuestions(qs);
    setSelectedBoss(boss);
    setBattleState({
      currentQuestionIndex: 0,
      lives: 3,
      bossHealth: boss.health || 100,
      damageDealt: 0,
      completed: false,
    });
  };

  const handleAnswer = async (questionId, selected) => {
    if (!battleState) return;
    clearInterval(timerRef.current);
    const question = questions[battleState.currentQuestionIndex];
    if (!question) return;

    // selected === null means the timer ran out — always wrong.
    const isCorrect = selected !== null && selected === question.correct_answer;
    let newState = { ...battleState };

    if (isCorrect) {
      const damage = 10 + Math.floor(Math.random() * 10);
      newState.damageDealt += damage;
      newState.bossHealth = Math.max(0, newState.bossHealth - damage);
    } else {
      newState.lives -= 1;
    }

    // Check if boss is defeated
    if (newState.bossHealth <= 0) {
      newState.completed = true;
      // Save victory
      await supabase
        .from('boss_attempts')
        .insert({
          user_id: user.id,
          boss_id: selectedBoss.id,
          damage_dealt: newState.damageDealt,
          lives_remaining: newState.lives,
          completed: true,
          score: Math.round((newState.damageDealt / selectedBoss.health) * 100),
          completed_at: new Date(),
        });

      // Award XP
      await addPoints(user.id, selectedBoss.reward_xp || 100, `Defeated ${selectedBoss.name}`, 'boss_defeated', selectedBoss.id);
      awardEligibleBadges(supabase, user.id).catch((e) => console.error('Badge check failed:', e));
      alert(`🏆 ${selectedBoss.name} defeated! You earned ${selectedBoss.reward_xp || 100} XP!`);
      setBattleState(newState);
      // Reload to refresh list
      window.location.reload();
      return;
    }

    // Check lives
    if (newState.lives <= 0) {
      alert('💀 You were defeated! Try again.');
      setBattleState(null);
      setSelectedBoss(null);
      setQuestions([]);
      return;
    }

    // Move to next question
    if (newState.currentQuestionIndex < questions.length - 1) {
      newState.currentQuestionIndex += 1;
      setBattleState(newState);
    } else {
      // All questions answered but boss not defeated
      alert('💪 You fought well, but the boss still stands! Try again.');
      setBattleState(null);
      setSelectedBoss(null);
      setQuestions([]);
    }
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen flex items-center justify-center">Loading boss battles...</div>
        <Footer />
      </>
    );
  }

  if (selectedBoss && battleState && !battleState.completed) {
    const question = questions[battleState.currentQuestionIndex];
    const totalQuestions = questions.length;
    const duration = timeForDifficulty(selectedBoss.difficulty);
    const timerPct = timeLeft !== null ? Math.round((timeLeft / duration) * 100) : 100;
    const timerLow = timeLeft !== null && timeLeft <= 5;

    return (
      <>
        <Navbar />
        <main className="min-h-screen bg-gray-50 py-8">
          <div className="max-w-3xl mx-auto px-4">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
              <div className="flex justify-between items-center mb-4">
                <h1 className="text-2xl font-extrabold text-brand-blue">👹 {selectedBoss.name}</h1>
                <div className="text-right">
                  <p className="text-sm text-red-500 font-semibold">❤️ {battleState.lives} lives</p>
                  <p className="text-sm text-gray-500">💪 Question {battleState.currentQuestionIndex + 1}/{totalQuestions}</p>
                </div>
              </div>

              <div className="mb-4">
                <p className="text-sm text-gray-500">Boss Health</p>
                <div className="w-full bg-gray-200 rounded-full h-4">
                  <div className="bg-red-500 h-4 rounded-full transition-all" style={{ width: `${battleState.bossHealth}%` }} />
                </div>
                <p className="text-xs text-right mt-1 text-gray-500">{battleState.bossHealth}%</p>
              </div>

              {/* Countdown timer */}
              <div className="mb-6">
                <div className="flex justify-between items-center mb-1">
                  <p className="text-sm text-gray-500">Time left</p>
                  <p className={`text-sm font-bold ${timerLow ? 'text-red-500' : 'text-brand-blue'}`}>{timeLeft}s</p>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all ${timerLow ? 'bg-red-500' : 'bg-brand-yellow'}`}
                    style={{ width: `${timerPct}%` }}
                  />
                </div>
              </div>

              {question && (
                <>
                  <p className="text-lg font-medium mb-6 text-gray-900">{question.question}</p>
                  <div className="space-y-3">
                    {['a', 'b', 'c', 'd'].map((letter) => {
                      const option = question[`option_${letter}`];
                      if (!option) return null;
                      return (
                        <button
                          key={letter}
                          onClick={() => handleAnswer(question.id, letter)}
                          className="w-full text-left px-4 py-3 rounded-xl border border-gray-200 hover:border-brand-blue hover:bg-blue-50 transition text-gray-800"
                        >
                          <span className="font-bold mr-2 text-brand-blue">{letter.toUpperCase()}.</span> {option}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
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
      <main className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-6xl mx-auto px-4">
          <h1 className="text-3xl font-extrabold text-brand-blue mb-2">👹 Boss Battles</h1>
          <p className="text-gray-600 mb-6">Defeat bosses by answering questions correctly!</p>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {bosses.map((boss) => (
              <div key={boss.id} className={`bg-white rounded-2xl shadow-sm border p-6 transition ${boss.isCompleted ? 'border-green-200 bg-green-50' : 'border-gray-200 hover:shadow-md'}`}>
                <div className="flex items-center justify-between">
                  <span className="text-3xl">👹</span>
                  {boss.isCompleted && <span className="text-green-600 font-bold">✅ Defeated</span>}
                </div>
                <h3 className="font-bold text-lg mt-2">{boss.name}</h3>
                <p className="text-sm text-gray-500">{boss.subject} • {boss.topic || 'General'}</p>
                <div className="mt-3 flex items-center gap-2 text-sm">
                  <span>⚔️ Difficulty {boss.difficulty}</span>
                  <span className="text-brand-yellow">⭐ +{boss.reward_xp} XP</span>
                  <span className="text-gray-400">⏱️ {timeForDifficulty(boss.difficulty)}s/question</span>
                </div>
                <button
                  onClick={() => startBattle(boss)}
                  disabled={boss.isCompleted || !boss.isUnlocked}
                  className={`mt-4 w-full px-4 py-2 rounded-full font-bold transition ${
                    boss.isCompleted
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : boss.isUnlocked
                      ? 'bg-brand-yellow text-brand-dark hover:opacity-90'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {boss.isCompleted ? '✅ Defeated' : boss.isUnlocked ? '⚔️ Battle' : '🔒 Locked'}
                </button>
              </div>
            ))}
          </div>
          {bosses.length === 0 && (
            <div className="text-center py-20">
              <p className="text-4xl mb-4">👹</p>
              <p className="text-gray-500">No bosses available yet. Check back soon!</p>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}