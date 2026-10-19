import { createAdminClient } from '@/lib/supabase-admin';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function JambSyllabusPage() {
  const supabase = createAdminClient();
  const { data: curriculum } = await supabase
    .from('curricula')
    .select('id,name,version,exam_type,status')
    .eq('exam_type', 'JAMB')
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();

  if (!curriculum) return <main className="mx-auto max-w-3xl p-6">The JAMB syllabus is not configured yet.</main>;

  const { data: topics, error } = await supabase
    .from('curriculum_topics')
    .select('id,subject,title,order_index,code,syllabus_text')
    .eq('curriculum_id', curriculum.id)
    .eq('subject', 'Physics')
    .not('code', 'is', null)
    .like('code', 'PHYSICS_%')
    .order('order_index', { ascending: true });

  const syllabusTopics = topics || [];
  return (
    <main className="min-h-screen bg-slate-50 py-6 sm:py-10">
      <div className="mx-auto max-w-4xl px-4">
        <Link href="/jamb/syllabus-mastery" className="text-sm font-bold text-blue-700">← Syllabus mastery</Link>
        <header className="mt-4 rounded-3xl bg-brand-blue p-6 text-white sm:p-8">
          <p className="text-xs font-black uppercase tracking-[.18em] text-blue-100">SHINEY BRAIN ACADEMY • JAMB 2027</p>
          <h1 className="mt-2 text-3xl font-black sm:text-4xl">Physics syllabus</h1>
          <p className="mt-3 max-w-2xl text-sm text-blue-100">{curriculum.name} · Version {curriculum.version || '1'}. Browse the supplied topic breakdowns and learning objectives.</p>
          <div className="mt-5 flex flex-wrap gap-3 text-sm">
            <span className="rounded-full bg-white/15 px-3 py-1.5">{syllabusTopics.length} topics imported</span>
            <span className="rounded-full bg-white/15 px-3 py-1.5">Subtopics + objectives</span>
          </div>
        </header>
        {error && <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">Could not load syllabus topics. Please refresh in a moment.</p>}
        {!syllabusTopics.length && !error && <p className="mt-5 rounded-xl border bg-white p-5">No Physics topics are available for this curriculum yet.</p>}
        <section className="mt-5 space-y-3">
          {syllabusTopics.map((topic, index) => (
            <details key={topic.id} className="group overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <summary className="flex cursor-pointer list-none items-center gap-3 p-4 sm:p-5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-sm font-black text-blue-800">{topic.order_index || index + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-bold text-slate-900">{topic.title}</span>
                  <span className="mt-1 block text-xs text-slate-500">Open to view subtopics and learning objectives</span>
                </span>
                <span className="text-xl text-slate-500 group-open:rotate-45">＋</span>
              </summary>
              <div className="border-t border-slate-100 px-4 py-4 sm:px-5">
                {topic.syllabus_text ? (
                  <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-7 text-slate-700">{topic.syllabus_text}</pre>
                ) : (
                  <p className="text-sm text-slate-500">Detailed syllabus text has not been added for this topic.</p>
                )}
              </div>
            </details>
          ))}
        </section>
        <footer className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
          <strong>Source note:</strong> Topic numbering and wording follow the syllabus text submitted for SBA. Topics 30–33 were not included in that submission. A few source inconsistencies remain flagged for review.
        </footer>
      </div>
    </main>
  );
}
