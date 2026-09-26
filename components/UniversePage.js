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

export default async function UniversePage({ slug }) {
  const universe = getUniverse(slug);
  if (!universe) return null;

  const supabase = createServerClient();
  const { data: courses } = await supabase
    .from('courses')
    .select('*')
    .eq('universe', universe.key)
    .eq('is_published', true)
    .order('created_at', { ascending: false });

  const tools = toolsByUniverse[universe.key] || [];

  return (
    <main className="min-h-screen bg-slate-50">
      <Navbar />

      <section className="bg-brand-blue text-white">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <Link href="/" className="text-sm font-semibold text-blue-200 hover:text-white">← Back to SBA</Link>
          <p className="mt-8 text-sm font-bold uppercase tracking-widest text-brand-yellow">Shiney Brain Academy</p>
          <h1 className="mt-3 text-4xl font-extrabold sm:text-5xl">{universe.label}</h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-blue-100">
            {universe.key === 'JAMB' && 'Everything here is organized around JAMB preparation and your admission goal.'}
            {universe.key === 'WAEC_NECO' && 'A focused study space for WAEC and NECO preparation, revision and exam practice.'}
            {universe.key === 'POST_UTME' && 'A focused space for students preparing for university screening and admission tests.'}
            {universe.key === 'UNIVERSITY' && 'Resources and learning tools for students already in university.'}
            {universe.key === 'AI_SKILLS' && 'Practical AI and skills learning for students who want to build beyond the classroom.'}
          </p>
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
