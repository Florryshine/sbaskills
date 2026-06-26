'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import { addPoints } from '@/lib/gamification';

export default function MarkDoneButton({ 
  activityType,  // 'blog', 'quiz', 'course', 'audio', 'lesson', 'assignment'
  activityId,
  label = 'Mark as Done',
  points = 10,
  className = ''
}) {
  const [completed, setCompleted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);
  const supabase = createBrowserClient();

  useEffect(() => {
    async function checkCompletion() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUser(user);

      const { data, error } = await supabase
        .from('activity_completions')
        .select('id')
        .eq('user_id', user.id)
        .eq('activity_type', activityType)
        .eq('activity_id', activityId)
        .maybeSingle();

      if (data) setCompleted(true);
    }

    checkCompletion();
  }, [activityType, activityId]);

  const handleMarkDone = async () => {
    if (completed) return;
    setLoading(true);

    try {
      // Insert completion record
      const { error: insertError } = await supabase
        .from('activity_completions')
        .insert({
          user_id: user.id,
          activity_type: activityType,
          activity_id: activityId,
        });

      if (insertError) throw insertError;

      // Add points
      await addPoints(user.id, points, `Completed ${activityType}`, activityType, activityId);

      setCompleted(true);
      alert(`✅ You earned ${points} points!`);
    } catch (error) {
      console.error('Error marking done:', error);
      alert('Something went wrong. Please try again.');
    }
    setLoading(false);
  };

  if (completed) {
    return (
      <span className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-green-100 text-green-700 text-xs font-bold ${className}`}>
        ✅ Done
      </span>
    );
  }

  return (
    <button
      onClick={handleMarkDone}
      disabled={loading || !user}
      className={`inline-flex items-center gap-1 px-4 py-2 rounded-full bg-brand-yellow text-brand-dark font-bold text-sm hover:opacity-90 transition ${className}`}
    >
      {loading ? '⏳...' : label}
    </button>
  );
}