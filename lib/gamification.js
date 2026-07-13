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

export async function addReferralPoints(referrerId, referredId) {
  const supabase = createBrowserClient();
  try {
    await addPoints(referrerId, 50, 'Referred a friend', 'referral', referredId);
    await addPoints(referredId, 30, 'Signed up with referral', 'signup_bonus', referrerId);
  } catch (error) {
    console.error('Error adding referral points:', error);
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
  // total_points/redeemed_points live on user_points; streak_days is now
  // canonical on profiles (see migration 003_progression_system.sql) —
  // read both and merge so callers don't need to know the split.
  const [{ data: pointsRow }, { data: profileRow }] = await Promise.all([
    supabase.from('user_points').select('total_points, redeemed_points').eq('user_id', userId).maybeSingle(),
    supabase.from('profiles').select('streak_days').eq('id', userId).maybeSingle(),
  ]);

  const total_points = pointsRow?.total_points || 0;
  const redeemed_points = pointsRow?.redeemed_points || 0;

  return {
    total_points,
    streak_days: profileRow?.streak_days || 0,
    available_points: Math.max(0, total_points - redeemed_points),
  };
}

export async function redeemPoints(userId, rewardId) {
  const supabase = createBrowserClient();
  try {
    const { data, error } = await supabase.rpc('redeem_points', {
      p_user_id: userId,
      p_reward_id: rewardId,
    });
    if (error) {
      console.error('Error redeeming points:', error);
      return { success: false, message: error.message };
    }
    return data; // { success, remaining } or { success: false, message }
  } catch (e) {
    console.error('Redeem function not available:', e);
    return { success: false, message: 'Redemption is unavailable right now.' };
  }
}

export async function getRewards() {
  const supabase = createBrowserClient();
  const { data, error } = await supabase
    .from('rewards')
    .select('*')
    .eq('is_active', true)
    .order('cost_points', { ascending: true });
  if (error) {
    console.error('Error fetching rewards:', error);
    return [];
  }
  return data || [];
}

export async function completeActivity(studentId, activityType, activityId, points = 10) {
  const supabase = createBrowserClient();
  
  const { data: existing } = await supabase
    .from('student_progress')
    .select('id')
    .eq('student_id', studentId)
    .eq('activity_type', activityType)
    .eq('activity_id', activityId)
    .maybeSingle();

  if (existing) {
    return { success: false, message: 'Already completed this activity' };
  }

  const { error: insertError } = await supabase
    .from('student_progress')
    .insert({
      student_id: studentId,
      activity_type: activityType,
      activity_id: activityId,
      points_earned: points,
    });

  if (insertError) {
    console.error('Error recording progress:', insertError);
    return { success: false, message: insertError.message };
  }

  await addPoints(studentId, points, `Completed ${activityType}`, activityType, activityId);
  return { success: true, points };
}