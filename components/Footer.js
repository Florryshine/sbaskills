import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="bg-brand-blue text-white">
      {/* Main Footer */}
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-4">

          {/* Brand */}
          <div className="lg:col-span-1">
            <h3 className="text-2xl font-extrabold">Shiney Brain Academy</h3>
            <p className="mt-1 text-xs font-bold uppercase tracking-widest text-brand-yellow">
              Skills · Success · Excellence
            </p>
            <p className="mt-4 text-sm leading-7 text-blue-200">
              Nigeria's learning platform for exam prep, tech skills, business, career development and personal growth.
            </p>
            <div className="mt-6">
              <p className="text-sm font-semibold text-brand-yellow">📞 Call us anytime</p>
              <p className="mt-1 text-sm text-blue-200">08138082009</p>
              <p className="text-sm text-blue-200">09053626207</p>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-sm font-bold uppercase tracking-widest text-brand-yellow">
              Quick Links
            </h4>
            <ul className="mt-4 space-y-3">
              {[
                { label: 'Home', href: '/' },
                { label: 'Browse Courses', href: '/courses' },
                { label: 'About Us', href: '/about' },
                { label: 'Contact', href: '/contact' },
                { label: 'Register Free', href: '/register' },
                { label: 'Login', href: '/login' },
              ].map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    className="text-sm text-blue-200 transition hover:text-brand-yellow"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Categories */}
          <div>
            <h4 className="text-sm font-bold uppercase tracking-widest text-brand-yellow">
              Course Categories
            </h4>
            <ul className="mt-4 space-y-3">
              {[
                '🎓 JAMB & Post-UTME',
                '💻 Tech Skills',
                '🎨 Graphics & Video Editing',
                '💼 Business & Freelancing',
                '🚀 Career Development',
                '🧠 Personal Growth',
              ].map((cat) => (
                <li key={cat}>
                  <Link
                    href="/courses"
                    className="text-sm text-blue-200 transition hover:text-brand-yellow"
                  >
                    {cat}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Promise & Social */}
          <div>
            <h4 className="text-sm font-bold uppercase tracking-widest text-brand-yellow">
              Our Promise
            </h4>
            <p className="mt-4 text-sm leading-7 text-blue-200">
              We help Nigerian students build real skills, gain academic excellence, and achieve their goals — at prices they can afford.
            </p>
            <div className="mt-6">
              <h4 className="text-sm font-bold uppercase tracking-widest text-brand-yellow">
                Connect With Us
              </h4>
              <div className="mt-3 flex gap-4">
                <a
                  href="https://wa.me/2348138082009"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full bg-white/10 px-4 py-2 text-xs font-bold text-white hover:bg-brand-yellow hover:text-brand-dark transition"
                >
                  WhatsApp
                </a>
                <a
                  href="https://t.me/shineybrainacademy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full bg-white/10 px-4 py-2 text-xs font-bold text-white hover:bg-brand-yellow hover:text-brand-dark transition"
                >
                  Telegram
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-6 sm:flex-row sm:px-6 lg:px-8">
          <p className="text-xs text-blue-300">
            © {new Date().getFullYear()} Shiney Brain Academy. All rights reserved.
          </p>
          <div className="flex gap-6">
            <Link href="/privacy" className="text-xs text-blue-300 hover:text-brand-yellow transition">
              Privacy Policy
            </Link>
            <Link href="/terms" className="text-xs text-blue-300 hover:text-brand-yellow transition">
              Terms of Use
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
