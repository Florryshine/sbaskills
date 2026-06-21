import { createBrowserClient } from './supabase';

export async function addPoints(userId, points, reason, actionType, referenceId) {
  const supabase = createBrowserClient();
  try {
    const { error } = await supabase.rpc('add_points', {
      p_user_id: userId,
      p_points: points,
      p_reason: reason,
      p_action_type: actionType,
      p_reference_id: referenceId,
    });
    if (error) console.error('Error adding points:', error);
  } catch (e) {
    console.error('Points function not available:', e);
  }
}

export async function updateStreak(userId) {
  const supabase = createBrowserClient();
  try {
    await supabase.rpc('update_streak', { p_user_id: userId });
  } catch (e) {
    console.error('Streak function not available:', e);
  }
}

export async function getUserPoints(userId) {
  const supabase = createBrowserClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('total_points, streak_days')
    .eq('id', userId)
    .single();
  if (error) return { total_points: 0, streak_days: 0 };
  return data;
}

export async function redeemPoints(userId, points, rewardType, rewardId) {
  const supabase = createBrowserClient();
  // Simple placeholder – you can implement later
  return { success: true };
}