import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { createServerClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'JAMB Study | Shiney Brain Academy',
  description: 'Choose a JAMB subject and study by topic with Shiney Brain Academy.',
};

export default async function JAMBStudyPage() {
  const supabase = createServerClient();
  const { data: rows, error } = await supabase
    .from('past_questions')
    .select('subject, topic')
    .eq('exam_type', 'JAMB');

  if (error) console.error('JAMB study subjects error:', error);

  const subjectMap = new Map();
  for (const row of rows || []) {
    const subject = row.subject?.trim();
    if (!subject) continue;
    const topic = row.topic?.trim();
    if (!subjectMap.has(subject)) subjectMap.set(subject, new Set());
    if (topic) subjectMap.get(subject).add(topic);
  }

  const subjects = [...subjectMap.entries()]
    .map(([name, topics]) => ({ name, topicCount: topics.size }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <main className="min-h-screen bg-slate-50">
      <Navbar />
      <section className="bg-brand-blue text-white">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <Link href="/jamb" className="text-sm font-semibold text-blue-200 hover:text-white">
            ← Back to JAMB
          </Link>
          <p className="mt-10 text-xs font-extrabold uppercase tracking-[0.22em] text-brand-yellow">
            JAMB 2027 • STUDY
          </p>
          <h1 className="mt-3 text-4xl font-black sm:text-5xl">Choose your subject.</h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-blue-100">
            Pick a subject to see the topics already available in the JAMB question bank, then practise exactly what you want to improve.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        {subjects.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <p className="text-lg font-bold text-slate-700">No JAMB subject data yet.</p>
            <p className="mt-2 text-sm text-slate-500">Once JAMB questions are added, subjects will appear here automatically.</p>
            <Link href="/tools/past-questions" className="mt-5 inline-block font-bold text-brand-blue hover:underline">
              Open Past Questions →
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-7">
              <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-brand-yellow">YOUR SUBJECTS</p>
              <h2 className="mt-2 text-3xl font-black text-brand-blue">Study by subject</h2>
              <p className="mt-2 text-slate-500">{subjects.length} subjects currently represented in the JAMB question bank.</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {subjects.map((subject) => (
                <Link
                  key={subject.name}
                  href={`/jamb/study/${encodeURIComponent(subject.name)}`}
                  className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-blue hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xl font-black text-slate-900">{subject.name}</p>
                      <p className="mt-2 text-sm text-slate-500">
                        {subject.topicCount ? `${subject.topicCount} topic${subject.topicCount === 1 ? '' : 's'} available` : 'Topic practice available'}
                      </p>
                    </div>
                    <span className="text-2xl">📚</span>
                  </div>
                  <span className="mt-6 inline-block text-sm font-extrabold text-brand-blue group-hover:underline">
                    Open subject →
                  </span>
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
