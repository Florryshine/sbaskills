'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Slim top bar for the admin area, separate from the left AdminSidebar.
// Purpose: quick access to the "landing page" tools (coupons, testimonials,
// and the inline screenshot editor) which aren't in the main sidebar's
// long feature list and are easy to lose track of.
const navItems = [
  { href: '/admin/landing/coupons', label: 'Landing Coupons' },
  { href: '/admin/landing/testimonials', label: 'Landing Testimonials' },
  { href: '/jamb-playbook', label: 'Edit Landing Page (live)' },
];

export default function AdminNavbar() {
  const pathname = usePathname();

  return (
    <div className="w-full border-b border-black/10 bg-white/95 backdrop-blur sticky top-0 z-30">
      <nav className="flex flex-wrap items-center gap-2 px-4 py-3 lg:px-6">
        {navItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                active
                  ? 'bg-brand-blue text-white'
                  : 'bg-black/5 text-brand-blue hover:bg-black/10'
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
