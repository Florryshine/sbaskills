'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import LogoutButton from '@/components/LogoutButton';

const links = [
  { href: '/dashboard', label: 'Dashboard' }
];

export default function DashboardSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-full rounded-3xl bg-brand-blue p-6 text-white lg:w-72 lg:rounded-none lg:min-h-screen">
      <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-100">Student Area</p>
      <h2 className="mt-2 text-2xl font-bold">Shiney Brain Academy</h2>
      <nav className="mt-10 space-y-2">
        {links.map((link) => {
          const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                active ? 'bg-white text-brand-blue' : 'hover:bg-white/10'
              }`}
            >
              <span>{link.label}</span>
              {active ? <span className="h-2 w-2 rounded-full bg-brand-yellow" /> : null}
            </Link>
          );
        })}
      </nav>
      <div className="mt-8 space-y-4">
        <Link href="/" className="block rounded-2xl border border-white/20 px-4 py-3 text-sm font-semibold hover:bg-white/10">
          Back to Home
        </Link>
        <LogoutButton />
      </div>
    </aside>
  );
}
