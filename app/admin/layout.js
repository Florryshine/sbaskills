import Link from 'next/link';

export const metadata = {
  title: 'Admin Panel | Shiney Brain Academy',
};

export default function AdminLayout({ children }) {
  return (
    <div className="min-h-screen bg-slate-50">

      {/* Top Header */}
      <header className="sticky top-0 z-50 bg-brand-blue text-white shadow-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-brand-yellow">Admin Panel</p>
            <p className="text-sm font-extrabold">Shiney Brain Academy</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="rounded-full border border-white/30 px-4 py-2 text-xs font-bold text-white hover:bg-white/10 transition"
            >
              View Website
            </Link>
            <Link
              href="/admin/logout"
              className="rounded-full bg-brand-yellow px-4 py-2 text-xs font-bold text-brand-dark hover:opacity-90 transition"
            >
              Sign out
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex gap-6">

          {/* Sidebar */}
          <aside className="hidden w-56 shrink-0 lg:block">
            <nav className="sticky top-24 rounded-2xl bg-white p-4 shadow-sm border border-slate-100">
              <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400">
                Navigation
              </p>
              <ul className="space-y-1">
                {[
                  { href: '/admin', label: '📊 Overview' },
                  { href: '/admin/courses', label: '📚 Courses' },
                  { href: '/admin/students', label: '👥 Students' },
                  { href: '/admin/courses/new', label: '➕ New Course' },
                ].map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="block rounded-xl px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-brand-blue hover:text-white"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>

              <div className="mt-6 rounded-xl bg-brand-blue p-4 text-white text-center">
                <p className="text-2xl font-extrabold text-brand-yellow">SBA</p>
                <p className="mt-1 text-xs font-semibold">Admin Portal</p>
                <p className="mt-2 text-xs text-blue-200">📞 08138082009</p>
              </div>
            </nav>
          </aside>

          {/* Mobile Nav */}
          <div className="mb-4 flex gap-2 overflow-x-auto lg:hidden w-full">
            {[
              { href: '/admin', label: '📊 Overview' },
              { href: '/admin/courses', label: '📚 Courses' },
              { href: '/admin/students', label: '👥 Students' },
              { href: '/admin/courses/new', label: '➕ New Course' },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex-shrink-0 rounded-full bg-white border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-brand-blue hover:text-white transition"
              >
                {item.label}
              </Link>
            ))}
          </div>

          {/* Main Content */}
          <main className="flex-1 min-w-0">
            {children}
          </main>

        </div>
      </div>
    </div>
  );
}
