'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { useUnlockSystem } from '@/context/UnlockSystemContext';
import { FEATURE_METADATA, getRequiredLevel } from '@/lib/featureUnlocks';
import LockedFeature from './LockedFeature';

export default function UnlockAwareNavbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const router = useRouter();
  const supabase = createBrowserClient();
  const unlockSystem = useUnlockSystem();

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

  // Navigation items with their feature IDs
  const navItems = [
    { href: '/', label: 'Home', featureId: null, emoji: null },
    { href: '/courses', label: 'Courses', featureId: 'lessons', emoji: '📚' },
    { href: '/blog', label: 'Blog', featureId: null, emoji: '📝' },
    { href: '/audio', label: 'Audio', featureId: null, emoji: '🎵' },
    { href: '/podcasts', label: 'Podcasts', featureId: 'podcasts', emoji: '🎙️' },
    { href: '/flashcards', label: 'Flashcards', featureId: 'flashcards', emoji: '📇' },
    { href: '/leaderboard', label: 'Board', featureId: null, emoji: '🏆' },
    { href: '/store', label: 'Store', featureId: null, emoji: '🏪' },
    { href: '/library', label: 'Library', featureId: null, emoji: '📚' },
    { href: '/tools', label: 'Tools', featureId: null, emoji: '🛠️' },
    { href: '/challenge', label: 'Challenge', featureId: 'dailyChallenge', emoji: '🎯' },
    { href: '/about', label: 'About', featureId: null, emoji: null },
    { href: '/quizzes', label: 'Quizzes', featureId: 'quiz', emoji: '📝' },
    { href: '/boss-battles', label: 'Boss Battles', featureId: 'bossBattle', emoji: '🎮' },
    { href: '/contact', label: 'Contact', featureId: null, emoji: '📧' },
  ];

  const renderNavLink = (item) => {
    // If no feature ID, always show
    if (!item.featureId) {
      return (
        <Link 
          href={item.href} 
          className="text-sm font-medium text-slate-600 transition hover:text-brand-blue flex items-center gap-1"
        >
          {item.emoji && <span>{item.emoji}</span>}
          {item.label}
        </Link>
      );
    }

    // Check if feature is unlocked
    const isUnlocked = unlockSystem?.isUnlocked(item.featureId);
    const requiredLevel = unlockSystem?.getRequiredLevel(item.featureId) || 1;
    const userLevel = unlockSystem?.userLevel || 1;

    if (isUnlocked) {
      return (
        <Link 
          href={item.href} 
          className="text-sm font-medium text-slate-600 transition hover:text-brand-blue flex items-center gap-1"
        >
          {item.emoji && <span>{item.emoji}</span>}
          {item.label}
        </Link>
      );
    }

    // Feature is locked - show greyed out with lock
    return (
      <LockedFeature 
        featureId={item.featureId}
        userLevel={userLevel}
        showTooltip={true}
        className="inline-block"
      >
        <span className="text-sm font-medium text-slate-600 cursor-not-allowed flex items-center gap-1 pointer-events-auto">
          {item.emoji && <span>{item.emoji}</span>}
          {item.label}
        </span>
      </LockedFeature>
    );
  };

  const renderMobileNavLink = (item) => {
    if (!item.featureId) {
      return (
        <Link 
          href={item.href} 
          onClick={() => setMenuOpen(false)} 
          className="text-sm font-semibold text-slate-700 hover:text-brand-blue flex items-center gap-2"
        >
          {item.emoji && <span>{item.emoji}</span>}
          {item.label}
        </Link>
      );
    }

    const isUnlocked = unlockSystem?.isUnlocked(item.featureId);
    const requiredLevel = unlockSystem?.getRequiredLevel(item.featureId) || 1;
    const userLevel = unlockSystem?.userLevel || 1;

    if (isUnlocked) {
      return (
        <Link 
          href={item.href} 
          onClick={() => setMenuOpen(false)} 
          className="text-sm font-semibold text-slate-700 hover:text-brand-blue flex items-center gap-2"
        >
          {item.emoji && <span>{item.emoji}</span>}
          {item.label}
        </Link>
      );
    }

    return (
      <LockedFeature 
        featureId={item.featureId}
        userLevel={userLevel}
        showTooltip={true}
      >
        <span 
          onClick={(e) => e.preventDefault()} 
          className="text-sm font-semibold text-slate-400 cursor-not-allowed flex items-center gap-2 pointer-events-auto"
        >
          {item.emoji && <span>{item.emoji}</span>}
          {item.label}
        </span>
      </LockedFeature>
    );
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
          {navItems.map((item, index) => (
            <React.Fragment key={index}>{renderNavLink(item)}</React.Fragment>
          ))}

          {user ? (
            <>
              {role === 'tutor' && (
                <Link href="/tutor" className="text-sm font-bold text-green-600 hover:text-green-700">
                  📚 Tutor
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
            {navItems.map((item, index) => (
              <React.Fragment key={index}>{renderMobileNavLink(item)}</React.Fragment>
            ))}

            {user ? (
              <>
                {role === 'tutor' && (
                  <Link href="/tutor" onClick={() => setMenuOpen(false)} className="text-sm font-bold text-green-600">
                    📚 Tutor Dashboard
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
              <p className="text-xs text-slate-400">📧 08138082009 · 09053626207</p>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
