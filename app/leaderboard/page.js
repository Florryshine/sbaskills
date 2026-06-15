import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export default async function LeaderboardPage() {
  const supabase = createServerComponentClient({ cookies });
  const { data: leaderboard } = await supabase
    .from('user_points')
    .select('user_id, total_points, level, streak_days')
    .order('total_points', { ascending: false })
    .limit(20);

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-4xl font-bold mb-8">🏆 Leaderboard</h1>
      {leaderboard?.map((user, idx) => (
        <div key={user.user_id} className="flex justify-between p-2 border-b">
          <span>#{idx + 1} - Student ID: {user.user_id.slice(0,8)}</span>
          <span className="font-bold">{user.total_points} pts</span>
        </div>
      ))}
    </div>
  );
}