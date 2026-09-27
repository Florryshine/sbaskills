import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { createServerClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export default async function TheoryHubPage() {
  const supabase = createServerClient();
  const { data } = await supabase
    .from('theory_questions')
    .select('subject, topic, exam_type')
    .eq('status', 'published')
    .overlaps('exam_type', ['WAEC', 'NECO'])
    .order('subject')
    .order('topic');

  const groups = new Map();
  (data || []).forEach((row) => {
    const key = `${row.subject}||${row.topic}`;
    if (!groups.has(key)) groups.set(key, { subject: row.subject, topic: row.topic, exams: new Set() });
    (row.exam_type || []).forEach((exam) => groups.get(key).exams.add(exam));
  });

  return (
    <main className="min-h-screen bg-slate-50">
      <Navbar />
      <section className="bg-brand-blue text-white">
        <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6 lg:px-8">
          <Link href="/waec-neco" className="text-sm font-bold text-blue-200 hover:text-white">← Back to WAEC & NECO</Link>
          <p className="mt-9 text-xs font-extrabold uppercase tracking-[0.2em] text-brand-yellow">WAEC & NECO • THEORY</p>
          <h1 className="mt-3 text-4xl font-black sm:text-5xl">Theory practice</h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-blue-100">Write your answer first. Then reveal the marking points and model answer.</p>
        </div>
      </section>
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        {groups.size ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[...groups.values()].map((group) => (
              <Link key={`${group.subject}|${group.topic}`} href={`/waec-neco/study/${encodeURIComponent(group.subject)}/${encodeURIComponent(group.topic)}/theory`} className="rounded-2xl border bg-white p-5 shadow-sm hover:border-brand-blue">
                <div className="flex flex-wrap gap-2">{[...group.exams].map((exam) => <span key={exam} className="rounded-full bg-brand-blue/10 px-2 py-1 text-xs font-bold text-brand-blue">{exam}</span>)}</div>
                <h2 className="mt-3 font-black text-slate-900">{group.subject}</h2>
                <p className="mt-1 text-slate-600">{group.topic}</p>
                <span className="mt-4 inline-block text-sm font-extrabold text-brand-blue">Practise →</span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed bg-white p-10 text-center">
            <p className="text-4xl">✍️</p><h2 className="mt-3 text-xl font-black text-brand-blue">No theory questions published yet</h2>
            <p className="mt-2 text-sm text-slate-500">Theory questions created in Admin will appear here automatically.</p>
          </div>
        )}
      </div>
      <Footer />
    </main>
  );
}