'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState(null);
  const router = useRouter();
  const supabase = createBrowserClient();

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    getUser();

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user || null);
      router.refresh();
    });

    return () => listener?.subscription.unsubscribe();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    router.push('/');
  };

  // Rest of the navbar JSX – replace Login/Get Started with user info
  return (
    <header className="...">
      {/* ... logo and other links ... */}

      <nav className="hidden items-center gap-6 md:flex">
        <Link href="/">Home</Link>
        <Link href="/courses">Courses</Link>
        <Link href="/blog">Blog</Link>
        <Link href="/audio">Audio</Link>
        <Link href="/leaderboard">Leaderboard</Link>
        <Link href="/library">Library</Link>
        <Link href="/about">About</Link>
        <Link href="/contact">Contact</Link>

        {user ? (
          <>
            <Link href="/dashboard" className="text-sm font-semibold text-slate-700 hover:text-brand-blue">
              Dashboard
            </Link>
            <button onClick={handleLogout} className="text-sm font-semibold text-slate-700 hover:text-red-600">
              Logout
            </button>
          </>
        ) : (
          <>
            <Link href="/login" className="rounded-full border border-brand-blue px-4 py-2 text-sm font-semibold text-brand-blue hover:bg-brand-blue hover:text-white">
              Login
            </Link>
            <Link href="/register" className="rounded-full bg-brand-yellow px-4 py-2 text-sm font-bold text-brand-dark hover:opacity-90">
              Get Started
            </Link>
          </>
        )}
      </nav>

      {/* Mobile menu – same logic */}
      {menuOpen && (
        <div className="...">
          {/* ... links ... */}
          {user ? (
            <>
              <Link href="/dashboard">Dashboard</Link>
              <button onClick={handleLogout}>Logout</button>
            </>
          ) : (
            <>
              <Link href="/login">Login</Link>
              <Link href="/register">Get Started</Link>
            </>
          )}
        </div>
      )}
    </header>
  );
}