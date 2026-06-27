'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export default function DailyMentorPage() {
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [goal, setGoal] = useState('');

  useEffect(() => {
    async function fetchTodaysMessage() {
      const supabase = createBrowserClient();
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('daily_mentor_messages')
        .select('message, goal')
        .eq('created_at', today)
        .maybeSingle();

      if (data) {
        setMessage(data.message);
        setGoal(data.goal || '');
      } else {
        setMessage('No message for today yet. Check back later!');
      }
      setLoading(false);
    }

    fetchTodaysMessage();
  }, []);

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen flex items-center justify-center">Loading...</div>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-3xl mx-auto px-4">
          <div className="bg-white rounded-2xl shadow-sm border p-6">
            <h1 className="text-3xl font-extrabold text-brand-blue mb-2">
              🌞 Daily Mentor
            </h1>
            <p className="text-sm text-gray-500 mb-6">
              Today's motivation from Mentor Florryshine
            </p>

            <div className="bg-brand-blue/5 rounded-2xl border border-brand-blue/20 p-6">
              <div className="flex items-start gap-3">
                <span className="text-2xl">🧠</span>
                <div className="whitespace-pre-wrap text-gray-700 leading-relaxed">
                  {message}
                </div>
              </div>
              {goal && (
                <div className="mt-4 bg-yellow-50 rounded-xl p-4">
                  <p className="font-semibold text-brand-blue">🎯 Today's Goal:</p>
                  <p className="text-gray-700">{goal}</p>
                </div>
              )}
              <div className="mt-4 text-sm text-gray-500">
                — Mentor Florryshine
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}