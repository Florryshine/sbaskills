import { createServerClient } from '@/lib/supabase-server';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Link from 'next/link';

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

export default async function LeaderboardPage() {
  const supabase = createServerClient();

  // Fetch user points
  const { data: leaders } = await supabase
    .from('user_points')
    .select('user_id, total_points, level, streak_days')
    .order('total_points', { ascending: false })
    .limit(20);

  // Fetch user profiles (names)
  const userIds = leaders?.map(l => l.user_id) || [];
  let usersMap = {};
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', userIds);
    usersMap = Object.fromEntries((profiles || []).map(p => [p.id, p]));
  }

  // Fetch challenges
  const { data: challenges } = await supabase
    .from('weekly_challenges')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  // Combine data
  const leaderData = (leaders || []).map((entry, index) => {
    const profile = usersMap[entry.user_id] || {};
    const level = getLevel(entry.total_points || 0);
    return {
      ...entry,
      rank: index + 1,
      full_name: profile.full_name || 'Student',
      email: profile.email || '',
      levelName: level.name,
      levelEmoji: level.emoji,
      medal: index < 3 ? MEDAL[index] : null,
    };
  });

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

        <div className="max-w-4xl mx-auto px-4 py-8">
          {/* Tabs */}
          <div className="flex gap-3 mb-8">
            {[
              { id: 'leaderboard', label: '🏆 Top Students' },
              { id: 'challenges', label: '⚡ Challenges' },
              { id: 'badges', label: '🎖️ Badges' },
            ].map((tab) => (
              <button
                key={tab.id}
                className={`px-5 py-2 rounded-full text-sm font-bold capitalize transition ${
                  tab.id === 'leaderboard'
                    ? 'bg-brand-blue text-white shadow'
                    : 'bg-white text-gray-600 border border-gray-200 hover:border-brand-blue'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Leaderboard List */}
          {leaderData.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-5xl mb-4">🏁</p>
              <h2 className="text-2xl font-bold text-gray-700 mb-2">No rankings yet</h2>
              <p className="text-gray-500">Be the first to earn points!</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4 pb-12">
              {leaderData.map((entry) => (
                <div
                  key={entry.user_id}
                  className={`flex items-center gap-4 bg-white rounded-2xl shadow-sm border p-4 transition hover:shadow-md ${
                    entry.rank === 1
                      ? 'border-brand-yellow ring-2 ring-brand-yellow'
                      : 'border-gray-100'
                  }`}
                >
                  <div className="text-2xl w-10 text-center font-extrabold">
                    {entry.medal || `#${entry.rank}`}
                  </div>
                  <div className="w-12 h-12 rounded-full bg-brand-blue flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                    {(entry.full_name || 'S')[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-800 truncate">{entry.full_name}</p>
                    <p className="text-xs text-gray-500">
                      {entry.levelEmoji} {entry.levelName}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xl font-extrabold text-brand-blue">
                      {entry.total_points || 0}
                    </p>
                    <p className="text-xs text-gray-400">points</p>
                  </div>
                  {entry.streak_days > 0 && (
                    <div className="bg-brand-yellow rounded-full px-3 py-1 flex-shrink-0">
                      <p className="text-xs font-bold text-brand-dark">
                        🔥 {entry.streak_days}d
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Challenges Section (simplified) */}
          <div className="mt-8">
            <h2 className="text-xl font-bold mb-4">⚡ Weekly Challenges</h2>
            {challenges?.length > 0 ? (
              <div className="flex flex-col gap-4">
                {challenges.map((ch) => (
                  <div key={ch.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-bold text-gray-800 text-lg">{ch.title}</h3>
                      <span className="bg-brand-yellow text-brand-dark text-xs font-bold px-3 py-1 rounded-full">
                        +{ch.points_reward || 50} pts
                      </span>
                    </div>
                    <p className="text-gray-500 text-sm mb-4">{ch.description}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400">
                        Ends: {ch.end_date ? new Date(ch.end_date).toLocaleDateString('en-NG') : 'Ongoing'}
                      </span>
                      <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                        ch.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {ch.is_active ? '🟢 Active' : '⏹ Ended'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
                <p className="text-4xl mb-4">⚡</p>
                <p className="text-gray-500">No challenges yet – check back soon!</p>
              </div>
            )}
          </div>

          {/* Badges Section (static) */}
          <div className="mt-8">
            <h2 className="text-xl font-bold mb-4">🎖️ Badges</h2>
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
                <div key={badge.name} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 text-center hover:shadow-md transition">
                  <p className="text-4xl mb-2">{badge.emoji}</p>
                  <p className="font-bold text-gray-800 text-sm">{badge.name}</p>
                  <p className="text-xs text-gray-500 mt-1">{badge.desc}</p>
                  <p className="text-xs font-bold text-brand-blue mt-2">+{badge.pts} pts</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}