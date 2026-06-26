'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import { completeActivity } from '@/lib/gamification';

export default function MarkDoneButton({ activityType, activityId, points = 10, label = 'Mark as Done' }) {
  const [user, setUser] = useState(null);
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkProgress() {
      const supabase = createBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUser(user);
        const { data } = await supabase
          .from('student_progress')
          .select('id')
          .eq('student_id', user.id)
          .eq('activity_type', activityType)
          .eq('activity_id', activityId)
          .maybeSingle();
        setProgress(data);
      }
      setLoading(false);
    }
    checkProgress();
  }, [activityType, activityId]);

  const handleMarkDone = async () => {
    if (!user) {
      alert('Please login to earn points');
      return;
    }
    const result = await completeActivity(user.id, activityType, activityId, points);
    if (result.success) {
      alert(`✅ You earned ${points} points!`);
      setProgress({ id: 'completed' });
    } else {
      alert(result.message);
    }
  };

  if (loading) return null;

  if (!user) {
    return (
      <div className="mt-4 text-sm text-gray-500">
        <a href="/login" className="text-brand-blue hover:underline">Login</a> to earn points for this activity.
      </div>
    );
  }

  if (progress) {
    return (
      <div className="mt-4 text-green-600 font-bold text-sm">✅ You already earned points for this activity.</div>
    );
  }

  return (
    <button
      onClick={handleMarkDone}
      className="mt-4 bg-brand-yellow text-brand-dark px-6 py-3 rounded-full font-bold hover:opacity-90 transition"
    >
      {label} (Earn {points} Points)
    </button>
  );
}