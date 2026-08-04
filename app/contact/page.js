import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export const metadata = {
  title: 'Contact Us | Shiney Brain Academy',
  description: 'Get in touch with Shiney Brain Academy',
  alternates: { canonical: 'https://shineybrainacademy.vercel.app/contact' },
};

export default function ContactPage() {
  return (
    <main>
      <Navbar />

      {/* Hero */}
      <section className="bg-brand-blue text-white py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-sm font-bold uppercase tracking-widest text-brand-yellow">
            Get In Touch
          </p>
          <h1 className="mt-3 text-4xl font-extrabold sm:text-5xl">
            Contact Us
          </h1>
          <p className="mt-4 text-blue-200 max-w-xl mx-auto">
            Have a question or need help? Reach out to us through any of the channels below and we'll get back to you quickly.
          </p>
        </div>
      </section>

      {/* Contact Cards */}
      <section className="bg-slate-50 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">

            {/* Phone 1 */}
            <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100 text-center">
              <span className="text-4xl">📞</span>
              <h3 className="mt-4 font-bold text-brand-blue text-lg">Call Us</h3>
              <p className="mt-2 text-slate-500 text-sm">Available Monday to Saturday</p>
              <a
                href="tel:08138082009"
                className="mt-4 block font-bold text-brand-blue hover:text-brand-yellow transition"
              >
                08138082009
              </a>
              <a
                href="tel:09053626207"
                className="mt-1 block font-bold text-brand-blue hover:text-brand-yellow transition"
              >
                09053626207
              </a>
            </div>

            {/* Email */}
            <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100 text-center">
              <span className="text-4xl">✉️</span>
              <h3 className="mt-4 font-bold text-brand-blue text-lg">Email Us</h3>
              <p className="mt-2 text-slate-500 text-sm">We reply within 24 hours</p>
              <a
                href="mailto:shineybrainstutorial@gmail.com"
                className="mt-4 block font-bold text-brand-blue hover:text-brand-yellow transition break-all"
              >
                shineybrainstutorial@gmail.com
              </a>
            </div>

            {/* WhatsApp */}
            <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100 text-center">
              <span className="text-4xl">💬</span>
              <h3 className="mt-4 font-bold text-brand-blue text-lg">WhatsApp</h3>
              <p className="mt-2 text-slate-500 text-sm">Chat with us directly</p>
              <a
                href="https://wa.me/2348138082009"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-block rounded-full bg-green-500 px-6 py-2 text-sm font-bold text-white hover:bg-green-600 transition"
              >
                Chat on WhatsApp
              </a>
            </div>

            {/* TikTok */}
            <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100 text-center">
              <span className="text-4xl">🎵</span>
              <h3 className="mt-4 font-bold text-brand-blue text-lg">TikTok</h3>
              <p className="mt-2 text-slate-500 text-sm">Watch free JAMB tips and lessons</p>
              <a
                href="https://www.tiktok.com/@shineybrainjamb"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-block rounded-full bg-black px-6 py-2 text-sm font-bold text-white hover:opacity-80 transition"
              >
                @shineybrainjamb
              </a>
            </div>

            {/* Facebook */}
            <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100 text-center">
              <span className="text-4xl">📘</span>
              <h3 className="mt-4 font-bold text-brand-blue text-lg">Facebook</h3>
              <p className="mt-2 text-slate-500 text-sm">Follow us for updates and content</p>
              <a
                href="https://www.facebook.com/profile.php?id=61558513702366"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-block rounded-full bg-blue-600 px-6 py-2 text-sm font-bold text-white hover:bg-blue-700 transition"
              >
                Follow on Facebook
              </a>
            </div>

            {/* Telegram */}
            <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100 text-center">
              <span className="text-4xl">✈️</span>
              <h3 className="mt-4 font-bold text-brand-blue text-lg">Telegram</h3>
              <p className="mt-2 text-slate-500 text-sm">Join our student community</p>
              <a
                href="https://t.me/shineybrainacademy"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-block rounded-full bg-sky-500 px-6 py-2 text-sm font-bold text-white hover:bg-sky-600 transition"
              >
                Join on Telegram
              </a>
            </div>

          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="text-sm font-bold uppercase tracking-widest text-brand-yellow">FAQ</p>
            <h2 className="mt-3 text-3xl font-extrabold text-brand-blue">
              Frequently Asked Questions
            </h2>
          </div>
          <div className="mt-10 space-y-6">
            {[
              {
                q: 'How do I register on Shiney Brain Academy?',
                a: 'Click "Get Started" on the homepage, fill in your name, email and phone number and you\'re in!',
              },
              {
                q: 'How do I access a course after paying?',
                a: 'Once your payment is confirmed and your enrollment is approved, the course will appear in your dashboard.',
              },
              {
                q: 'Can I learn on my phone?',
                a: 'Yes! Shiney Brain Academy is fully optimized for mobile phones. You can learn anywhere, anytime.',
              },
              {
                q: 'How do I contact support?',
                a: 'Call or WhatsApp us on 08138082009 or email shineybrainstutorial@gmail.com and we will respond quickly.',
              },
            ].map((item) => (
              <div key={item.q} className="rounded-2xl bg-slate-50 p-6 border border-slate-100">
                <h4 className="font-bold text-brand-blue">{item.q}</h4>
                <p className="mt-2 text-sm leading-7 text-slate-600">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-brand-yellow py-14">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <h2 className="text-3xl font-extrabold text-brand-dark">
            Ready to start learning?
          </h2>
          <p className="mt-3 text-brand-dark/70">
            Join 5,000+ students already building skills on Shiney Brain Academy.
          </p>
          <a
            href="/register"
            className="mt-8 inline-block rounded-full bg-brand-blue px-8 py-4 text-sm font-bold text-white hover:opacity-90 transition"
          >
            Create Free Account
          </a>
        </div>
      </section>

      <Footer />
    </main>
  );
        }
        
