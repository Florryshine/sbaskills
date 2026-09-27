import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { createServerClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export default async function JAMBSubjectPage({ params }) {
  const supabase = createServerClient();
  const subject = decodeURIComponent(params.subject || '').trim();

  const { data: rows, error } = await supabase
    .from('past_questions')
    .select('topic')
    .eq('exam_type', 'JAMB')
    .eq('subject', subject);

  if (error) console.error('JAMB subject topics error:', error);

  const topics = [...new Set((rows || []).map((row) => row.topic?.trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));

  return (
    <main className="min-h-screen bg-slate-50">
      <Navbar />
      <section className="bg-brand-blue text-white">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <Link href="/jamb/study" className="text-sm font-semibold text-blue-200 hover:text-white">
            ← Back to JAMB subjects
          </Link>
          <p className="mt-10 text-xs font-extrabold uppercase tracking-[0.22em] text-brand-yellow">JAMB 2027 • STUDY</p>
          <h1 className="mt-3 text-4xl font-black sm:text-5xl">{subject}</h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-blue-100">
            Choose a topic to practise, or open the full {subject} question bank.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-wrap gap-3">
          <Link
            href={`/jamb/practice?subject=${encodeURIComponent(subject)}`}
            className="rounded-xl bg-brand-yellow px-5 py-3 text-sm font-extrabold text-brand-dark"
          >
            📝 Practise all {subject} questions
          </Link>
          <Link href="/jamb" className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-extrabold text-brand-blue">
            JAMB command centre
          </Link>
        </div>

        {topics.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <p className="font-bold text-slate-700">No topic labels yet for this subject.</p>
            <p className="mt-2 text-sm text-slate-500">The existing subject questions are still available through the full question bank.</p>
          </div>
        ) : (
          <>
            <div className="mb-7">
              <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-brand-yellow">TOPICS</p>
              <h2 className="mt-2 text-3xl font-black text-brand-blue">What do you want to practise?</h2>
              <p className="mt-2 text-slate-500">{topics.length} topic{topics.length === 1 ? '' : 's'} represented in the existing JAMB bank.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {topics.map((topic) => (
                <Link
                  key={topic}
                  href={`/jamb/practice?subject=${encodeURIComponent(subject)}&topic=${encodeURIComponent(topic)}`}
                  className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-blue hover:shadow-md"
                >
                  <p className="font-extrabold text-slate-900">{topic}</p>
                  <p className="mt-2 text-sm font-semibold text-brand-blue group-hover:underline">Practise this topic →</p>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
      <Footer />
    </main>
  );
}
