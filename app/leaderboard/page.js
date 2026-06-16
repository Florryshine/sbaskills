'use client';
import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

const LEVELS = [
  { min: 0, name: 'Rookie', emoji: '🥚' },
  { min: 100, name: 'Scholar', emoji: '📚' },
  { min: 300, name: 'Achiever', emoji: '⭐' },
  { min: 600, name: 'Champion', emoji: '🏆' },
  { min: 1000, name: 'Legend', emoji: '👑' },
];

function getLevel(points) {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (points >= LEVELS[i].min) return LEVELS[i];
  }
  return LEVELS[0];
}

const MEDAL = ['🥇', '🥈', '🥉'];

export default function LeaderboardPage() {
  const [leaders, setLeaders] = useState([]);
  const [challenges, setChallenges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('leaderboard');
  const supabase = createClientComponentClient();

  useEffect(() => {
    async function fetchData() {
      const { data: points } = await supabase
        .from('user_points')
        .select('*, profiles(full_name, email)')
        .order('points', { ascending: false })
        .limit(20);

      const { data: ch } = await supabase
        .from('weekly_challenges')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

      setLeaders(points || []);
      setChallenges(ch || []);
      setLoading(false);
    }
    fetchData();
  }, []);

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gray-50">
        <section className="bg-brand-blue py-16 text-center text-white">
          <h1 className="text-4xl font-extrabold mb-3">🏆 Leaderboard</h1>
          <p className="text-blue-100 text-lg">
            Top students earn badges, points and bragging rights!
          </p>
        </section>

        <div className="max-w-4xl mx-auto px-4 pt-8">
          <div className="flex gap-3 mb-8">
            {['leaderboard', 'challenges', 'badges'].map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-5 py-2 rounded-full text-sm font-bold capitalize 
                            transition ${tab === t
                  ? 'bg-brand-blue text-white shadow'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-brand-blue'
                }`}
              >
                {t === 'leaderboard' ? '🏆 Top Students'
                  : t === 'challenges' ? '⚡ Challenges'
                  : '🎖️ Badges'}
              </button>
            ))}
          </div>

          {tab === 'leaderboard' && (
            <div>
              {loading ? (
                <p className="text-center text-gray-500 py-20">Loading...</p>
              ) : leaders.length === 0 ? (
                <div className="text-center py-20">
                  <p className="text-5xl mb-4">🏁</p>
                  <h2 className="text-2xl font-bold text-gray-700 mb-2">No rankings yet</h2>
                  <p className="text-gray-500">Be the first to earn points!</p>
                </div>
              ) : (
                <div className="flex flex-col gap-4 pb-12">
                  {leaders.map((entry, i) => {
                    const level = getLevel(entry.points || 0);
                    return (
                      <div key={entry.id}
                        className={`flex items-center gap-4 bg-white rounded-2xl 
                                    shadow-sm border p-4 transition hover:shadow-md
                                    ${i === 0 ? 'border-brand-yellow ring-2 ring-brand-yellow'
                                              : 'border-gray-100'}`}
                      >
                        <div className="text-2xl w-10 text-center font-extrabold">
                          {i < 3 ? MEDAL[i] : `#${i + 1}`}
                        </div>
                        <div className="w-12 h-12 rounded-full bg-brand-blue 
                                        flex items-center justify-center text-white 
                                        font-bold text-lg flex-shrink-0">
                          {(entry.profiles?.full_name || 'S')[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-gray-800 truncate">
                            {entry.profiles?.full_name || 'Student'}
                          </p>
                          <p className="text-xs text-gray-500">
                            {level.emoji} {level.name}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-xl font-extrabold text-brand-blue">
                            {entry.points || 0}
                          </p>
                          <p className="text-xs text-gray-400">points</p>
                        </div>
                        {entry.streak > 0 && (
                          <div className="bg-brand-yellow rounded-full px-3 py-1 flex-shrink-0">
                            <p className="text-xs font-bold text-brand-dark">
                              🔥 {entry.streak}d
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {tab === 'challenges' && (
            <div className="pb-12">
              {challenges.length === 0 ? (
                <div className="text-center py-20">
                  <p className="text-5xl mb-4">⚡</p>
                  <h2 className="text-2xl font-bold text-gray-700 mb-2">No challenges yet</h2>
                  <p className="text-gray-500">Weekly challenges coming soon!</p>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {challenges.map((ch) => (
                    <div key={ch.id}
                      className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-bold text-gray-800 text-lg">{ch.title}</h3>
                        <span className="bg-brand-yellow text-brand-dark text-xs 
                                         font-bold px-3 py-1 rounded-full">
                          +{ch.points_reward || 50} pts
                        </span>
                      </div>
                      <p className="text-gray-500 text-sm mb-4">{ch.description}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-400">
                          Ends: {ch.end_date
                            ? new Date(ch.end_date).toLocaleDateString('en-NG')
                            : 'Ongoing'}
                        </span>
                        <span className={`text-xs font-bold px-3 py-1 rounded-full
                          ${ch.is_active
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-500'}`}>
                          {ch.is_active ? '🟢 Active' : '⏹ Ended'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'badges' && (
            <div className="pb-12">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {[
                  { name: 'First Blood', emoji: '🩸', desc: 'Complete your first lesson', pts: 10 },
                  { name: 'Scholar', emoji: '📚', desc: 'Reach 100 points', pts: 100 },
                  { name: 'Consistency King', emoji: '👑', desc: '7-day streak', pts: 200 },
                  { name: 'Challenge Champion', emoji: '⚡', desc: 'Win a weekly challenge', pts: 300 },
                  { name: 'Blog Reader', emoji: '📰', desc: 'Read 5 blog posts', pts: 50 },
                  { name: 'Audio Addict', emoji: '🎧', desc: 'Listen to 10 audio files', pts: 75 },
                  { name: 'Legend', emoji: '🌟', desc: 'Reach 1000 points', pts: 1000 },
                  { name: 'Top 3', emoji: '🏆', desc: 'Reach top 3 on leaderboard', pts: 500 },
                ].map((badge) => (
                  <div key={badge.name}
                    className="bg-white rounded-2xl border border-gray-100 
                               shadow-sm p-5 text-center hover:shadow-md transition">
                    <p className="text-4xl mb-2">{badge.emoji}</p>
                    <p className="font-bold text-gray-800 text-sm">{badge.name}</p>
                    <p className="text-xs text-gray-500 mt-1">{badge.desc}</p>
                    <p className="text-xs font-bold text-brand-blue mt-2">+{badge.pts} pts</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}