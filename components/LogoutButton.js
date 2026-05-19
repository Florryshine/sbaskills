'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase';

export default function LogoutButton({ redirectTo = '/login' }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogout = async () => {
    setLoading(true);
    const supabase = createBrowserClient();
    await supabase.auth.signOut();
    router.push(redirectTo);
    router.refresh();
    setLoading(false);
  };

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className="w-full rounded-2xl bg-brand-yellow px-4 py-3 text-sm font-bold text-brand-dark transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
    >
      {loading ? 'Signing out...' : 'Sign out'}
    </button>
  );
}
