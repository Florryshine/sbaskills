import { supabase } from './supabase'

export async function addPoints(userId, points, reason) {
  const { data: current } = await supabase
    .from('user_points')
    .select('total_points, level')
    .eq('user_id', userId)
    .single()

  const newPoints = (current?.total_points || 0) + points
  const newLevel = Math.floor(newPoints / 100) + 1

  await supabase.from('user_points').upsert({
    user_id: userId,
    total_points: newPoints,
    level: newLevel,
    last_active: new Date().toISOString().split('T')[0]
  })

  const { data: badges } = await supabase.from('badges').select('*').lte('points_required', newPoints)
  const { data: earnedBadges } = await supabase.from('user_badges').select('badge_id').eq('user_id', userId)
  const earnedIds = earnedBadges?.map(b => b.badge_id) || []

  for (const badge of badges || []) {
    if (!earnedIds.includes(badge.id)) {
      await supabase.from('user_badges').insert({ user_id: userId, badge_id: badge.id })
    }
  }
  return { points: newPoints, level: newLevel }
}

export async function updateStreak(userId) {
  const today = new Date().toISOString().split('T')[0]
  const { data } = await supabase.from('user_points').select('streak_days, last_active').eq('user_id', userId).single()
  if (!data) return
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().split('T')[0]
  let newStreak = data.streak_days
  if (data.last_active === yesterdayStr) newStreak = data.streak_days + 1
  else if (data.last_active !== today) newStreak = 1
  await supabase.from('user_points').update({ streak_days: newStreak, last_active: today }).eq('user_id', userId)
  if (newStreak === 7) await addPoints(userId, 50, '7-day streak bonus')
}