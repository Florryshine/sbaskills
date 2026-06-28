'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Link from 'next/link';
import { addPoints } from '@/lib/gamification';

export default function BossBattlesPage() {
  const [bosses, setBosses] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedBoss, setSelectedBoss] = useState(null);
  const [battleState, setBattleState] = useState(null);
  const [questions, setQuestions] = useState([]);
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
    const question = questions[battleState.currentQuestionIndex];
    if (!question) return;

    const isCorrect = selected === question.correct_answer;
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

    return (
      <>
        <Navbar />
        <main className="min-h-screen bg-gray-900 text-white py-8">
          <div className="max-w-3xl mx-auto px-4">
            <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
              <div className="flex justify-between items-center mb-4">
                <h1 className="text-2xl font-extrabold text-brand-yellow">👹 {selectedBoss.name}</h1>
                <div className="text-right">
                  <p className="text-sm">❤️ {battleState.lives} lives</p>
                  <p className="text-sm">💪 Question {battleState.currentQuestionIndex + 1}/{totalQuestions}</p>
                </div>
              </div>

              <div className="mb-4">
                <p className="text-sm text-gray-400">Boss Health</p>
                <div className="w-full bg-gray-700 rounded-full h-4">
                  <div className="bg-red-500 h-4 rounded-full transition-all" style={{ width: `${battleState.bossHealth}%` }} />
                </div>
                <p className="text-xs text-right mt-1">{battleState.bossHealth}%</p>
              </div>

              {question && (
                <>
                  <p className="text-lg font-medium mb-6">{question.question}</p>
                  <div className="space-y-3">
                    {['a', 'b', 'c', 'd'].map((letter) => {
                      const option = question[`option_${letter}`];
                      if (!option) return null;
                      return (
                        <button
                          key={letter}
                          onClick={() => handleAnswer(question.id, letter)}
                          className="w-full text-left px-4 py-3 rounded-xl border border-gray-600 hover:border-brand-yellow hover:bg-gray-700 transition"
                        >
                          <span className="font-bold mr-2">{letter.toUpperCase()}.</span> {option}
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