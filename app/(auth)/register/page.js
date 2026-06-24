'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase';
import { addReferralPoints } from '@/lib/gamification';

export default function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const referralCode = searchParams.get('ref');

  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [referrerInfo, setReferrerInfo] = useState(null);

  // Check if referral code is valid
  useEffect(() => {
    async function checkReferral() {
      if (!referralCode) return;
      const supabase = createBrowserClient();
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('referral_code', referralCode)
        .maybeSingle();
      if (data) {
        setReferrerInfo(data);
      } else {
        // Invalid referral code – ignore
        console.log('Invalid referral code');
      }
    }
    checkReferral();
  }, [referralCode]);

  const handleChange = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const generateReferralCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const supabase = createBrowserClient();
      const redirectTo = `${window.location.origin}/auth/callback`;

      const { data, error } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          emailRedirectTo: redirectTo,
          data: {
            full_name: form.full_name,
            phone: form.phone,
            role: 'student'
          }
        }
      });

      if (error) throw error;

      const user = data.user;
      if (!user) throw new Error('User creation failed');

      // Generate referral code for new user
      const newReferralCode = generateReferralCode();

      // Prepare profile data
      let referredById = null;
      let referrerId = null;

      // If a referral code was provided, find the referrer
      if (referralCode) {
        const { data: referrer } = await supabase
          .from('profiles')
          .select('id')
          .eq('referral_code', referralCode)
          .maybeSingle();

        if (referrer) {
          referredById = referrer.id;
          referrerId = referrer.id;
        }
      }

      // Insert profile
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: user.id,
          full_name: form.full_name,
          email: form.email,
          phone: form.phone,
          role: 'student',
          referral_code: newReferralCode,
          referred_by: referredById,
        });

      if (profileError) {
        console.error('Profile creation error:', profileError);
        // Still continue, but warn
        setMessage('Account created but profile setup incomplete. Please contact support.');
      }

      // Award referral points if applicable
      if (referrerId) {
        await addReferralPoints(referrerId, user.id);
        setMessage('Account created! You earned 30 bonus points, and your referrer earned 50 points!');
      } else {
        setMessage('Registration successful. Check your email to verify your account before logging in.');
      }

      setTimeout(() => router.push('/login'), 2000);
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-lg rounded-[2rem] bg-white p-8 shadow-soft">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand-yellow">Student Registration</p>
        <h1 className="mt-3 text-3xl font-bold text-brand-blue">Create your account</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Join Shiney Brain Academy and begin your JAMB preparation journey.
          {referralCode && referrerInfo && (
            <span className="block mt-2 text-xs text-brand-blue font-semibold">
              🎁 You were referred by {referrerInfo.full_name || 'a friend'}! You'll both get bonus points!
            </span>
          )}
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Full Name</label>
            <input
              name="full_name"
              value={form.full_name}
              onChange={handleChange}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-brand-blue"
              required
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Email</label>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-brand-blue"
              required
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Phone</label>
            <input
              name="phone"
              value={form.phone}
              onChange={handleChange}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-brand-blue"
              required
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Password</label>
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-brand-blue"
              required
              minLength={6}
            />
          </div>

          {error ? <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p> : null}
          {message ? <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</p> : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-brand-yellow px-6 py-4 text-sm font-bold text-brand-dark transition hover:opacity-90 disabled:opacity-70"
          >
            {loading ? 'Creating account...' : 'Register'}
          </button>
        </form>

        <p className="mt-6 text-sm text-slate-600">
          Already have an account?{' '}
          <Link href="/login" className="font-bold text-brand-blue underline underline-offset-4">
            Login
          </Link>
        </p>
      </div>
    </main>
  );
}