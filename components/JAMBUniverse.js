import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import CourseCard from '@/components/CourseCard';
import { createServerClient } from '@/lib/supabase-server';

const sections = [
  {
    eyebrow: 'PRACTICE',
    title: 'Turn study into questions',
    description: 'Train with the question bank, quizzes and daily challenges instead of only reading.',
    items: [
      { icon: '📝', title: 'Past Questions', text: 'Search JAMB questions by subject, topic and year.', href: '/jamb/practice', action: 'Practice now' },
      { icon: '⚡', title: 'Daily Challenge', text: 'Take the daily timed challenge and keep your streak alive.', href: '/challenge', action: 'Take challenge' },
      { icon: '🎮', title: 'Revision Games', text: 'Revise topics through quick interactive games.', href: '/games', action: 'Play games' },
      { icon: '🧠', title: 'Quizzes', text: 'Test what you know with published SBA quizzes.', href: '/quizzes', action: 'View quizzes' },
    ],
  },
  {
    eyebrow: 'STUDY',
    title: 'Build your JAMB knowledge',
    description: 'Use the learning resources already inside SBA to understand, revise and remember.',
    items: [
      { icon: '📚', title: 'Subjects & Topics', text: 'Study JAMB subjects and practise by topic.', href: '/jamb/study', action: 'Choose a subject' },
      { icon: '🎓', title: 'Courses', text: 'Learn through structured JAMB lessons and courses.', href: '/courses', action: 'Browse courses' },
      { icon: '🧠', title: 'Flashcards', text: 'Use quick-recall cards when you need fast revision.', href: '/flashcards', action: 'Study cards' },
      { icon: '📖', title: 'Library', text: 'Explore the SBA learning library and study resources.', href: '/library', action: 'Open library' },
      { icon: '🤖', title: 'JAMB AI Playbook', text: 'Use the JAMB-focused AI study system built by SBA.', href: '/jamb-playbook', action: 'Explore playbook' },
    ],
  },
  {
    eyebrow: 'ADMISSION',
    title: 'Prepare beyond the exam',
    description: 'JAMB is the exam. Admission is the goal.',
    items: [
      { icon: '🧮', title: 'JAMB Aggregate', text: 'Work out your aggregate using your UTME and O’Level results.', href: '/tools/jamb-aggregate', action: 'Calculate' },
      { icon: '🎯', title: 'Subject Combination', text: 'Check the subjects required for your intended course.', href: '/tools/subject-combination', action: 'Check subjects' },
      { icon: '🏆', title: 'Leaderboard', text: 'See how you are doing alongside other SBA learners.', href: '/leaderboard', action: 'View leaderboard' },
      { icon: '📊', title: 'JAMB Progress', text: 'See your practice accuracy, weak topics and what to work on next.', href: '/jamb/progress', action: 'View progress' },
    ],
  },
];

export default async function JAMBUniverse() {
  const supabase = createServerClient();

  const [{ data: courses }, { count: questionCount }] = await Promise.all([
    supabase
      .from('courses')
      .select('*')
      .eq('universe', 'JAMB')
      .eq('is_published', true)
      .order('created_at', { ascending: false })
      .limit(6),
    supabase
      .from('past_questions')
      .select('id', { count: 'exact', head: true })
      .eq('exam_type', 'JAMB'),
  ]);

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
              Shiney Brain Academy • JAMB 2027
            </p>
            <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-6xl">
              Your JAMB command centre.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-blue-100 sm:text-xl">
              Study smarter, practise real questions, test yourself and track your preparation — all in one place.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/jamb/practice" className="rounded-xl bg-brand-yellow px-5 py-3 text-sm font-extrabold text-brand-dark shadow-sm hover:opacity-90">
                📝 Start practising
              </Link>
              <Link href="/jamb/progress" className="rounded-xl border border-white/25 bg-white/10 px-5 py-3 text-sm font-extrabold text-white hover:bg-white/15">
                📊 My progress
              </Link>
            </div>

            <div className="mt-10 flex flex-wrap gap-3 text-sm">
              <div className="rounded-full border border-white/15 bg-white/10 px-4 py-2">
                📝 {typeof questionCount === 'number' ? questionCount.toLocaleString() : 'Your'} JAMB questions
              </div>
              <div className="rounded-full border border-white/15 bg-white/10 px-4 py-2">
                🎯 Built around your admission goal
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-slate-100 bg-white">
        <div className="mx-auto grid max-w-7xl grid-cols-2 divide-x divide-slate-100 sm:grid-cols-4 px-4 sm:px-6 lg:px-8">
          {[
            ['📚', 'Study', 'Learn the topic'],
            ['📝', 'Practise', 'Solve questions'],
            ['⚡', 'Test', 'Measure yourself'],
            ['📊', 'Improve', 'Track your gaps'],
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
                  key={item.href}
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

        {courses?.length ? (
          <section className="mt-16 border-t border-slate-200 pt-14">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-brand-yellow">STRUCTURED LEARNING</p>
                <h2 className="mt-2 text-3xl font-black text-brand-blue">JAMB courses</h2>
                <p className="mt-2 text-slate-500">Courses published specifically for the JAMB learning world.</p>
              </div>
              <Link href="/courses" className="text-sm font-extrabold text-brand-blue hover:underline">
                Browse all courses →
              </Link>
            </div>

            <div className="mt-8 grid gap-7 md:grid-cols-2 xl:grid-cols-3">
              {courses.map((course) => <CourseCard key={course.id} course={course} />)}
            </div>
          </section>
        ) : null}

        <section className="mt-16 rounded-3xl bg-brand-blue p-7 text-white sm:p-10">
          <div className="max-w-3xl">
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-brand-yellow">THE GOAL</p>
            <h2 className="mt-3 text-3xl font-black sm:text-4xl">Don't just prepare to write JAMB. Prepare to get where you want to go.</h2>
            <p className="mt-4 leading-7 text-blue-100">
              Your score matters. Your subject combination matters. Your admission target matters. SBA is bringing those pieces into one preparation journey.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/jamb/practice" className="rounded-xl bg-brand-yellow px-5 py-3 text-sm font-extrabold text-brand-dark">
                Start with Past Questions
              </Link>
              <Link href="/dashboard" className="rounded-xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-extrabold text-white">
                Go to my dashboard
              </Link>
            </div>
          </div>
        </section>
      </div>

      <Footer />
    </main>
  );
}
