import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { createServerClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export default async function WAECNECOSubjectPage({ params }) {
  const supabase = createServerClient();
  const subject = decodeURIComponent(params.subject || '').trim();

  const { data: rows, error } = await supabase
    .from('past_questions')
    .select('topic, exam_type')
    .in('exam_type', ['WAEC', 'NECO'])
    .eq('subject', subject);

  if (error) console.error('WAEC/NECO subject topics error:', error);

  const topicMap = new Map();
  for (const row of rows || []) {
    const topic = row.topic?.trim();
    if (!topic) continue;
    if (!topicMap.has(topic)) topicMap.set(topic, new Set());
    if (row.exam_type) topicMap.get(topic).add(row.exam_type);
  }

  const topics = [...topicMap.entries()]
    .map(([name, exams]) => ({ name, exams: [...exams].sort() }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <main className="min-h-screen bg-slate-50">
      <Navbar />
      <section className="bg-brand-blue text-white">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <Link href="/waec-neco/study" className="text-sm font-semibold text-blue-200 hover:text-white">
            ← Back to WAEC & NECO subjects
          </Link>
          <p className="mt-10 text-xs font-extrabold uppercase tracking-[0.22em] text-brand-yellow">WAEC & NECO • STUDY</p>
          <h1 className="mt-3 text-4xl font-black sm:text-5xl">{subject}</h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-blue-100">
            Pick a topic to practise, or choose an exam mode. The topic list comes from the existing WAEC/NECO question bank.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-wrap gap-3">
          <Link href={`/tools/past-questions?subject=${encodeURIComponent(subject)}`} className="rounded-xl bg-brand-yellow px-5 py-3 text-sm font-extrabold text-brand-dark">
            📝 Practise all {subject}
          </Link>
          <Link href={`/tools/past-questions?exam_type=WAEC&subject=${encodeURIComponent(subject)}`} className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-extrabold text-brand-blue">
            WAEC questions
          </Link>
          <Link href={`/tools/past-questions?exam_type=NECO&subject=${encodeURIComponent(subject)}`} className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-extrabold text-brand-blue">
            NECO questions
          </Link>
        </div>

        {topics.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <p className="font-bold text-slate-700">No topic labels yet for this subject.</p>
            <p className="mt-2 text-sm text-slate-500">The existing subject questions are still available through the question bank.</p>
          </div>
        ) : (
          <>
            <div className="mb-7">
              <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-brand-yellow">TOPICS</p>
              <h2 className="mt-2 text-3xl font-black text-brand-blue">What do you want to practise?</h2>
              <p className="mt-2 text-slate-500">{topics.length} topic{topics.length === 1 ? '' : 's'} represented across WAEC and NECO.</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {topics.map((topic) => (
                <Link
                  key={topic.name}
                  href={`/tools/past-questions?subject=${encodeURIComponent(subject)}&topic=${encodeURIComponent(topic.name)}`}
                  className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-blue hover:shadow-md"
                >
                  <p className="font-extrabold text-slate-900">{topic.name}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {topic.exams.map((exam) => (
                      <span key={exam} className="rounded-full bg-blue-50 px-2 py-1 text-[11px] font-bold text-blue-700">{exam}</span>
                    ))}
                  </div>
                  <p className="mt-3 text-sm font-semibold text-brand-blue group-hover:underline">Practise this topic →</p>
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
