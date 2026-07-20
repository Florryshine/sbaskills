import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export const metadata = {
  title: 'Privacy Policy | Shiney Brain Academy',
  description: 'How Shiney Brain Academy collects, uses, and protects your information.',
};

const LAST_UPDATED = 'July 20, 2026';

const sections = [
  {
    title: '1. Who We Are',
    body: `Shiney Brain Academy ("we", "us", "our") is a Nigerian exam-prep and skills education platform offering courses, study tools, and content for JAMB, WAEC, NECO, and Post-UTME preparation. This policy explains how we handle information collected through our website, app, and connected channels (including WhatsApp and Telegram communities).`,
  },
  {
    title: '2. Information We Collect',
    list: [
      'Account information: name, email address, phone number, and password when you register.',
      'Usage data: courses viewed, quiz/flashcard results, points, and activity on the platform.',
      'Payment information: processed securely by our payment provider (Paystack) — we do not store your card details.',
      'Communications: messages you send us via contact forms, WhatsApp, or Telegram.',
      'Technical data: IP address, browser type, and device information, collected automatically for security and analytics.',
    ],
  },
  {
    title: '3. How We Use Your Information',
    list: [
      'To create and manage your account, and to provide access to courses, quizzes, and other features.',
      'To track your learning progress, points, and achievements.',
      'To process payments and manage subscriptions or purchases.',
      'To send important updates, study reminders, and — where you have opted in — promotional content.',
      'To improve our platform, content, and user experience.',
      'To detect, prevent, and address technical issues, fraud, or abuse.',
    ],
  },
  {
    title: '4. Sharing Your Information',
    body: `We do not sell your personal information. We may share limited data with trusted third parties strictly to operate the platform:`,
    list: [
      'Payment processors (e.g. Paystack), to process transactions securely.',
      'Hosting and infrastructure providers (e.g. Vercel, Supabase), to run and store the platform.',
      'Social/communication platforms (e.g. WhatsApp, Telegram, and other channels we publish to), where you choose to engage with us there.',
      'Legal authorities, only where required by law.',
    ],
  },
  {
    title: '5. Data Security',
    body: `We use industry-standard measures, including encrypted connections (HTTPS) and access-controlled databases, to protect your information. However, no method of transmission or storage is 100% secure, and we cannot guarantee absolute security.`,
  },
  {
    title: '6. Your Rights',
    list: [
      'Access the personal information we hold about you.',
      'Request correction of inaccurate information.',
      'Request deletion of your account and associated data.',
      'Opt out of promotional communications at any time.',
    ],
  },
  {
    title: '7. Cookies',
    body: `We use cookies and similar technologies to keep you logged in, remember your preferences, and understand how the platform is used. You can control cookies through your browser settings.`,
  },
  {
    title: "8. Children's Privacy",
    body: `Our platform is built for secondary school and pre-university students preparing for JAMB, WAEC, NECO, and Post-UTME exams. Where a user is under 18, we encourage parental/guardian awareness of their use of the platform.`,
  },
  {
    title: '9. Changes to This Policy',
    body: `We may update this Privacy Policy from time to time. Changes will be posted on this page with an updated "Last updated" date.`,
  },
  {
    title: '10. Contact Us',
    body: `If you have questions about this Privacy Policy or how your data is handled, contact us:`,
    list: [
      'Email: info@shineybrainacademy.com',
      'Phone: 08138082009 / 09053626207',
      'WhatsApp: wa.me/2348138082009',
    ],
  },
];

export default function PrivacyPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gray-50">
        <article className="max-w-3xl mx-auto px-4 py-12">
          <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-2">
            Privacy Policy
          </h1>
          <p className="text-sm text-gray-500 mb-10">Last updated: {LAST_UPDATED}</p>

          <div className="prose prose-lg max-w-none text-gray-700 leading-relaxed space-y-8">
            {sections.map((section) => (
              <section key={section.title}>
                <h2 className="text-xl font-bold text-gray-900 mb-2">{section.title}</h2>
                {section.body && <p>{section.body}</p>}
                {section.list && (
                  <ul className="list-disc pl-5 space-y-1 mt-2">
                    {section.list.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>
        </article>
      </main>
      <Footer />
    </>
  );
}
