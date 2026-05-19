import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import CourseCard from '@/components/CourseCard';
import { createServerClient } from '@/lib/supabase-server';

const testimonials = [
  {
    name: 'Amaka O.',
    quote: 'The lesson flow kept me disciplined. I finally studied with clarity and confidence.'
  },
  {
    name: 'David E.',
    quote: 'I loved the structure. Seeing my progress motivated me to finish each topic.'
  },
  {
    name: 'Ruth A.',
    quote: 'The platform felt premium and easy to use on my phone, which mattered a lot.'
  }
];

export default async function HomePage() {
  const supabase = createServerClient();
  const { data: courses } = await supabase
    .from('courses')
    .select('*')
    .eq('is_published', true)
    .order('created_at', { ascending: false })
    .limit(3);

  return (
    <main>
      <Navbar />

      <section className="bg-brand-blue text-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:items-center lg:px-8 lg:py-28">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.4em] text-brand-yellow">Where Champions Are Made</p>
            <h1 className="mt-6 text-4xl font-extrabold leading-tight sm:text-5xl lg:text-6xl">
              Serious JAMB preparation for focused Nigerian students.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-blue-100">
              Learn with structured lessons, progress tracking, and an experience designed to help you prepare with discipline and confidence.
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <a href="/register" className="rounded-full bg-brand-yellow px-6 py-4 text-sm font-bold text-brand-dark transition hover:opacity-90">
                Start Learning
              </a>
              <a href="#courses" className="rounded-full border border-white/30 px-6 py-4 text-sm font-semibold text-white transition hover:bg-white/10">
                Browse Courses
              </a>
            </div>
          </div>
          <div className="rounded-[2rem] bg-white/10 p-8 shadow-soft backdrop-blur">
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="rounded-3xl bg-white p-6 text-brand-dark">
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">Exam Focus</p>
                <h3 className="mt-3 text-2xl font-bold text-brand-blue">JAMB Ready</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">Build subject mastery with lesson-by-lesson preparation.</p>
              </div>
              <div className="rounded-3xl bg-brand-yellow p-6 text-brand-dark">
                <p className="text-sm font-semibold uppercase tracking-[0.3em]">Track Progress</p>
                <h3 className="mt-3 text-2xl font-bold">Stay Consistent</h3>
                <p className="mt-3 text-sm leading-6">See what you have completed and keep moving forward.</p>
              </div>
              <div className="rounded-3xl bg-white p-6 text-brand-dark sm:col-span-2">
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">Support</p>
                <h3 className="mt-3 text-2xl font-bold text-brand-blue">Call us anytime</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">08138082009 · 09053626207</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="courses" className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand-yellow">Featured Courses</p>
              <h2 className="mt-3 text-3xl font-bold text-brand-blue">Prepare with structured, premium lessons</h2>
            </div>
            <a href="/register" className="text-sm font-bold text-brand-blue underline underline-offset-4">
              Create your account
            </a>
          </div>
          <div className="mt-12 grid gap-8 md:grid-cols-2 xl:grid-cols-3">
            {(courses || []).length ? (
              courses.map((course) => <CourseCard key={course.id} course={course} />)
            ) : (
              <div className="rounded-3xl border border-dashed border-slate-200 p-10 text-slate-500">
                No published courses yet. Once the admin publishes courses, they will appear here.
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand-yellow">How It Works</p>
            <h2 className="mt-3 text-3xl font-bold text-brand-blue">A simple path from signup to exam success</h2>
          </div>
          <div className="mt-12 grid gap-8 lg:grid-cols-3">
            {[
              { step: '01', title: 'Register your account', text: 'Create your student profile with your name, email, phone, and secure password.' },
              { step: '02', title: 'Enroll in a course', text: 'Choose a course, pay securely with Paystack, or auto-enroll when the course is free.' },
              { step: '03', title: 'Watch and complete lessons', text: 'Learn at your pace, track your progress, and return to lessons anytime.' }
            ].map((item) => (
              <div key={item.step} className="rounded-3xl bg-white p-8 shadow-soft">
                <span className="inline-flex rounded-full bg-brand-blue px-3 py-1 text-xs font-bold text-white">{item.step}</span>
                <h3 className="mt-5 text-2xl font-bold text-brand-blue">{item.title}</h3>
                <p className="mt-4 text-sm leading-7 text-slate-600">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand-yellow">Testimonials</p>
            <h2 className="mt-3 text-3xl font-bold text-brand-blue">Students love the clarity and structure</h2>
          </div>
          <div className="mt-12 grid gap-8 lg:grid-cols-3">
            {testimonials.map((item) => (
              <blockquote key={item.name} className="rounded-3xl border border-slate-100 bg-slate-50 p-8 shadow-soft">
                <p className="text-lg font-semibold leading-8 text-slate-700">“{item.quote}”</p>
                <footer className="mt-6 text-sm font-bold uppercase tracking-[0.2em] text-brand-blue">{item.name}</footer>
              </blockquote>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
