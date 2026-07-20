'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import LogoutButton from '@/components/LogoutButton';

const navItems = [
  { href: '/admin/dashboard', label: 'Overview', icon: '📊' },
  { href: '/admin/students', label: 'Students', icon: '👨‍🎓' },
  { href: '/admin/tutor-activity', label: 'Tutor Activity', icon: '🧑‍🏫' },
  { href: '/admin/roles', label: 'Roles', icon: '🔑' },

  { href: '/admin/knowledge-assets', label: 'Knowledge Assets', icon: '🧠' },
  { href: '/admin/content-engine', label: 'Content Engine', icon: '⚡' },
  { href: '/admin/content-engine/queue', label: 'Content Queue', icon: '📥' },
  { href: '/admin/content-engine/drafts', label: 'Content Drafts', icon: '🗒️' },
  { href: '/admin/content-engine/upload', label: 'Content Upload', icon: '📤' },
  { href: '/admin/generation-jobs', label: 'Generation Jobs', icon: '⚙️' },
  { href: '/admin/generate', label: 'Generate', icon: '✨' },

  { href: '/admin/courses', label: 'Courses', icon: '📚' },
  { href: '/admin/library', label: 'Library', icon: '📖' },
  { href: '/admin/books', label: 'Books', icon: '📕' },
  { href: '/admin/quizzes', label: 'Quizzes', icon: '🧩' },
  { href: '/admin/quiz-drafts', label: 'Quiz Drafts', icon: '📋' },
  { href: '/admin/flashcard-drafts', label: 'Flashcard Drafts', icon: '🗂️' },
  { href: '/admin/study-note-drafts', label: 'Study Note Drafts', icon: '📝' },
  { href: '/admin/boss-battles', label: 'Boss Battles', icon: '👹' },
  { href: '/admin/boss-battle-drafts', label: 'Boss Battle Drafts', icon: '⚔️' },
  { href: '/admin/daily-challenge', label: 'Daily Challenge', icon: '📅' },
  { href: '/admin/achievements', label: 'Achievements', icon: '🏆' },

  { href: '/admin/blog', label: 'Blog', icon: '📰' },
  { href: '/admin/blog-drafts', label: 'Blog Drafts', icon: '✏️' },
  { href: '/admin/podcasts', label: 'Podcasts', icon: '🎙️' },
  { href: '/admin/audio', label: 'Audio', icon: '🎵' },
  { href: '/admin/asset-images', label: 'Asset Images', icon: '🖼️' },
  { href: '/admin/social-engine', label: 'Social Engine', icon: '🚀' },
  { href: '/admin/carousel-drafts', label: 'Carousel Drafts', icon: '🎠' },
  { href: '/admin/video-scripts', label: 'Video Scripts', icon: '🎬' },
  { href: '/admin/social-post-drafts', label: 'Social Post Drafts (old)', icon: '📣' },

  { href: '/admin/past-questions/upload', label: 'Upload Past Qs', icon: '📤' },
  { href: '/admin/submissions', label: 'Submissions', icon: '📮' },
  { href: '/admin/testimonials', label: 'Testimonials', icon: '💬' },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Auto-close the mobile drawer whenever the route changes (e.g. after
  // tapping a nav link), so it doesn't stay open covering the new page.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <>
      {/* Mobile-only hamburger button — was completely missing before, so
          there was no way to open/close the sidebar on small screens. */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Open admin menu"
        className="fixed top-4 left-4 z-50 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-blue text-white shadow-lg lg:hidden"
      >
        <span className="text-xl leading-none">☰</span>
      </button>

      {/* Backdrop, mobile only, closes the drawer on tap outside it */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
        />
      )}

      {/* The sidebar itself.
          - Mobile (<lg): fixed drawer, slides in/out via translate-x,
            capped at a sane width (w-72) instead of the old w-full that
            covered the entire screen with no way to dismiss it.
          - Desktop (lg+): back to the original static, always-visible
            column, taking its place in the parent flex row. */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-screen w-72 flex-col overflow-y-auto bg-brand-blue p-6 text-white transition-transform duration-300 ease-in-out
          ${open ? 'translate-x-0' : '-translate-x-full'}
          lg:static lg:z-auto lg:w-72 lg:translate-x-0 lg:transition-none`}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-100">Admin Panel</p>
            <h2 className="mt-2 text-2xl font-bold">Shiney Brain Academy</h2>
          </div>
          {/* Close button, mobile only */}
          <button
            onClick={() => setOpen(false)}
            aria-label="Close admin menu"
            className="rounded-lg p-2 text-white/80 hover:bg-white/10 lg:hidden"
          >
            ✕
          </button>
        </div>
        <nav className="mt-10 space-y-2 overflow-y-auto">
          {navItems.map((link) => {
            const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                  active ? 'bg-white text-brand-blue' : 'text-white hover:bg-white/10'
                }`}
              >
                <span>{link.label}</span>
                {active ? <span className="h-2 w-2 rounded-full bg-brand-yellow" /> : null}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto space-y-4 pt-4">
          <Link href="/" className="block rounded-2xl border border-white/20 px-4 py-3 text-sm font-semibold hover:bg-white/10">
            View Website
          </Link>
          <LogoutButton redirectTo="/admin/login" />
        </div>
      </aside>
    </>
  );
}
