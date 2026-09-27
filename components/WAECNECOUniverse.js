import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import CourseCard from '@/components/CourseCard';
import { createServerClient } from '@/lib/supabase-server';

const sections = [
  {
    eyebrow: 'STUDY',
    title: 'Learn the subjects that matter',
    description: 'Build understanding first, then use questions and quizzes to check what you actually know.',
    items: [
      { icon: '📚', title: 'Subjects & Topics', text: 'Your subject and topic learning hub is coming next.', href: '/waec-neco/study', action: 'Open study hub' },
      { icon: '📖', title: 'Library', text: 'Read SBA study resources and learning materials.', href: '/library', action: 'Open library' },
      { icon: '🧠', title: 'Flashcards', text: 'Use quick-recall cards to revise important ideas.', href: '/flashcards', action: 'Study cards' },
      { icon: '🎓', title: 'Courses', text: 'Follow structured lessons assigned to the WAEC & NECO world.', href: '/courses', action: 'Browse courses' },
    ],
  },
  {
    eyebrow: 'PRACTICE',
    title: 'Turn learning into exam practice',
    description: 'Do not stop at reading. Solve questions, test yourself and find the topics you need to revisit.',
    items: [
      { icon: '📝', title: 'Past Questions', text: 'Practise WAEC and NECO questions by subject, year and exam type.', href: '/tools/past-questions?exam_type=WAEC', action: 'Practise questions' },
      { icon: '🧠', title: 'Quizzes', text: 'Test your understanding with published SBA quizzes.', href: '/quizzes', action: 'View quizzes' },
      { icon: '🎮', title: 'Revision Games', text: 'Turn revision into quick interactive practice.', href: '/games', action: 'Play games' },
      { icon: '⚡', title: 'Daily Challenge', text: 'Keep your study habit active with a daily challenge.', href: '/challenge', action: 'Take challenge' },
    ],
  },
  {
    eyebrow: 'EXAM SKILLS',
    title: 'Prepare for more than objective questions',
    description: 'WAEC and NECO preparation needs objective practice, theory and practical readiness.',
    items: [
      { icon: '✍️', title: 'Theory', text: 'Practise WAEC and NECO theory questions with marking guides.', href: '/waec-neco/theory', action: 'Practise theory' },
      { icon: '🧪', title: 'Practical', text: 'Practical preparation is coming in Build 8E.', href: '#coming-next', action: 'Coming next' },
      { icon: '📊', title: 'My Progress', text: 'Track your preparation as the WAEC & NECO system grows.', href: '/dashboard', action: 'View dashboard' },
      { icon: '🎯', title: 'Next Move', text: 'Your personalised weak-topic recommendations arrive in Build 8F.', href: '#coming-next', action: 'Coming next' },
    ],
  },
];

export default async function WAECNECOUniverse() {
  const supabase = createServerClient();

  const [
    { data: courses },
    { count: waecCount },
    { count: necoCount },
    { data: assets },
  ] = await Promise.all([
    supabase
      .from('courses')
      .select('*')
      .eq('universe', 'WAEC_NECO')
      .eq('is_published', true)
      .order('created_at', { ascending: false })
      .limit(6),
    supabase
      .from('past_questions')
      .select('id', { count: 'exact', head: true })
      .eq('exam_type', 'WAEC'),
    supabase
      .from('past_questions')
      .select('id', { count: 'exact', head: true })
      .eq('exam_type', 'NECO'),
    supabase
      .from('knowledge_assets')
      .select('id, keyword, summary, topic_type, exam_type, estimated_duration_minutes')
      .overlaps('exam_type', ['WAEC', 'NECO'])
      .order('created_at', { ascending: false })
      .limit(6),
  ]);

  const totalQuestions = (waecCount || 0) + (necoCount || 0);

  return (
    <main className="min-h-screen bg-slate-50">
      <Navbar />

      <section className="overflow-hidden bg-brand-blue text-white">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <Link href="/" className="text-sm font-semibold text-blue-200 hover:text-white">
            ← Back to SBA
          </Link>

          <div className="mt-10 max-w-4xl">
            <p className="text-sm font-extrabold uppercase tracking-[0.22em] text-brand-yellow">
              Shiney Brain Academy • WAEC & NECO
            </p>
            <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-6xl">
              Learn it. Practise it. Be ready for the exam.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-blue-100 sm:text-xl">
              One learning centre for WAEC and NECO — built around subjects, topics, practice and the skills you need beyond objective questions.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/waec-neco/study" className="rounded-xl bg-brand-yellow px-5 py-3 text-sm font-extrabold text-brand-dark shadow-sm hover:opacity-90">
                📚 Start studying
              </Link>
              <Link href="/tools/past-questions?exam_type=WAEC" className="rounded-xl border border-white/25 bg-white/10 px-5 py-3 text-sm font-extrabold text-white hover:bg-white/15">
                📝 Practise questions
              </Link>
            </div>

            <div className="mt-10 flex flex-wrap gap-3 text-sm">
              <div className="rounded-full border border-white/15 bg-white/10 px-4 py-2">
                📝 {totalQuestions.toLocaleString()} WAEC/NECO questions
              </div>
              <div className="rounded-full border border-white/15 bg-white/10 px-4 py-2">
                📘 {assets?.length || 0} shared learning topics
              </div>
              <div className="rounded-full border border-white/15 bg-white/10 px-4 py-2">
                🎯 One system • two exam modes
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-slate-100 bg-white">
        <div className="mx-auto grid max-w-7xl grid-cols-2 divide-x divide-slate-100 sm:grid-cols-4 px-4 sm:px-6 lg:px-8">
          {[
            ['📚', 'Learn', 'Understand the topic'],
            ['📝', 'Practise', 'Solve exam questions'],
            ['✍️', 'Test', 'Objective + theory'],
            ['📊', 'Improve', 'Find your gaps'],
          ].map(([icon, title, text]) => (
            <div key={title} className="px-3 py-5 sm:px-6">
              <p className="text-xl">{icon}</p>
              <p className="mt-2 font-extrabold text-brand-blue">{title}</p>
              <p className="mt-1 text-xs text-slate-500">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        {sections.map((section) => (
          <section key={section.eyebrow} className="mb-16 last:mb-0">
            <div className="max-w-2xl">
              <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-brand-yellow">{section.eyebrow}</p>
              <h2 className="mt-2 text-3xl font-black text-brand-blue sm:text-4xl">{section.title}</h2>
              <p className="mt-3 text-slate-500">{section.description}</p>
            </div>

            <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {section.items.map((item) => (
                <Link
                  key={item.title}
                  href={item.href}
                  className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-blue hover:shadow-md"
                >
                  <span className="text-3xl">{item.icon}</span>
                  <h3 className="mt-4 font-extrabold text-slate-900">{item.title}</h3>
                  <p className="mt-2 min-h-[48px] text-sm leading-6 text-slate-500">{item.text}</p>
                  <span className="mt-5 inline-block text-sm font-extrabold text-brand-blue group-hover:underline">
                    {item.action} →
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ))}

        {assets?.length ? (
          <section className="mt-16 border-t border-slate-200 pt-14">
            <div className="max-w-2xl">
              <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-brand-yellow">SHARED KNOWLEDGE</p>
              <h2 className="mt-2 text-3xl font-black text-brand-blue">Study topics already in SBA</h2>
              <p className="mt-3 text-slate-500">
                These are pulled directly from the shared Knowledge Asset system. A topic tagged for WAEC and NECO can feed both exam modes without duplicate notes or flashcards.
              </p>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {assets.map((asset) => (
                <article key={asset.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-extrabold uppercase tracking-wide text-brand-blue">{asset.topic_type || 'Learning topic'}</span>
                    {asset.estimated_duration_minutes ? (
                      <span className="text-xs text-slate-400">{asset.estimated_duration_minutes} min</span>
                    ) : null}
                  </div>
                  <h3 className="mt-3 font-extrabold text-slate-900">{asset.keyword}</h3>
                  {asset.summary ? (
                    <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-500">{asset.summary}</p>
                  ) : null}
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {(asset.exam_type || []).map((exam) => (
                      <span key={exam} className="rounded-full bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700">{exam}</span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {courses?.length ? (
          <section className="mt-16 border-t border-slate-200 pt-14">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-brand-yellow">STRUCTURED LEARNING</p>
                <h2 className="mt-2 text-3xl font-black text-brand-blue">WAEC & NECO courses</h2>
                <p className="mt-2 text-slate-500">Courses published specifically for this learning world.</p>
              </div>
              <Link href="/courses" className="text-sm font-extrabold text-brand-blue hover:underline">
                Browse all courses →
              </Link>
            </div>

            <div className="mt-8 grid gap-7 md:grid-cols-2 xl:grid-cols-3">
              {courses.map((course) => <CourseCard key={course.id} course={course} />)}
            </div>
          </section>
        ) : (
          <section className="mt-16 rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center">
            <p className="text-4xl">📚</p>
            <h2 className="mt-3 text-2xl font-black text-brand-blue">WAEC & NECO courses will appear here</h2>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">
              Assign a course to the WAEC & NECO learning world in Admin and publish it. It will appear here automatically.
            </p>
          </section>
        )}

        <section id="coming-next" className="mt-16 rounded-3xl bg-brand-blue p-7 text-white sm:p-10">
          <div className="max-w-3xl">
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-brand-yellow">THE WAEC & NECO JOURNEY</p>
            <h2 className="mt-3 text-3xl font-black sm:text-4xl">One system. Everything the student needs to prepare.</h2>
            <p className="mt-4 leading-7 text-blue-100">
              Next, we are turning this centre into a subject-and-topic learning journey, then adding theory, practical preparation and personalised progress — all powered by the same Knowledge Assets.
            </p>
            <div className="mt-7 flex flex-wrap gap-3 text-sm font-extrabold">
              <span className="rounded-full bg-white/10 px-4 py-2">8B • Subjects & Topics</span>
              <span className="rounded-full bg-white/10 px-4 py-2">8C • Topic Learning</span>
              <span className="rounded-full bg-white/10 px-4 py-2">8D • Theory</span>
              <span className="rounded-full bg-white/10 px-4 py-2">8E • Practical</span>
              <span className="rounded-full bg-white/10 px-4 py-2">8F • Progress</span>
            </div>
          </div>
        </section>
      </div>

      <Footer />
    </main>
  );
}
