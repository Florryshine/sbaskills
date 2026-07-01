'use client';

import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="bg-brand-blue text-white">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          {/* Brand */}
          <div>
            <h3 className="text-xl font-extrabold">Shiney Brain Academy</h3>
            <p className="mt-2 text-sm text-blue-200">
              Skills, Success & Academic Excellence
            </p>
            <div className="mt-4 flex space-x-4">
              <a
                href="https://wa.me/2348138082009"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-200 hover:text-white transition"
              >
                <span className="sr-only">WhatsApp</span>
                <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
              </a>
              <a
                href="https://t.me/sba_community"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-200 hover:text-white transition"
              >
                <span className="sr-only">Telegram</span>
                <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                </svg>
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-bold text-lg">Quick Links</h4>
            <ul className="mt-4 space-y-2 text-sm">
              <li><Link href="/courses" className="text-blue-200 hover:text-white transition">Courses</Link></li>
              <li><Link href="/blog" className="text-blue-200 hover:text-white transition">Blog</Link></li>
              <li><Link href="/library" className="text-blue-200 hover:text-white transition">Library</Link></li>
              <li><Link href="/about" className="text-blue-200 hover:text-white transition">About</Link></li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="font-bold text-lg">Support</h4>
            <ul className="mt-4 space-y-2 text-sm">
              <li><Link href="/contact" className="text-blue-200 hover:text-white transition">Contact</Link></li>
              <li>
                <a href="tel:08138082009" className="text-blue-200 hover:text-white transition">
                  📞 08138082009
                </a>
              </li>
              <li>
                <a href="tel:09053626207" className="text-blue-200 hover:text-white transition">
                  📞 09053626207
                </a>
              </li>
              <li>
                <a href="mailto:info@shineybrainacademy.com" className="text-blue-200 hover:text-white transition">
                  ✉️ info@shineybrainacademy.com
                </a>
              </li>
            </ul>
          </div>

          {/* Newsletter / CTA */}
          <div>
            <h4 className="font-bold text-lg">Stay Connected</h4>
            <p className="mt-2 text-sm text-blue-200">
              Join our WhatsApp community for daily tips and updates.
            </p>
            <a
              href="https://wa.me/2348138082009"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-block rounded-full bg-brand-yellow px-6 py-2 text-sm font-bold text-brand-dark hover:opacity-90 transition"
            >
              Join WhatsApp
            </a>
          </div>
        </div>

        <div className="mt-10 border-t border-white/10 pt-8 text-center text-sm text-blue-200">
          <p>
            &copy; {new Date().getFullYear()} Shiney Brain Academy. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}