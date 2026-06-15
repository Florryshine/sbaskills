import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export default async function LeaderboardPage() {
  const supabase = createServerComponentClient({ cookies })
  
  // Fetch points without admin call
  const { data: points } = await supabase
    .from('user_points')
    .select('user_id, total_points, level, streak_days')
    .order('total_points', { ascending: false })
    .limit(20)

  // Get user emails separately (simple approach: just show user_id)
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-4xl font-bold mb-8">🏆 Leaderboard</h1>
      <div className="space-y-2">
        {points?.map((user, idx) => (
          <div key={user.user_id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-4">
              <span className="text-2xl font-bold text-gray-400">#{idx + 1}</span>
              <div>
                <p className="font-semibold">Student {user.user_id.slice(0,8)}</p>
                <p className="text-sm text-gray-500">Level {user.level} • 🔥 {user.streak_days} day streak</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xl font-bold text-yellow-600">{user.total_points} pts</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}