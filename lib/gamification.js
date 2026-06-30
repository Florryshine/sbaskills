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
  const { data, error } = await supabase
    .from('user_points')
    .select('total_points, streak_days')
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data) return { total_points: 0, streak_days: 0 };
  return data;
}

export async function redeemPoints(userId, points, rewardType, rewardId) {
  const supabase = createBrowserClient();
  // Simple placeholder – you can implement later
  return { success: true };
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