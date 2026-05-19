import Link from 'next/link';

export default function Navbar() {
  return (
    <header className="sticky top-0 z-40 border-b border-blue-100 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <div>
          <Link href="/" className="text-xl font-extrabold tracking-tight text-brand-blue">
            Shiney Brain Academy
          </Link>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-yellow">
            Where Champions Are Made
          </p>
        </div>
        <nav className="hidden items-center gap-6 md:flex">
          <Link href="/" className="text-sm font-medium text-slate-700 transition hover:text-brand-blue">
            Home
          </Link>
          <Link href="/dashboard" className="text-sm font-medium text-slate-700 transition hover:text-brand-blue">
            Dashboard
          </Link>
          <Link href="/login" className="rounded-full border border-brand-blue px-4 py-2 text-sm font-semibold text-brand-blue transition hover:bg-brand-blue hover:text-white">
            Login
          </Link>
          <Link href="/register" className="rounded-full bg-brand-yellow px-4 py-2 text-sm font-semibold text-brand-dark transition hover:opacity-90">
            Get Started
          </Link>
        </nav>
      </div>
    </header>
  );
}
