'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function AdminAchievements() {
  const [achievements, setAchievements] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createBrowserClient();

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/admin/login'); return; }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profile?.role !== 'admin') { router.push('/login'); return; }

      const { data: achData } = await supabase
        .from('achievements')
        .select('*')
        .order('category', { ascending: true });

      const { data: userData } = await supabase
        .from('profiles')
        .select('id, full_name, email, role');

      const { data: earned } = await supabase
        .from('user_achievements')
        .select('user_id, achievement_id, earned_at');

      const earnedMap = {};
      earned?.forEach(e => {
        if (!earnedMap[e.user_id]) earnedMap[e.user_id] = [];
        earnedMap[e.user_id].push(e.achievement_id);
      });

      setAchievements(achData || []);
      setUsers(userData || []);
      setLoading(false);
    }
    loadData();
  }, []);

  if (loading) return <div className="p-8 text-center">Loading...</div>;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-white p-6 shadow-sm border">
        <Link href="/admin/dashboard" className="text-sm text-brand-blue underline">← Back to Admin</Link>
        <h1 className="text-2xl font-extrabold text-brand-blue mt-2">🏆 Achievements</h1>
        <p className="text-sm text-gray-500">View all achievements and student progress.</p>
      </section>

      <section className="rounded-2xl bg-white shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Achievement</th>
                <th className="px-4 py-3 text-left font-semibold">Category</th>
                <th className="px-4 py-3 text-left font-semibold">XP</th>
                <th className="px-4 py-3 text-left font-semibold">Students Earned</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {achievements.map(ach => {
                const earnedCount = users.filter(u =>
                  u.earnedAchievements?.includes(ach.id)
                ).length;
                return (
                  <tr key={ach.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <span className="text-xl mr-2">{ach.icon || '🏆'}</span>
                      <span className="font-semibold">{ach.name}</span>
                    </td>
                    <td className="px-4 py-3 capitalize">{ach.category}</td>
                    <td className="px-4 py-3">+{ach.reward_xp || 0}</td>
                    <td className="px-4 py-3">{earnedCount}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}