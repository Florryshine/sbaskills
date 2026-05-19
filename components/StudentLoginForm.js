'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase';

export default function StudentLoginForm({ nextUrl = '/dashboard' }) {
  const router = useRouter();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const supabase = createBrowserClient();
      const { error } = await supabase.auth.signInWithPassword(form);

      if (error) {
        throw error;
      }

      router.push(nextUrl);
      router.refresh();
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-lg rounded-[2rem] bg-white p-8 shadow-soft">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand-yellow">Student Login</p>
        <h1 className="mt-3 text-3xl font-bold text-brand-blue">Welcome back</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">Access your dashboard, enrolled courses, and lesson progress.</p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-brand-blue"
              required
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Password</label>
            <input
              type="password"
              value={form.password}
              onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-brand-blue"
              required
            />
          </div>

          {error ? <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p> : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-brand-blue px-6 py-4 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-70"
          >
            {loading ? 'Signing in...' : 'Login'}
          </button>
        </form>

        <div className="mt-6 flex flex-col gap-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
          <p>
            No account yet?{' '}
            <Link href="/register" className="font-bold text-brand-blue underline underline-offset-4">
              Register
            </Link>
          </p>
          <Link href="/admin/login" className="font-bold text-brand-blue underline underline-offset-4">
            Admin Login
          </Link>
        </div>
      </div>
    </main>
  );
}
