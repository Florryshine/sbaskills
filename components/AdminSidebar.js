'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import LogoutButton from '@/components/LogoutButton';

const navItems = [
  { href: '/admin/dashboard', label: 'Overview', icon: '📊' },
  { href: '/admin/courses', label: 'Courses', icon: '📚' },
  { href: '/admin/blog', label: 'Blog', icon: '📝' },
  { href: '/admin/audio', label: 'Audio', icon: '🎵' },
  { href: '/admin/students', label: 'Students', icon: '👨‍🎓' },
  { href: '/admin/roles', label: 'Roles', icon: '🔑' },
  { href: '/admin/testimonials', label: 'Testimonials', icon: '💬' },
  { href: '/admin/quizzes', label: 'Quizzes', icon: '📝' },
  { href: '/admin/submissions', label: 'Submissions', icon: '📊' },
  { href: '/admin/content-engine', label: 'Content Engine', icon: '📝' },
];

export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex min-h-screen w-full flex-col bg-brand-blue p-6 text-white lg:w-72">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-100">Admin Panel</p>
        <h2 className="mt-2 text-2xl font-bold">Shiney Brain Academy</h2>
      </div>
      <nav className="mt-10 space-y-2">
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
      <div className="mt-auto space-y-4">
        <Link href="/" className="block rounded-2xl border border-white/20 px-4 py-3 text-sm font-semibold hover:bg-white/10">
          View Website
        </Link>
        <LogoutButton redirectTo="/admin/login" />
      </div>
    </aside>
  );
}