import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export const metadata = {
  title: 'Data Deletion | Shiney Brain Academy',
  description: 'Learn how to request deletion of your Shiney Brain Academy account and personal data.',
  alternates: { canonical: 'https://shineybrainacademy.vercel.app/data-deletion' },
};

export default function DataDeletionPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gray-50">
        <section className="bg-brand-blue text-white py-14">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <p className="text-sm font-bold uppercase tracking-widest text-brand-yellow">
              Your privacy matters
            </p>
            <h1 className="mt-3 text-3xl font-extrabold sm:text-4xl">
              Data Deletion Instructions
            </h1>
            <p className="mt-4 max-w-2xl text-blue-100">
              You can ask Shiney Brain Academy to delete your account and the personal
              information associated with your use of our website, learning platform,
              and connected social accounts.
            </p>
          </div>
        </section>

        <article className="mx-auto max-w-3xl px-4 py-12">
          <div className="space-y-8 text-gray-700 leading-7">
            <section>
              <h2 className="text-xl font-bold text-gray-900">1. How to request deletion</h2>
              <p className="mt-2">
                Send an email to our support team using the address below. Use the subject
                line <strong>Data Deletion Request</strong> and include the email address
                or phone number associated with your Shiney Brain Academy account.
              </p>
              <a
                href="mailto:shineybrainstutorial@gmail.com?subject=Data%20Deletion%20Request"
                className="mt-4 inline-flex items-center rounded-full bg-brand-blue px-6 py-3 font-bold text-white hover:opacity-90 transition"
              >
                Email a deletion request
              </a>
              <p className="mt-3 text-sm text-gray-600">
                Email: <a className="font-semibold text-brand-blue underline" href="mailto:shineybrainstutorial@gmail.com">shineybrainstutorial@gmail.com</a>
                <br />
                Phone / WhatsApp: 08138082009
              </p>
              <p className="mt-3">
                Please do not send your password, payment card details, or social-media
                access tokens. We may ask for reasonable information to verify that you
                control the account before acting on a request.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900">2. What you can ask us to delete</h2>
              <p className="mt-2">
                Depending on the services you have used, your request may cover your
                account profile and contact details, learning activity and progress,
                saved preferences, and social-channel connection records or access
                credentials held by Shiney Brain Academy.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900">3. What happens after you submit a request</h2>
              <ol className="mt-2 list-decimal space-y-2 pl-6">
                <li>We will acknowledge your request and may contact you to verify your identity.</li>
                <li>We will review the information associated with your account and identify data that can be deleted.</li>
                <li>We will delete or de-identify eligible personal data from our active systems and confirm the outcome or explain any information we are required or permitted to retain.</li>
              </ol>
              <p className="mt-3">
                Some records may need to be retained for legitimate purposes such as
                accounting, payment disputes, fraud prevention, security, or compliance
                with applicable law. Where retention is required, we will restrict the
                information to that purpose. Copies held in backups may remain until
                those backups are routinely overwritten.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900">4. Disconnect Facebook or Instagram</h2>
              <p className="mt-2">
                If you connected a Facebook Page or Instagram account to an SBA social
                publishing feature, you can also revoke the app's access from your Meta
                account's business integrations or app settings. You can still email us
                to request deletion of connection records and credentials stored by SBA.
                Revoking Meta access and deleting your SBA account are separate actions.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900">5. Questions</h2>
              <p className="mt-2">
                For questions about personal information and how we handle it, read our{' '}
                <a href="/privacy" className="font-semibold text-brand-blue underline">
                  Privacy Policy
                </a>{' '}
                or contact us at{' '}
                <a className="font-semibold text-brand-blue underline" href="mailto:shineybrainstutorial@gmail.com">
                  shineybrainstutorial@gmail.com
                </a>.
              </p>
            </section>
          </div>
        </article>
      </main>
      <Footer />
    </>
  );
}
