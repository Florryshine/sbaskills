import { createServerClient } from '@/lib/supabase-server';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Link from 'next/link';
import { getLevelInfo } from '@/lib/levels';

// Local getLevel wrapper kept for the tiny emoji lookup this page uses —
// the actual level/rank name+thresholds now come from lib/levels.js so
// this page can't drift out of sync with the dashboard/profile again.
function getLevel(points) {
  const info = getLevelInfo(points);
  const emojiByLevel = { 1: '🌱', 5: '📚', 10: '⚔️', 15: '🔥', 20: '👑' };
  const emojiKey = Object.keys(emojiByLevel)
    .map(Number)
    .filter((l) => l <= info.level)
    .sort((a, b) => b - a)[0];
  return { name: info.name, emoji: emojiByLevel[emojiKey] || '🌱' };
}

const MEDAL = ['🥇', '🥈', '🥉'];

export default async function LeaderboardPage() {
  const supabase = createServerClient();

  // Fetch user points (streak_days no longer read from here — see below)
  const { data: leaders } = await supabase
    .from('user_points')
    .select('user_id, total_points')
    .order('total_points', { ascending: false })
    .limit(20);

  // Fetch user profiles (names + canonical streak_days)
  const userIds = leaders?.map(l => l.user_id) || [];
  let usersMap = {};
  if (userIds.length > 0) {
    // Uses leaderboard_profiles (a view exposing only public-safe columns)
    // instead of profiles directly, since profiles' RLS is self-only
    // and would silently hide every other student's name here.
    const { data: profiles } = await supabase
      .from('leaderboard_profiles')
      .select('id, full_name, streak_days')
      .in('id', userIds);
    usersMap = Object.fromEntries((profiles || []).map(p => [p.id, p]));
  }

  // weekly_challenges uses week_start/week_end (there is no created_at,
  // end_date or is_active column in the live schema).
  const { data: challengeRows } = await supabase
    .from('weekly_challenges')
    .select('id, title, description, points_reward, week_start, week_end')
    .order('week_start', { ascending: false })
    .limit(5);

  const today = new Date().toISOString().slice(0, 10);
  const challenges = (challengeRows || []).map((challenge) => ({
    ...challenge,
    is_active: (!challenge.week_start || challenge.week_start <= today) &&
      (!challenge.week_end || challenge.week_end >= today),
  }));

  // Combine data
  const leaderData = (leaders || []).map((entry, index) => {
    const profile = usersMap[entry.user_id] || {};
    const level = getLevel(entry.total_points || 0);
    return {
      ...entry,
      rank: index + 1,
      full_name: profile.full_name || 'Student',
      streak_days: profile.streak_days || 0,
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
          {/* Navigation tabs scroll to their actual sections; these were inert buttons before. */}
          <nav aria-label="Leaderboard sections" className="mb-8 flex flex-wrap gap-3">
            {[
              { id: 'daily', label: '⚡ Daily Challenge', href: '/challenge' },
              { id: 'leaderboard', label: '🏆 All-Time' },
              { id: 'badges', label: '🎖️ Badges' },
            ].map((tab) => (
              <a
                key={tab.id}
                href={tab.href || `#${tab.id}`}
                className="rounded-full border border-gray-200 bg-white px-5 py-2 text-sm font-bold text-gray-600 transition hover:border-brand-blue hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-brand-blue"
              >
                {tab.label}
              </a>
            ))}
          </nav>

          {/* Leaderboard List */}
          <section id="leaderboard" className="scroll-mt-24">
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
          </section>

          {/* Badges Section (static) */}
          <section id="badges" className="mt-8 scroll-mt-24">
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
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}