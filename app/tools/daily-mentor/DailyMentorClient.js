'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import Link from 'next/link';

export default function DailyMentorClient() {
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [goal, setGoal] = useState('');
  const [error, setError] = useState(false);

  useEffect(() => {
    async function fetchTodaysMessage() {
      try {
        const supabase = createBrowserClient();
        const today = new Date().toISOString().split('T')[0];
        const { data, error } = await supabase
          .from('daily_mentor_messages')
          .select('message, goal')
          .eq('created_at', today)
          .maybeSingle();

        if (error) {
          console.error('Error fetching daily mentor:', error);
          setError(true);
          setLoading(false);
          return;
        }

        if (data) {
          setMessage(data.message);
          setGoal(data.goal || '');
        } else {
          setMessage('🌅 Good morning! Today is a new opportunity to learn and grow. Stay focused, stay consistent!');
          setGoal('Complete at least one lesson or quiz today.');
        }
        setLoading(false);
      } catch (err) {
        console.error('Error:', err);
        setError(true);
        setLoading(false);
      }
    }

    fetchTodaysMessage();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-blue mx-auto"></div>
          <p className="mt-4 text-gray-500">Loading today's message...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="bg-white rounded-2xl shadow-sm border p-6">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-3xl">🌞</span>
          <h1 className="text-2xl font-extrabold text-brand-blue">Daily Mentor</h1>
        </div>
        <p className="text-gray-500 text-sm mb-6">Today's motivation from Mentor Florryshine</p>

        {error ? (
          <div className="bg-yellow-50 rounded-2xl border border-yellow-200 p-6 text-center">
            <p className="text-yellow-700">Could not load today's message. Check back later!</p>
            <Link href="/dashboard" className="mt-4 inline-block bg-brand-yellow px-6 py-2 rounded-full font-bold text-sm">Go to Dashboard</Link>
          </div>
        ) : (
          <div className="bg-brand-blue/5 rounded-2xl border border-brand-blue/20 p-6">
            <div className="flex items-start gap-3">
              <span className="text-2xl">🧠</span>
              <div className="whitespace-pre-wrap text-gray-700 leading-relaxed">{message}</div>
            </div>
            {goal && (
              <div className="mt-4 bg-yellow-50 rounded-xl p-4">
                <p className="font-semibold text-brand-blue">🎯 Today's Goal:</p>
                <p className="text-gray-700">{goal}</p>
              </div>
            )}
            <div className="mt-4 text-sm text-gray-500">— Mentor Florryshine</div>
          </div>
        )}

        <div className="mt-6 text-center">
          <Link href="/dashboard" className="text-brand-blue hover:underline text-sm font-semibold">← Back to Dashboard</Link>
        </div>
      </div>
    </div>
  );
}