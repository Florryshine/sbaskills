'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Link from 'next/link';

export default function AchievementsPage() {
  const [achievements, setAchievements] = useState([]);
  const [userAchievements, setUserAchievements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const router = useRouter();
  const supabase = createBrowserClient();

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      setUser(user);

      // Fetch all achievements
      const { data: all } = await supabase
        .from('achievements')
        .select('*')
        .order('category', { ascending: true });

      // Fetch user's earned achievements
      const { data: earned } = await supabase
        .from('user_achievements')
        .select('achievement_id, earned_at')
        .eq('user_id', user.id);

      const earnedIds = earned?.map(e => e.achievement_id) || [];

      const achievementsWithStatus = (all || []).map(ach => ({
        ...ach,
        earned: earnedIds.includes(ach.id),
        earnedAt: earned?.find(e => e.achievement_id === ach.id)?.earned_at,
      }));

      setAchievements(achievementsWithStatus);
      setUserAchievements(earnedIds);
      setLoading(false);
    }

    loadData();
  }, []);

  const getCategoryEmoji = (category) => {
    const map = {
      'streak': '🔥',
      'boss': '👹',
      'challenge': '⚡',
      'accuracy': '🎯',
      'level': '📈',
    };
    return map[category] || '🏆';
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

  const earnedCount = userAchievements.length;
  const totalCount = achievements.length;
  const progress = totalCount > 0 ? Math.round((earnedCount / totalCount) * 100) : 0;

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4">
          {/* Header */}
          <div className="bg-white rounded-2xl shadow-sm border p-6 mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-3xl font-extrabold text-brand-blue">🏆 Achievements</h1>
                <p className="text-gray-500 text-sm mt-1">
                  Collect badges by completing challenges, defeating bosses, and building streaks.
                </p>
              </div>
              <div className="bg-brand-blue/5 rounded-2xl px-6 py-3 text-center border border-brand-blue/10">
                <p className="text-sm text-gray-500">Progress</p>
                <p className="text-2xl font-extrabold text-brand-blue">{earnedCount} / {totalCount}</p>
                <div className="w-32 h-1.5 bg-gray-200 rounded-full mt-1 mx-auto">
                  <div className="h-1.5 bg-brand-yellow rounded-full" style={{ width: `${progress}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* Achievements Grid */}
          {achievements.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm border p-12 text-center">
              <p className="text-4xl mb-4">🎖️</p>
              <p className="text-gray-500">No achievements available yet.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {achievements.map((ach) => (
                <div
                  key={ach.id}
                  className={`bg-white rounded-2xl shadow-sm border p-5 transition ${
                    ach.earned
                      ? 'border-green-200 hover:shadow-md'
                      : 'border-gray-100 opacity-60 grayscale'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <span className="text-3xl">{ach.icon || '🏆'}</span>
                    {ach.earned && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">
                        ✅ Earned
                      </span>
                    )}
                  </div>
                  <h3 className="font-bold text-gray-800 mt-2">{ach.name}</h3>
                  <p className="text-xs text-gray-500 mt-1">{ach.description}</p>
                  <div className="mt-3 flex items-center gap-2 text-xs">
                    <span className="bg-gray-100 px-2 py-0.5 rounded-full">
                      {getCategoryEmoji(ach.category)} {ach.category}
                    </span>
                    <span className="bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full font-bold">
                      +{ach.reward_xp || 0} XP
                    </span>
                  </div>
                  {ach.earned && ach.earnedAt && (
                    <p className="text-xs text-gray-400 mt-2">
                      Earned: {new Date(ach.earnedAt).toLocaleDateString('en-NG', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}