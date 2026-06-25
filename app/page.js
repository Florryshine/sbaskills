import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import CourseCard from '@/components/CourseCard';
import { createServerClient } from '@/lib/supabase-server';

const stats = [
  { number: '1,000+', label: 'Students' },
  { number: '20+', label: 'Courses' },
  { number: '6', label: 'Skill Categories' },
  { number: '100%', label: 'Flexible Learning' },
];

const categories = [
  {
    emoji: '🎓',
    title: 'JAMB & Post-UTME',
    desc: 'Structured exam prep to help you score high and gain admission.',
    color: 'bg-blue-50 border-blue-100',
    accent: 'text-blue-700',
  },
  {
    emoji: '💻',
    title: 'Tech Skills',
    desc: 'Coding, web dev, app development, data analysis and more.',
    color: 'bg-yellow-50 border-yellow-100',
    accent: 'text-yellow-700',
  },
  {
    emoji: '🎨',
    title: 'Graphics & Video Editing',
    desc: 'Design, UI/UX, content creation and digital creative skills.',
    color: 'bg-pink-50 border-pink-100',
    accent: 'text-pink-700',
  },
  {
    emoji: '💼',
    title: 'Business & Freelancing',
    desc: 'Sales, e-commerce, personal branding and entrepreneurship.',
    color: 'bg-green-50 border-green-100',
    accent: 'text-green-700',
  },
  {
    emoji: '🚀',
    title: 'Career Development',
    desc: 'CV writing, interview prep, LinkedIn and remote job skills.',
    color: 'bg-purple-50 border-purple-100',
    accent: 'text-purple-700',
  },
  {
    emoji: '🧠',
    title: 'Personal Growth',
    desc: 'Leadership, confidence, financial literacy and productivity.',
    color: 'bg-orange-50 border-orange-100',
    accent: 'text-orange-700',
  },
];

// ✅ Fallback static testimonials (used when database has none)
const fallbackTestimonials = [
  {
    id: 'static-1',
    name: 'Amaka O.',
    course: 'JAMB Student',
    testimonial: 'The lesson flow kept me disciplined. I finally studied with clarity and confidence.',
    rating: 5,
    is_verified: false,
  },
  {
    id: 'static-2',
    name: 'David E.',
    course: 'Tech Skills Student',
    testimonial: 'I loved the structure. Seeing my progress motivated me to finish each topic.',
    rating: 5,
    is_verified: false,
  },
  {
    id: 'static-3',
    name: 'Ruth A.',
    course: 'Digital Marketing Student',
    testimonial: 'The platform felt premium and easy to use on my phone, which mattered a lot.',
    rating: 5,
    is_verified: false,
  },
];

const howItWorks = [
  {
    step: '01',
    title: 'Create Your Account',
    text: 'Sign up with your name, email and phone number in less than a minute.',
  },
  {
    step: '02',
    title: 'Choose a Course',
    text: 'Browse our categories, pick a course that fits your goal and enroll instantly.',
  },
  {
    step: '03',
    title: 'Learn & Grow',
    text: 'Watch lessons at your pace, track your progress and build real skills.',
  },
];

export default async function HomePage() {
  const supabase = createServerClient();

  // Fetch courses
  const { data: courses } = await supabase
    .from('courses')
    .select('*')
    .eq('is_published', true)
    .order('created_at', { ascending: false })
    .limit(3);

  // Fetch approved testimonials from database
  const { data: dbTestimonials } = await supabase
    .from('testimonials')
    .select('*')
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(3);

  // ✅ Use database testimonials if available, otherwise fallback to static ones
  const testimonials = dbTestimonials && dbTestimonials.length > 0
    ? dbTestimonials
    : fallbackTestimonials;

  return (
    <main className="overflow-x-hidden">
      <Navbar />

      {/* ── HERO ── */}
      <section className="relative bg-brand-blue text-white overflow-hidden">
        <div className="pointer-events-none absolute -top-24 -right-24 h-96 w-96 rounded-full bg-white/5" />
        <div className="pointer-events-none absolute bottom-0 left-0 h-64 w-64 rounded-full bg-brand-yellow/10" />

        <div className="relative mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:items-center lg:px-8 lg:py-32">
          <div>
            <span className="inline-block rounded-full bg-brand-yellow/20 px-4 py-1 text-xs font-bold uppercase tracking-widest text-brand-yellow">
              Where Champions Are Made
            </span>
            <h1 className="mt-6 text-4xl font-extrabold leading-tight sm:text-5xl lg:text-6xl">
              Skills, Success &{' '}
              <span className="text-brand-yellow">Academic Excellence</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-blue-100">
              Nigeria's learning platform for exam prep, tech skills, business, career development and personal growth — all in one place.
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <a
                href="/register"
                className="rounded-full bg-brand-yellow px-8 py-4 text-sm font-bold text-brand-dark shadow-lg transition hover:opacity-90 hover:scale-105"
              >
                Start Learning Free
              </a>
              <a
                href="#courses"
                className="rounded-full border border-white/30 px-8 py-4 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Browse Courses
              </a>
            </div>
        
          <div className="grid grid-cols-2 gap-4">
            {stats.map((s) => (
              <div
                key={s.label}
                className="rounded-2xl bg-white/10 p-6 text-center backdrop-blur border border-white/10"
              >
                <p className="text-3xl font-extrabold text-brand-yellow">{s.number}</p>
                <p className="mt-1 text-sm font-semibold text-blue-100">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CATEGORIES ── */}
      <section className="bg-slate-50 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="text-sm font-bold uppercase tracking-widest text-brand-yellow">
              What We Teach
            </p>
            <h2 className="mt-3 text-3xl font-extrabold text-brand-blue sm:text-4xl">
              One Platform. Every Skill You Need.
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-slate-500">
              From JAMB prep to tech skills, business and personal development — Shiney Brain Academy covers your full journey.
            </p>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((cat) => (
              <a
                key={cat.title}
                href="/courses"
                className={`group rounded-2xl border p-6 transition hover:shadow-md hover:-translate-y-1 ${cat.color}`}
              >
                <span className="text-4xl">{cat.emoji}</span>
                <h3 className={`mt-4 text-lg font-bold ${cat.accent}`}>{cat.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{cat.desc}</p>
                <p className={`mt-4 text-xs font-bold ${cat.accent} group-hover:underline`}>
                  Explore →
                </p>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURED COURSES ── */}
      <section id="courses" className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-widest text-brand-yellow">
                Featured Courses
              </p>
              <h2 className="mt-3 text-3xl font-extrabold text-brand-blue">
                Start with our top courses
              </h2>
            </div>
            <a
              href="/courses"
              className="text-sm font-bold text-brand-blue underline underline-offset-4 hover:text-brand-yellow transition"
            >
              View all courses →
            </a>
          </div>
          <div className="mt-12 grid gap-8 md:grid-cols-2 xl:grid-cols-3">
            {(courses || []).length ? (
              courses.map((course) => <CourseCard key={course.id} course={course} />)
            ) : (
              <div className="col-span-3 rounded-3xl border border-dashed border-slate-200 p-16 text-center text-slate-400">
                <p className="text-5xl">📚</p>
                <p className="mt-4 font-semibold">Courses launching soon!</p>
                <p className="mt-2 text-sm">Register now to be the first to know when we go live.</p>
                <a
                  href="/register"
                  className="mt-6 inline-block rounded-full bg-brand-blue px-6 py-3 text-sm font-bold text-white hover:opacity-90"
                >
                  Register Free
                </a>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="bg-brand-blue py-20 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="text-sm font-bold uppercase tracking-widest text-brand-yellow">
              How It Works
            </p>
            <h2 className="mt-3 text-3xl font-extrabold sm:text-4xl">
              3 Simple Steps to Start Learning
            </h2>
          </div>
          <div className="mt-12 grid gap-8 lg:grid-cols-3">
            {howItWorks.map((item) => (
              <div
                key={item.step}
                className="rounded-2xl bg-white/10 p-8 backdrop-blur border border-white/10 text-center"
              >
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-brand-yellow text-brand-dark font-extrabold text-lg">
                  {item.step}
                </span>
                <h3 className="mt-5 text-xl font-bold">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-blue-100">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── WHY SHINEY BRAIN ── */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="text-sm font-bold uppercase tracking-widest text-brand-yellow">
                Why Choose Us
              </p>
              <h2 className="mt-3 text-3xl font-extrabold text-brand-blue sm:text-4xl">
                More than lessons — a complete learning experience
              </h2>
              <div className="mt-8 space-y-5">
                {[
                  { icon: '🎯', title: 'Structured Learning Paths', text: 'Every course is organized step-by-step so you never feel lost.' },
                  { icon: '📱', title: 'Learn on Any Device', text: 'Study on your phone, tablet or laptop — anytime, anywhere.' },
                  { icon: '🏆', title: 'Expert Instructors', text: 'Learn from tutors who actually practice what they teach.' },
                  { icon: '💰', title: 'Affordable Pricing', text: 'World-class training at prices built for Nigerian students.' },
                ].map((item) => (
                  <div key={item.title} className="flex gap-4 rounded-2xl bg-slate-50 p-5">
                    <span className="text-2xl">{item.icon}</span>
                    <div>
                      <h4 className="font-bold text-brand-blue">{item.title}</h4>
                      <p className="mt-1 text-sm text-slate-500">{item.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-3xl bg-brand-blue p-10 text-white text-center">
              <p className="text-6xl font-extrabold text-brand-yellow">5,000+</p>
              <p className="mt-2 text-xl font-semibold">Students Already Learning</p>
              <p className="mt-4 text-blue-200 text-sm">Join thousands of Nigerian students building skills and achieving their goals on Shiney Brain Academy.</p>
              <a
                href="/register"
                className="mt-8 inline-block rounded-full bg-brand-yellow px-8 py-4 text-sm font-bold text-brand-dark hover:opacity-90 transition"
              >
                Join Them Today →
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section className="bg-slate-50 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="text-sm font-bold uppercase tracking-widest text-brand-yellow">
              Student Reviews
            </p>
            <h2 className="mt-3 text-3xl font-extrabold text-brand-blue">
              Students love Shiney Brain Academy
            </h2>
          </div>
          <div className="mt-12 grid gap-8 lg:grid-cols-3">
            {testimonials.map((item) => (
              <blockquote
                key={item.id}
                className="rounded-2xl bg-white border border-slate-100 p-8 shadow-sm"
              >
                <p className="text-sm">{'⭐'.repeat(item.rating || 5)}</p>
                <p className="mt-4 text-lg font-semibold leading-8 text-slate-700">
                  "{item.testimonial}"
                </p>
                <footer className="mt-6">
                  <p className="font-bold text-brand-blue">{item.name}</p>
                  {item.course && (
                    <p className="text-xs text-slate-400">{item.course}</p>
                  )}
                  {item.is_verified && (
                    <span className="inline-block mt-1 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">
                      ✅ Verified
                    </span>
                  )}
                </footer>
              </blockquote>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA BANNER ── */}
      <section className="bg-brand-yellow py-16">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-3xl font-extrabold text-brand-dark sm:text-4xl">
            Ready to start your learning journey?
          </h2>
          <p className="mt-4 text-brand-dark/70">
            Join 5,000+ students already building skills and achieving success on Shiney Brain Academy.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <a
              href="/register"
              className="rounded-full bg-brand-blue px-8 py-4 text-sm font-bold text-white shadow hover:opacity-90 transition"
            >
              Create Free Account
            </a>
            <a
              href="/courses"
              className="rounded-full border-2 border-brand-dark/20 px-8 py-4 text-sm font-bold text-brand-dark hover:bg-brand-dark/10 transition"
            >
              Browse Courses
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}