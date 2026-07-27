'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import LogoutButton from '@/components/LogoutButton';

const navItems = [
  { href: '/admin/dashboard', label: 'Overview', icon: '\ud83d\udcca' },
  { href: '/admin/students', label: 'Students', icon: '\ud83d\udc68\u200d\ud83c\udf93' },
  { href: '/admin/tutor-activity', label: 'Tutor Activity', icon: '\ud83e\uddd1\u200d\ud83c\udfeb' },
  { href: '/admin/roles', label: 'Roles', icon: '\ud83d\udd11' },
  { href: '/admin/schools', label: 'Schools', icon: '🏫' },
  { href: '/admin/feature-unlocks', label: 'Feature Unlocks', icon: '\ud83d\udd12' },

  { href: '/admin/knowledge-assets', label: 'Knowledge Assets', icon: '\ud83e\udde0' },
  { href: '/admin/content-engine', label: 'Content Engine', icon: '\u26a1' },
  { href: '/admin/content-engine/queue', label: 'Content Queue', icon: '\ud83d\udce5' },
  { href: '/admin/content-engine/drafts', label: 'Content Drafts', icon: '\ud83d\uddd2\ufe0f' },
  { href: '/admin/content-engine/upload', label: 'Content Upload', icon: '\ud83d\udce4' },
  { href: '/admin/generation-jobs', label: 'Generation Jobs', icon: '\u2699\ufe0f' },
  { href: '/admin/generate', label: 'Generate', icon: '\u2728' },

  { href: '/admin/courses', label: 'Courses', icon: '\ud83d\udcda' },
  { href: '/admin/library', label: 'Library', icon: '\ud83d\udcd6' },
  { href: '/admin/books', label: 'Books', icon: '\ud83d\udcd5' },
  { href: '/admin/quizzes', label: 'Quizzes', icon: '\ud83e\udde9' },
  { href: '/admin/quiz-drafts', label: 'Quiz Drafts', icon: '\ud83d\udccb' },
  { href: '/admin/flashcard-drafts', label: 'Flashcard Drafts', icon: '\ud83d\uddc2\ufe0f' },
  { href: '/admin/study-note-drafts', label: 'Study Note Drafts', icon: '\ud83d\udcdd' },
  { href: '/admin/boss-battles', label: 'Boss Battles', icon: '\ud83d\udc79' },
  { href: '/admin/boss-battle-drafts', label: 'Boss Battle Drafts', icon: '\u2694\ufe0f' },
  { href: '/admin/daily-challenge', label: 'Daily Challenge', icon: '\ud83d\udcc5' },
  { href: '/admin/achievements', label: 'Achievements', icon: '\ud83c\udfc6' },

  { href: '/admin/blog', label: 'Blog', icon: '\ud83d\udcf0' },
  { href: '/admin/blog-drafts', label: 'Blog Drafts', icon: '\u270f\ufe0f' },
  { href: '/admin/podcasts', label: 'Podcasts', icon: '\ud83c\udf99\ufe0f' },
  { href: '/admin/audio', label: 'Audio', icon: '\ud83c\udfb5' },
  { href: '/admin/asset-images', label: 'Image Engine', icon: '\ud83d\uddbc\ufe0f' },
  { href: '/admin/social-engine', label: 'Social Engine', icon: '\ud83d\ude80' },
  { href: '/admin/channels', label: 'Channels', icon: '\ud83d\udd0c' },
  { href: '/admin/carousel-drafts', label: 'Carousel Drafts', icon: '\ud83c\udfa0' },
  { href: '/admin/video-scripts', label: 'Video Scripts', icon: '\ud83c\udfac' },
  { href: '/admin/social-post-drafts', label: 'Social Post Drafts (old)', icon: '\ud83d\udce3' },

  { href: '/admin/past-questions/upload', label: 'Upload Past Qs', icon: '\ud83d\udce4' },
  { href: '/admin/submissions', label: 'Submissions', icon: '\ud83d\udcee' },
  { href: '/admin/testimonials', label: 'Testimonials', icon: '\ud83d\udcac' },
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
        <span className="text-xl leading-none">\u2630</span>
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
            \u2715
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
