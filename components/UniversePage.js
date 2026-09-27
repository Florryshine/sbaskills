import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import CourseCard from '@/components/CourseCard';
import { createServerClient } from '@/lib/supabase-server';
import { getUniverse } from '@/lib/universes';

const toolsByUniverse = {
  JAMB: [
    { label: 'Past Questions', href: '/tools/past-questions', icon: '📝' },
    { label: 'JAMB Aggregate', href: '/tools/jamb-aggregate', icon: '🧮' },
    { label: 'JAMB AI Playbook', href: '/jamb-playbook', icon: '🤖' },
  ],
  WAEC_NECO: [
    { label: 'Past Questions', href: '/tools/past-questions', icon: '📝' },
    { label: 'WAEC Grade Calculator', href: '/tools/waec-grade-calculator', icon: '📊' },
  ],
  POST_UTME: [
    { label: 'Past Questions', href: '/tools/past-questions', icon: '📝' },
    { label: 'Subject Combination', href: '/tools/subject-combination', icon: '🎯' },
  ],
  UNIVERSITY: [
    { label: 'CGPA Calculator', href: '/tools/cgpa-calculator', icon: '🧮' },
    { label: 'AI Playbook', href: '/ai-playbook', icon: '🤖' },
  ],
  AI_SKILLS: [
    { label: 'AI Playbook', href: '/ai-playbook', icon: '🤖' },
    { label: 'Student Tools', href: '/tools', icon: '🛠️' },
  ],
};

const examTypesByUniverse = {
  JAMB: ['JAMB'],
  WAEC_NECO: ['WAEC', 'NECO'],
  POST_UTME: ['POST_UTME'],
};

const worldCopy = {
  JAMB: 'Everything here is organized around JAMB preparation and your admission goal.',
  WAEC_NECO: 'A focused study space for WAEC and NECO preparation, revision and exam practice.',
  POST_UTME: 'A focused space for students preparing for university screening and admission tests.',
  UNIVERSITY: 'Resources and learning tools for students already in university.',
  AI_SKILLS: 'Practical AI and skills learning for students who want to build beyond the classroom.',
};

export default async function UniversePage({ slug }) {
  const universe = getUniverse(slug);
  if (!universe) return null;

  const supabase = createServerClient();

  const [{ data: courses }, { data: assets }] = await Promise.all([
    supabase
      .from('courses')
      .select('*')
      .eq('universe', universe.key)
      .eq('is_published', true)
      .order('created_at', { ascending: false }),
    getStudyAssets(supabase, universe.key),
  ]);

  const tools = toolsByUniverse[universe.key] || [];
  const assetIds = (assets || []).map((asset) => asset.id);

  // Quizzes and flashcards are generated from the same Knowledge Assets.
  // We reuse those existing published records instead of creating a second
  // universe-specific content bank.
  let quizzes = [];
  let flashcards = [];

  if (assetIds.length) {
    const [{ data: quizRows }, { data: flashcardRows }] = await Promise.all([
      supabase
        .from('quiz_drafts')
        .select('id, keyword, questions, estimated_minutes, knowledge_asset_id')
        .eq('status', 'published')
        .in('knowledge_asset_id', assetIds)
        .order('created_at', { ascending: false })
        .limit(6),
      supabase
        .from('flashcard_drafts')
        .select('id, keyword, cards, knowledge_asset_id')
        .eq('status', 'published')
        .in('knowledge_asset_id', assetIds)
        .order('created_at', { ascending: false })
        .limit(6),
    ]);

    quizzes = quizRows || [];
    flashcards = flashcardRows || [];
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <Navbar />

      <section className="bg-brand-blue text-white">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <Link href="/" className="text-sm font-semibold text-blue-200 hover:text-white">← Back to SBA</Link>
          <p className="mt-8 text-sm font-bold uppercase tracking-widest text-brand-yellow">Shiney Brain Academy</p>
          <h1 className="mt-3 text-4xl font-extrabold sm:text-5xl">{universe.label}</h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-blue-100">{worldCopy[universe.key]}</p>
        </div>
      </section>

      <section className="bg-white border-b border-slate-100">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-wrap gap-3">
            {tools.map((tool) => (
              <Link key={tool.href} href={tool.href} className="rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-brand-blue hover:border-brand-blue hover:bg-blue-50 transition">
                {tool.icon} {tool.label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {assets?.length ? (
        <section className="bg-slate-50 py-14 border-b border-slate-100">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-sm font-bold uppercase tracking-widest text-brand-yellow">Study Topics</p>
                <h2 className="mt-2 text-3xl font-extrabold text-brand-blue">What do you want to learn?</h2>
                <p className="mt-2 max-w-2xl text-sm text-slate-500">
                  These topics come from SBA's shared Knowledge Asset library. The same topic can serve multiple exams without creating duplicate content.
                </p>
              </div>
              <Link href="/tools/past-questions" className="hidden sm:block text-sm font-bold text-brand-blue underline underline-offset-4">Practice past questions →</Link>
            </div>

            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {assets.map((asset) => (
                <article key={asset.id} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold uppercase tracking-wide text-brand-blue">{asset.topic_type || 'Learning'}</span>
                    {asset.estimated_duration_minutes ? (
                      <span className="text-xs text-slate-400">{asset.estimated_duration_minutes} min</span>
                    ) : null}
                  </div>
                  <h3 className="mt-3 font-bold text-slate-800">{asset.keyword}</h3>
                  {asset.summary ? <p className="mt-2 text-sm leading-6 text-slate-500 line-clamp-3">{asset.summary}</p> : null}
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {(asset.exam_type || []).map((exam) => (
                      <span key={exam} className="rounded-full bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700">{exam}</span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {(quizzes.length || flashcards.length) ? (
        <section className="bg-white py-14 border-b border-slate-100">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div>
              <p className="text-sm font-bold uppercase tracking-widest text-brand-yellow">Practice</p>
              <h2 className="mt-2 text-3xl font-extrabold text-brand-blue">Practice what you're learning</h2>
              <p className="mt-2 text-sm text-slate-500">Published quizzes and flashcards connected to these same study topics.</p>
            </div>

            <div className="mt-8 grid gap-8 lg:grid-cols-2">
              {quizzes.length ? (
                <div>
                  <h3 className="mb-4 text-lg font-extrabold text-slate-800">📝 Quizzes</h3>
                  <div className="grid gap-4">
                    {quizzes.map((quiz) => (
                      <Link key={quiz.id} href={`/quizzes/${quiz.id}?draft=true`} className="rounded-2xl border border-slate-100 bg-slate-50 p-5 hover:border-brand-blue hover:bg-blue-50 transition">
                        <div className="flex items-center justify-between gap-4">
                          <h4 className="font-bold text-slate-800">{quiz.keyword}</h4>
                          <span className="text-xs font-semibold text-slate-500">{quiz.questions?.length || 0} questions</span>
                        </div>
                        {quiz.estimated_minutes ? <p className="mt-2 text-xs text-slate-500">About {quiz.estimated_minutes} minutes</p> : null}
                        <span className="mt-3 inline-block text-sm font-bold text-brand-blue">Take quiz →</span>
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}

              {flashcards.length ? (
                <div>
                  <h3 className="mb-4 text-lg font-extrabold text-slate-800">🧠 Flashcards</h3>
                  <div className="grid gap-4">
                    {flashcards.map((set) => (
                      <Link key={set.id} href={`/flashcards/${set.id}`} className="rounded-2xl border border-slate-100 bg-slate-50 p-5 hover:border-brand-blue hover:bg-blue-50 transition">
                        <div className="flex items-center justify-between gap-4">
                          <h4 className="font-bold text-slate-800">{set.keyword}</h4>
                          <span className="text-xs font-semibold text-slate-500">{set.cards?.length || 0} cards</span>
                        </div>
                        <span className="mt-3 inline-block text-sm font-bold text-brand-blue">Study flashcards →</span>
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-sm font-bold uppercase tracking-widest text-brand-yellow">Learning</p>
              <h2 className="mt-2 text-3xl font-extrabold text-brand-blue">Courses for {universe.label}</h2>
              <p className="mt-2 text-sm text-slate-500">Only courses assigned to this learning world appear here.</p>
            </div>
            <Link href="/courses" className="text-sm font-bold text-brand-blue underline underline-offset-4">Browse all →</Link>
          </div>

          {courses?.length ? (
            <div className="mt-10 grid gap-8 md:grid-cols-2 xl:grid-cols-3">
              {courses.map((course) => <CourseCard key={course.id} course={course} />)}
            </div>
          ) : (
            <div className="mt-10 rounded-3xl border border-dashed border-slate-200 bg-white p-12 text-center">
              <p className="text-5xl">📚</p>
              <h3 className="mt-4 text-xl font-extrabold text-brand-blue">This world is being stocked.</h3>
              <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">
                No published courses have been assigned here yet. Once an admin assigns a course to {universe.label}, it will appear automatically.
              </p>
              <Link href="/courses" className="mt-6 inline-block rounded-full bg-brand-blue px-6 py-3 text-sm font-bold text-white">Browse all courses</Link>
            </div>
          )}
        </div>
      </section>

      <Footer />
    </main>
  );
}

async function getStudyAssets(supabase, universeKey) {
  const examTypes = examTypesByUniverse[universeKey] || [];
  if (!examTypes.length) return [];

  const { data, error } = await supabase
    .from('knowledge_assets')
    .select('id, keyword, summary, topic_type, exam_type, estimated_duration_minutes')
    .overlaps('exam_type', examTypes)
    .order('created_at', { ascending: false })
    .limit(8);

  if (error) {
    console.error('Learning world study asset fetch error:', error);
    return [];
  }

  return data || [];
}
