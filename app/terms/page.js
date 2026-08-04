import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export const metadata = {
  title: 'Terms of Service | Shiney Brain Academy',
  description: 'The terms and conditions that govern your use of Shiney Brain Academy.',
};

const LAST_UPDATED = 'August 4, 2026';

const sections = [
  {
    title: '1. Acceptance of These Terms',
    body: `These Terms of Service ("Terms") are a binding agreement between you and Shiney Brain Academy ("we", "us", "our") governing your access to and use of our website, app, courses, and related services (together, the "Service"). By creating an account or otherwise using the Service, you agree to these Terms. If you do not agree, please do not use the Service.`,
  },
  {
    title: '2. Who We Are',
    body: `Shiney Brain Academy is a Nigerian exam-prep and skills education platform offering courses, study tools, quizzes, and content for JAMB, WAEC, NECO, and Post-UTME preparation, delivered through our website, app, and connected channels including WhatsApp and Telegram.`,
  },
  {
    title: '3. Eligibility & Accounts',
    list: [
      'The Service is intended for secondary-school and pre-university students. If you are under 18, we encourage a parent or guardian to be aware of your use of the Service.',
      'You must provide accurate information when creating an account and keep your login credentials confidential.',
      'You are responsible for all activity that happens under your account.',
      'We may suspend or terminate accounts that provide false information or are used to violate these Terms.',
    ],
  },
  {
    title: '4. Courses, Content & Intellectual Property',
    list: [
      'All courses, quizzes, videos, study materials, branding, and other content on the Service are owned by Shiney Brain Academy or our licensors and are protected by copyright and other intellectual property laws.',
      'We grant you a limited, non-exclusive, non-transferable license to access and use this content for your personal, non-commercial study purposes.',
      'You may not copy, redistribute, resell, or publicly republish our course materials without our prior written permission.',
      'Any feedback, quiz answers, or content you submit through the Service may be used by us to operate and improve the Service.',
    ],
  },
  {
    title: '5. Payments, Subscriptions & Refunds',
    list: [
      'Some courses and features require payment, processed securely through our payment provider (Paystack). We do not store your card details.',
      'Prices are stated in Naira unless otherwise noted and may change from time to time; changes will not affect purchases already made.',
      'Unless otherwise stated at checkout, payments for courses and digital content are non-refundable once access has been granted.',
      'If you believe you were charged in error, contact us using the details in Section 12 and we will review it.',
    ],
  },
  {
    title: '6. Acceptable Use',
    body: `When using the Service, you agree not to:`,
    list: [
      'Share your account or course access with people who have not paid for it.',
      'Attempt to copy, scrape, reverse-engineer, or resell our content or platform.',
      'Upload or transmit anything unlawful, abusive, or that infringes another person\u2019s rights.',
      'Interfere with the security or normal operation of the Service, including our servers, APIs, or connected communication channels.',
      'Use the Service for any purpose other than personal exam preparation and learning.',
    ],
  },
  {
    title: '7. AI-Generated Content & Connected Platforms (including TikTok)',
    body: `As part of operating the Service, we use AI tools to help generate study content, summaries, and short-form video/audio material from our own educational materials. Before anything is published publicly, it is reviewed and explicitly approved by our team — nothing is auto-published without human review.`,
    list: [
      'We publish approved content to our own official social accounts, including TikTok, YouTube, Instagram, Facebook, and similar platforms, using each platform\u2019s official API (for example, TikTok\u2019s Content Posting API) under our own developer credentials.',
      'This publishing happens from our official Shiney Brain Academy accounts on those platforms \u2014 it does not post to or on behalf of your personal social media accounts, and connecting to the Service does not give us access to your personal TikTok, YouTube, or other social accounts.',
      'Content published this way is subject to the terms of service of the destination platform (e.g. TikTok\u2019s Terms of Service and Community Guidelines) in addition to these Terms.',
      'We are not responsible for the availability, content moderation decisions, or policies of third-party platforms our content is published to.',
    ],
  },
  {
    title: '8. Third-Party Services & Links',
    body: `The Service may link to or integrate with third-party services (such as Paystack, WhatsApp, Telegram, YouTube, and TikTok). We do not control these third parties and are not responsible for their content, policies, or practices. Your use of any third-party service is governed by that service\u2019s own terms.`,
  },
  {
    title: '9. Disclaimer of Warranties',
    body: `The Service is provided "as is" and "as available." While we work hard to keep our content accurate and our platform reliable, we do not guarantee that the Service will be uninterrupted, error-free, or that it will result in any particular exam score or outcome. Study materials are provided as an aid to your preparation, not a guarantee of results.`,
  },
  {
    title: '10. Limitation of Liability',
    body: `To the fullest extent permitted by law, Shiney Brain Academy will not be liable for any indirect, incidental, or consequential damages arising from your use of the Service. Our total liability for any claim relating to the Service is limited to the amount you paid us in the 12 months before the claim arose.`,
  },
  {
    title: '11. Termination',
    body: `We may suspend or terminate your access to the Service at any time if we reasonably believe you have violated these Terms. You may stop using the Service and delete your account at any time by contacting us.`,
  },
  {
    title: '12. Changes to These Terms',
    body: `We may update these Terms from time to time. We will post the updated Terms on this page with a revised "Last updated" date. Continuing to use the Service after changes take effect means you accept the updated Terms.`,
  },
  {
    title: '13. Governing Law',
    body: `These Terms are governed by the laws of the Federal Republic of Nigeria, without regard to conflict-of-law principles. Any dispute arising from these Terms or the Service will be subject to the exclusive jurisdiction of the courts of Nigeria.`,
  },
  {
    title: '14. Contact Us',
    body: `If you have questions about these Terms, contact us:`,
    list: [
      'Email: info@shineybrainacademy.com',
      'Phone: 08138082009 / 09053626207',
      'WhatsApp: wa.me/2348138082009',
    ],
  },
];

export default function TermsPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gray-50">
        <article className="max-w-3xl mx-auto px-4 py-12">
          <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-2">
            Terms of Service
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
