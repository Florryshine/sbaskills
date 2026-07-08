'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const router = useRouter();
  const supabase = createBrowserClient();

  useEffect(() => {
    async function getUser() {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();
        setRole(profile?.role || 'student');
      }
    }
    getUser();

    const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user || null);
      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single();
        setRole(profile?.role || 'student');
      } else {
        setRole(null);
      }
    });

    return () => listener?.subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  return (
    <header className="sticky top-0 z-50 border-b border-blue-100 bg-white/95 backdrop-blur shadow-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">

        {/* Logo */}
        <Link href="/" className="flex flex-col leading-tight">
          <span className="text-xl font-extrabold tracking-tight text-brand-blue">
            Shiney Brain Academy
          </span>
          <span className="text-xs font-bold uppercase tracking-widest text-brand-yellow">
            Skills · Success · Excellence
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden items-center gap-6 md:flex">
          <Link href="/" className="text-sm font-medium text-slate-600 transition hover:text-brand-blue">Home</Link>
          <Link href="/courses" className="text-sm font-medium text-slate-600 transition hover:text-brand-blue">Courses</Link>
          <Link href="/blog" className="text-sm font-medium text-slate-600 transition hover:text-brand-blue">Blog</Link>
          <Link href="/audio" className="text-sm font-medium text-slate-600 transition hover:text-brand-blue">Audio</Link>
          <Link href="/flashcards" className="text-sm font-medium text-slate-600 transition hover:text-brand-blue">📚 Flashcards</Link> {/* NEW */}
          <Link href="/leaderboard" className="text-sm font-medium text-slate-600 transition hover:text-brand-blue">🏅 Board</Link>
          <Link href="/library" className="text-sm font-medium text-slate-600 transition hover:text-brand-blue">📚 Library</Link>
          <Link href="/tools" className="text-sm font-medium text-slate-600 transition hover:text-brand-blue">🛠️ Tools</Link>
          <Link href="/challenge" className="text-sm font-medium text-slate-600 transition hover:text-brand-blue">⚡ Challenge</Link>
          <Link href="/about" className="text-sm font-medium text-slate-600 transition hover:text-brand-blue">About</Link>
          <Link href="/quizzes" className="text-sm font-medium text-slate-600 transition hover:text-brand-blue">📝 Quizzes</Link>
          <Link href="/contact" className="text-sm font-medium text-slate-600 transition hover:text-brand-blue">Contact</Link>

          {user ? (
            <>
              {role === 'tutor' && (
                <Link href="/tutor" className="text-sm font-bold text-green-600 hover:text-green-700">
                  🎓 Tutor
                </Link>
              )}
              {role === 'admin' && (
                <Link href="/admin/dashboard" className="text-sm font-bold text-red-600 hover:text-red-700">
                  ⚙️ Admin
                </Link>
              )}
              <Link href="/dashboard" className="text-sm font-medium text-slate-600 hover:text-brand-blue">
                Dashboard
              </Link>
              <button
                onClick={handleLogout}
                className="text-sm font-medium text-slate-600 hover:text-red-600 transition"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="rounded-full border border-brand-blue px-4 py-2 text-sm font-semibold text-brand-blue transition hover:bg-brand-blue hover:text-white">
                Login
              </Link>
              <Link href="/register" className="rounded-full bg-brand-yellow px-4 py-2 text-sm font-bold text-brand-dark transition hover:opacity-90 shadow-sm">
                Get Started
              </Link>
            </>
          )}
        </nav>

        {/* Mobile hamburger */}
        <button
          className="flex flex-col gap-1.5 md:hidden p-2"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          <span className={`block h-0.5 w-6 bg-brand-blue transition-all ${menuOpen ? 'rotate-45 translate-y-2' : ''}`} />
          <span className={`block h-0.5 w-6 bg-brand-blue transition-all ${menuOpen ? 'opacity-0' : ''}`} />
          <span className={`block h-0.5 w-6 bg-brand-blue transition-all ${menuOpen ? '-rotate-45 -translate-y-2' : ''}`} />
        </button>
      </div>

      {/* Mobile Menu */}
      {menuOpen && (
        <div className="border-t border-blue-100 bg-white px-4 pb-6 pt-4 md:hidden shadow-lg">
          <nav className="flex flex-col gap-4">
            <Link href="/" onClick={() => setMenuOpen(false)} className="text-sm font-semibold text-slate-700 hover:text-brand-blue">🏠 Home</Link>
            <Link href="/courses" onClick={() => setMenuOpen(false)} className="text-sm font-semibold text-slate-700 hover:text-brand-blue">📚 Courses</Link>
            <Link href="/blog" onClick={() => setMenuOpen(false)} className="text-sm font-semibold text-slate-700 hover:text-brand-blue">📝 Blog</Link>
            <Link href="/audio" onClick={() => setMenuOpen(false)} className="text-sm font-semibold text-slate-700 hover:text-brand-blue">🎵 Audio</Link>
            <Link href="/flashcards" onClick={() => setMenuOpen(false)} className="text-sm font-semibold text-slate-700 hover:text-brand-blue">📚 Flashcards</Link> {/* NEW */}
            <Link href="/leaderboard" onClick={() => setMenuOpen(false)} className="text-sm font-semibold text-slate-700 hover:text-brand-blue">🏅 Leaderboard</Link>
            <Link href="/library" onClick={() => setMenuOpen(false)} className="text-sm font-semibold text-slate-700 hover:text-brand-blue">📚 Library</Link>
            <Link href="/tools" onClick={() => setMenuOpen(false)} className="text-sm font-semibold text-slate-700 hover:text-brand-blue">🛠️ Tools</Link>
            <Link href="/challenge" onClick={() => setMenuOpen(false)} className="text-sm font-semibold text-slate-700 hover:text-brand-blue">⚡ Daily Challenge</Link>
            <Link href="/about" onClick={() => setMenuOpen(false)} className="text-sm font-semibold text-slate-700 hover:text-brand-blue">About</Link>
            <Link href="/contact" onClick={() => setMenuOpen(false)} className="text-sm font-semibold text-slate-700 hover:text-brand-blue">📞 Contact</Link>

            {user ? (
              <>
                {role === 'tutor' && (
                  <Link href="/tutor" onClick={() => setMenuOpen(false)} className="text-sm font-bold text-green-600">
                    🎓 Tutor Dashboard
                  </Link>
                )}
                {role === 'admin' && (
                  <Link href="/admin/dashboard" onClick={() => setMenuOpen(false)} className="text-sm font-bold text-red-600">
                    ⚙️ Admin Panel
                  </Link>
                )}
                <Link href="/dashboard" onClick={() => setMenuOpen(false)} className="text-sm font-semibold text-slate-700 hover:text-brand-blue">
                  📊 Dashboard
                </Link>
                <button
                  onClick={() => { handleLogout(); setMenuOpen(false); }}
                  className="text-sm font-semibold text-red-600 text-left"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link href="/login" onClick={() => setMenuOpen(false)} className="rounded-full border border-brand-blue px-4 py-3 text-center text-sm font-bold text-brand-blue hover:bg-brand-blue hover:text-white transition">
                  Login
                </Link>
                <Link href="/register" onClick={() => setMenuOpen(false)} className="rounded-full bg-brand-yellow px-4 py-3 text-center text-sm font-bold text-brand-dark hover:opacity-90 transition">
                  Get Started Free
                </Link>
              </>
            )}
            <div className="mt-2 border-t border-slate-100 pt-4">
              <p className="text-xs text-slate-400">📞 08138082009 · 09053626207</p>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}