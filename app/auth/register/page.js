'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase-client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    email: '',
    password: '',
    full_name: '',
    phone: '',
    date_of_birth: '',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          full_name: form.full_name,
          phone: form.phone,
          date_of_birth: form.date_of_birth || null,
        },
      },
    });

    if (authError) {
      alert('Sign up failed: ' + authError.message);
      setLoading(false);
      return;
    }

    if (authData.user) {
      // Generate referral code
      const code = 'SBA' + Math.random().toString(36).substring(2, 8).toUpperCase();
      await supabase
        .from('profiles')
        .update({
          full_name: form.full_name,
          phone: form.phone,
          date_of_birth: form.date_of_birth || null,
          referral_code: code,
          onboarding_completed: false,
        })
        .eq('id', authData.user.id);

      // Create onboarding steps
      const steps = ['exam', 'subjects', 'level', 'goal'];
      for (const step of steps) {
        await supabase.from('onboarding_steps').insert({
          user_id: authData.user.id,
          step: step,
          completed: false,
        });
      }
    }

    setLoading(false);
    router.push('/onboarding');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg max-w-md w-full p-8">
        <h1 className="text-2xl font-bold text-center text-gray-900 mb-2">
          🎓 Join Shiney Brain Academy
        </h1>
        <p className="text-center text-gray-500 text-sm mb-6">
          Start your journey to academic excellence
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Full Name *</label>
            <input
              type="text"
              required
              className="w-full border rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-400"
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              placeholder="e.g. Esther Okafor"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Email *</label>
            <input
              type="email"
              required
              className="w-full border rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-400"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="esther@email.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Phone Number *</label>
            <input
              type="tel"
              required
              className="w-full border rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-400"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="08123456789"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Password *</label>
            <input
              type="password"
              required
              className="w-full border rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-400"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="Min 6 characters"
              minLength={6}
            />
          </div>

          {/* Birthday - Optional with gift message */}
          <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
            <label className="block text-sm font-medium mb-1">
              🎂 Date of Birth <span className="text-gray-400">(optional)</span>
            </label>
            <p className="text-xs text-blue-600 mb-2">
              🎉 Add your birthday so we can celebrate you with gifts and surprises!
            </p>
            <input
              type="date"
              className="w-full border rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-400"
              value={form.date_of_birth}
              onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition disabled:opacity-50"
          >
            {loading ? 'Creating account...' : '🚀 Create Account'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-4">
          Already have an account? <Link href="/auth/login" className="text-blue-600 hover:underline">Log in</Link>
        </p>
      </div>
    </div>
  );
}