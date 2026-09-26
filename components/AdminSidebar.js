'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import LogoutButton from '@/components/LogoutButton';

const sections = [
  {
    label: 'PEOPLE',
    items: [
      { href: '/admin/students', label: 'Students' },
      { href: '/admin/tutor-activity', label: 'Tutors / Teachers' },
      { href: '/admin/roles', label: 'Roles & Permissions' },
    ],
  },
  {
    label: 'LEARNING',
    items: [
      { href: '/admin/courses', label: 'AI & Digital Skills' },
      { href: '/admin/quizzes', label: 'Quizzes' },
      { href: '/admin/flashcard-drafts', label: 'Flashcards' },
      { href: '/admin/study-note-drafts', label: 'Study Notes' },
      { href: '/admin/past-questions/upload', label: 'Past Questions' },
    ],
  },
  {
    label: 'SCHOOLS',
    items: [
      { href: '/admin/schools', label: 'Schools' },
      { href: '/admin/submissions', label: 'School Submissions' },
    ],
  },
  {
    label: 'GAMES',
    items: [
      { href: '/admin/boss-battles', label: 'Boss Battles' },
      { href: '/admin/boss-battle-drafts', label: 'Boss Battle Drafts' },
      { href: '/admin/daily-challenge', label: 'Daily Challenges' },
      { href: '/admin/achievements', label: 'Achievements' },
    ],
  },
  {
    label: 'CONTENT',
    items: [
      { href: '/admin/knowledge-assets', label: 'Knowledge Assets' },
      { href: '/admin/content-engine', label: 'Content Engine' },
      { href: '/admin/generate', label: 'Generate' },
      { href: '/admin/generation-jobs', label: 'Generation Jobs' },
      { href: '/admin/blog', label: 'Blog' },
      { href: '/admin/blog-drafts', label: 'Blog Drafts' },
      { href: '/admin/podcasts', label: 'Podcasts' },
      { href: '/admin/audio', label: 'Audio' },
      { href: '/admin/asset-images', label: 'Image Engine' },
    ],
  },
  {
    label: 'LIBRARY',
    items: [
      { href: '/admin/library', label: 'E-Library' },
      { href: '/admin/books', label: 'Books' },
    ],
  },
  {
    label: 'PUBLISHING',
    items: [
      { href: '/admin/social-engine', label: 'Social Engine' },
      { href: '/admin/channels', label: 'Channels' },
      { href: '/admin/content-engine/queue', label: 'Content Queue' },
      { href: '/admin/content-engine/drafts', label: 'Content Drafts' },
      { href: '/admin/carousel-drafts', label: 'Carousel Drafts' },
      { href: '/admin/video-scripts', label: 'Video Scripts' },
      { href: '/admin/social-post-drafts', label: 'Social Post Drafts (old)' },
      { href: '/admin/quote-loops', label: 'Quote Loops' },
      { href: '/admin/teaching-loops', label: 'Teaching Loops' },
      { href: '/admin/meme-loops', label: 'Meme / Joke Loops' },
      { href: '/admin/lesson-loops', label: '2-Min Lesson Loops' },
      { href: '/admin/past-question-loops', label: 'Past Question Loops' },
      { href: '/admin/countdown-loops', label: 'Countdown Loops' },
    ],
  },
  {
    label: 'OTHERS',
    items: [
      { href: '/admin/landing/coupons', label: 'Landing Coupons' },
      { href: '/admin/landing/testimonials', label: 'Landing Testimonials' },
      { href: '/jamb-playbook', label: 'Edit Landing Page' },
      { href: '/admin/feature-unlocks', label: 'Feature Unlocks' },
      { href: '/admin/submissions', label: 'Submissions' },
      { href: '/admin/testimonials', label: 'Testimonials' },
      { href: '/admin/content-engine/upload', label: 'Content Upload' },
    ],
  },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(() => {
    const activeSection = sections.find((section) =>
      section.items.some((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    );
    return activeSection?.label || null;
  });

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const isActive = (href) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Open admin menu"
        className="fixed left-4 top-4 z-50 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-blue text-white shadow-lg lg:hidden"
      >
        <span className="flex flex-col gap-1" aria-hidden="true">
          <span className="block h-0.5 w-5 rounded-full bg-white" />
          <span className="block h-0.5 w-5 rounded-full bg-white" />
          <span className="block h-0.5 w-5 rounded-full bg-white" />
        </span>
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-screen w-72 flex-col overflow-y-auto bg-brand-blue p-5 text-white transition-transform duration-300 ease-in-out
          ${open ? 'translate-x-0' : '-translate-x-full'}
          lg:static lg:z-auto lg:w-72 lg:translate-x-0 lg:transition-none`}
      >
        <div className="border-b border-white/10 pb-5">
          <img
            src="https://user24606.cn.imgto.link/public/20260926/1003107782.avif?v=2"
            alt="Shiney Brain Academy"
            width="190"
            height="48"
            loading="eager"
            decoding="async"
            referrerPolicy="no-referrer"
            className="h-12 w-auto max-w-[190px] object-contain"
          />
          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.3em] text-blue-100">
            Admin Panel
          </p>
        </div>

        <nav className="mt-5 flex-1 space-y-6 overflow-y-auto pr-1">
          <Link
            href="/admin/dashboard"
            className={`flex items-center justify-between rounded-xl px-4 py-3 text-sm font-bold transition
              ${isActive('/admin/dashboard') ? 'bg-white text-brand-blue' : 'text-white hover:bg-white/10'}`}
          >
            <span>Overview</span>
            {isActive('/admin/dashboard') && <span className="h-2 w-2 rounded-full bg-brand-yellow" />}
          </Link>

          {sections.map((section) => {
            const sectionOpen = expanded === section.label;
            const sectionActive = section.items.some((item) => isActive(item.href));

            return (
              <div key={section.label}>
                <button
                  type="button"
                  onClick={() => setExpanded(sectionOpen ? null : section.label)}
                  className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-left text-xs font-extrabold uppercase tracking-[0.18em] transition
                    ${sectionActive ? 'bg-white/10 text-white' : 'text-blue-100 hover:bg-white/10 hover:text-white'}`}
                  aria-expanded={sectionOpen}
                >
                  <span>{section.label}</span>
                  <span className={`text-sm transition-transform ${sectionOpen ? 'rotate-180' : ''}`}>⌄</span>
                </button>

                {sectionOpen && (
                  <div className="mt-1 space-y-1 pl-2">
                    {section.items.map((item) => {
                      const active = isActive(item.href);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={`flex items-center justify-between rounded-lg px-4 py-2.5 text-sm font-medium transition
                            ${active ? 'bg-white text-brand-blue' : 'text-white/90 hover:bg-white/10 hover:text-white'}`}
                        >
                          <span>{item.label}</span>
                          {active && <span className="h-1.5 w-1.5 rounded-full bg-brand-yellow" />}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="space-y-3 border-t border-white/10 pt-4">
          <Link
            href="/"
            className="block rounded-xl border border-white/20 px-4 py-3 text-sm font-semibold hover:bg-white/10"
          >
            View Website
          </Link>
          <LogoutButton redirectTo="/admin/login" />
        </div>
      </aside>
    </>
  );
}
