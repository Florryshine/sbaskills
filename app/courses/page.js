import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import CourseCard from '@/components/CourseCard';
import { createServerClient } from '@/lib/supabase-server';

export const metadata = {
  title: 'Courses | Shiney Brain Academy',
  description: 'Browse all courses on Shiney Brain Academy',
};

const categories = [
  { label: 'All Courses', value: 'all', emoji: '📚' },
  { label: 'JAMB & Post-UTME', value: 'jamb', emoji: '🎓' },
  { label: 'Tech Skills', value: 'tech', emoji: '💻' },
  { label: 'Graphics & Video', value: 'graphics', emoji: '🎨' },
  { label: 'Business & Freelancing', value: 'business', emoji: '💼' },
  { label: 'Career Development', value: 'career', emoji: '🚀' },
  { label: 'Personal Growth', value: 'personal', emoji: '🧠' },
];

export default async function CoursesPage() {
  const supabase = createServerClient();
  const { data: courses } = await supabase
    .from('courses')
    .select('*')
    .eq('is_published', true)
    .order('created_at', { ascending: false });

  return (
    <main>
      <Navbar />

      {/* Hero */}
      <section className="bg-brand-blue text-white py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="text-sm font-bold uppercase tracking-widest text-brand-yellow">
              All Courses
            </p>
            <h1 className="mt-3 text-4xl font-extrabold sm:text-5xl">
              Find Your Perfect Course
            </h1>
            <p className="mt-4 text-blue-200 max-w-xl mx-auto">
              From JAMB prep to tech skills, business and personal development — we have the right course for your goals.
            </p>
          </div>

          {/* Search bar */}
          <div className="mt-10 max-w-xl mx-auto">
            <div className="flex items-center rounded-full bg-white/10 border border-white/20 px-4 py-3 gap-3">
              <span className="text-xl">🔍</span>
              <input
                type="text"
                placeholder="Search courses..."
                className="flex-1 bg-transparent text-white placeholder-blue-300 outline-none text-sm"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Category Filter */}
      <section className="bg-white border-b border-slate-100 py-4 sticky top-16 z-30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {categories.map((cat) => (
              <button
                key={cat.value}
                className="flex-shrink-0 rounded-full border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-brand-blue hover:text-white hover:border-brand-blue transition first:bg-brand-blue first:text-white first:border-brand-blue"
              >
                {cat.emoji} {cat.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Courses Grid */}
      <section className="bg-slate-50 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

          {(courses || []).length ? (
            <>
              <p className="text-sm text-slate-500 mb-8">
                Showing <span className="font-bold text-brand-blue">{courses.length}</span> courses
              </p>
              <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-3">
                {courses.map((course) => (
                  <CourseCard key={course.id} course={course} />
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-20">
              <p className="text-6xl">📚</p>
              <h3 className="mt-6 text-2xl font-bold text-brand-blue">
                Courses Launching Soon!
              </h3>
              <p className="mt-3 text-slate-500 max-w-md mx-auto">
                We are currently preparing amazing courses for you. Register now to be the first to know when we go live!
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-4">
                <a
                  href="/register"
                  className="rounded-full bg-brand-blue px-8 py-4 text-sm font-bold text-white hover:opacity-90 transition"
                >
                  Register Free — Be First to Know
                </a>
                <a
                  href="/contact"
                  className="rounded-full border border-brand-blue px-8 py-4 text-sm font-bold text-brand-blue hover:bg-brand-blue hover:text-white transition"
                >
                  Contact Us
                </a>
              </div>

              {/* Coming soon categories */}
              <div className="mt-16">
                <p className="text-sm font-bold uppercase tracking-widest text-brand-yellow mb-8">
                  Coming Soon
                </p>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 max-w-3xl mx-auto">
                  {[
                    { emoji: '🎓', title: 'JAMB & Post-UTME', desc: 'Complete exam preparation' },
                    { emoji: '💻', title: 'Tech Skills', desc: 'Coding, web dev and more' },
                    { emoji: '🎨', title: 'Graphics & Video', desc: 'Design and editing skills' },
                    { emoji: '💼', title: 'Business & Freelancing', desc: 'Make money with your skills' },
                    { emoji: '🚀', title: 'Career Development', desc: 'Land your dream job' },
                    { emoji: '🧠', title: 'Personal Growth', desc: 'Become your best self' },
                  ].map((item) => (
                    <div
                      key={item.title}
                      className="rounded-2xl bg-white border border-slate-100 p-6 text-left"
                    >
                      <span className="text-3xl">{item.emoji}</span>
                      <h4 className="mt-3 font-bold text-brand-blue">{item.title}</h4>
                      <p className="mt-1 text-xs text-slate-500">{item.desc}</p>
                      <span className="mt-3 inline-block rounded-full bg-brand-yellow/20 px-3 py-1 text-xs font-bold text-brand-dark">
                        Coming Soon
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-brand-yellow py-14">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <h2 className="text-3xl font-extrabold text-brand-dark">
            Can't find what you're looking for?
          </h2>
          <p className="mt-3 text-brand-dark/70">
            Contact us and tell us what course you need — we'll add it for you!
          </p>
          <a
            href="/contact"
            className="mt-8 inline-block rounded-full bg-brand-blue px-8 py-4 text-sm font-bold text-white hover:opacity-90 transition"
          >
            Request a Course
          </a>
        </div>
      </section>

      <Footer />
    </main>
  );
  }
        
