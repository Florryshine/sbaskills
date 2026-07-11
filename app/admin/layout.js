'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/admin/dashboard', label: 'Overview', icon: '📊' },
  { href: '/admin/courses', label: 'Courses', icon: '📚' },
  { href: '/admin/students', label: 'Students', icon: '👨‍🎓' },
  { href: '/admin/blog', label: 'Blog', icon: '📝' },
  { href: '/admin/blog-drafts', label: 'Blog Drafts', icon: '🗒️' },
  { href: '/admin/library', label: 'Library', icon: '📖' },
  { href: '/admin/audio', label: 'Audio', icon: '🎵' },
  { href: '/admin/roles', label: 'Roles', icon: '🔑' },
  { href: '/admin/testimonials', label: 'Testimonials', icon: '💬' },
  { href: '/admin/quizzes', label: 'Quizzes', icon: '🧠' },
  { href: '/admin/tutor-activity', label: 'Tutor Activity', icon: '👩‍🏫' },
  { href: '/admin/submissions', label: 'Submissions', icon: '📋' },
  { href: '/admin/daily-challenge', label: 'Daily Challenge', icon: '📅' },
  { href: '/admin/boss-battles', label: 'Boss Battles', icon: '👹' },
  { href: '/admin/content-engine', label: 'Content Engine', icon: '⚡' },
  { href: '/admin/generate', label: 'Generate Content', icon: '🚀' }, // NEW
  { href: '/admin/knowledge-assets', label: 'Knowledge Assets', icon: '🧠' },
  { href: '/admin/asset-images', label: 'Image Engine', icon: '🖼️' },
  { href: '/admin/quiz-drafts', label: 'Quiz Drafts', icon: '❓' },
  { href: '/admin/flashcard-drafts', label: 'Flashcard Drafts', icon: '🃏' },
  { href: '/admin/study-note-drafts', label: 'Study Notes', icon: '📝' },
  { href: '/admin/podcasts', label: 'Podcasts', icon: '🎙️' },
  { href: '/admin/social-post-drafts', label: 'Social Posts', icon: '📱' },
  { href: '/admin/generation-jobs', label: 'Generation Jobs', icon: '⚡' },
  { href: '/admin/past-questions/upload', label: 'Upload Past Qs', icon: '📤' },
];

function NavLink({ href, label, icon, mobile }) {
  const pathname = usePathname();
  const isActive = pathname === href || (href !== '/admin/dashboard' && pathname.startsWith(href + '/'));

  if (mobile) {
    return (
      <Link
        href={href}
        className={`flex-shrink-0 rounded-full border px-4 py-2 text-xs font-bold transition ${
          isActive
            ? 'bg-brand-yellow border-brand-yellow text-brand-dark'
            : 'bg-white border-slate-200 text-slate-600 hover:bg-brand-blue hover:text-white hover:border-brand-blue'
        }`}
      >
        {icon} {label}
      </Link>
    );
  }

  return (
    <li>
      <Link
        href={href}
        className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition ${
          isActive
            ? 'bg-brand-blue text-white shadow-md'
            : 'text-slate-600 hover:bg-brand-blue hover:text-white'
        }`}
      >
        <span>{icon}</span>
        {label}
      </Link>
    </li>
  );
}

export default function AdminLayout({ children }) {
  return (
    <div className="min-h-screen bg-slate-50">

      {/* Top Header */}
      <header className="sticky top-0 z-50 bg-brand-blue text-white shadow-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-yellow">
              <span className="text-xs font-extrabold text-brand-dark">SBA</span>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-brand-yellow">Admin Panel</p>
              <p className="text-sm font-extrabold">Shiney Brain Academy</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="hidden rounded-full border border-white/30 px-4 py-2 text-xs font-bold text-white hover:bg-white/10 transition sm:block"
            >
              View Website
            </Link>
            <button
  onClick={async () => {
    const { createBrowserClient } = await import('@/lib/supabase');
    const supabase = createBrowserClient();
    await supabase.auth.signOut();
    window.location.href = '/admin/login';
  }}
  className="rounded-full bg-brand-yellow px-4 py-2 text-xs font-bold text-brand-dark hover:opacity-90 transition"
>
  Sign out
</button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">

        {/* Mobile Nav */}
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1 lg:hidden">
          {navItems.map((item) => (
            <NavLink key={item.href} {...item} mobile />
          ))}
        </div>

        <div className="flex gap-6">

          {/* Sidebar */}
          <aside className="hidden w-60 shrink-0 lg:block">
            <nav className="sticky top-24 rounded-2xl bg-white p-4 shadow-sm border border-slate-100">
              <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400">
                Navigation
              </p>
              <ul className="space-y-1">
                {navItems.map((item) => (
                  <NavLink key={item.href} {...item} />
                ))}
              </ul>

              <div className="mt-6 rounded-xl bg-brand-blue p-4 text-white text-center">
                <p className="text-2xl font-extrabold text-brand-yellow">SBA</p>
                <p className="mt-1 text-xs font-semibold">Admin Portal</p>
                <p className="mt-3 text-xs text-blue-200">📞 08138082009</p>
                <p className="text-xs text-blue-200">09053626207</p>
              </div>
            </nav>
          </aside>

          {/* Main Content */}
          <main className="flex-1 min-w-0">
            {children}
          </main>

        </div>
      </div>
    </div>
  );
}