'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase';

export default function MarkCompleteButton({ lessonId, studentId, completed }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleComplete = async () => {
    try {
      setLoading(true);
      const supabase = createBrowserClient();
      const { error } = await supabase.from('lesson_progress').upsert(
        {
          student_id: studentId,
          lesson_id: lessonId,
          completed: true,
          completed_at: new Date().toISOString()
        },
        {
          onConflict: 'student_id,lesson_id'
        }
      );

      if (error) {
        throw error;
      }

      router.refresh();
    } catch (error) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleComplete}
      disabled={completed || loading}
      className="rounded-full bg-brand-yellow px-6 py-3 text-sm font-bold text-brand-dark transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
    >
      {completed ? 'Completed' : loading ? 'Saving...' : 'Mark as Complete'}
    </button>
  );
}
