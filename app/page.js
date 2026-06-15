import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import CourseCard from '@/components/CourseCard';
import { createServerClient } from '@/lib/supabase-server';

const stats = [
  { number: '5,000+', label: 'Students' },
  { number: '20+', label: 'Courses' },
  { number: '6', label: 'Skill Categories' },
  { number: '100%', label: 'Flexible Learning' },
];

const categories = [
  {
    emoji: '🎓',
    title: 'JAMB & Post-UTME',
    desc: 'Structured exam prep to help you score high and gain admission.',
    color: 'bg-blue-50/50 border-blue-100',
    accent: 'text-brand-blue',
  },
  {
    emoji: '💻',
    title: 'Tech Skills',
    desc: 'Coding, web dev, app development, data analysis and more.',
    color: 'bg-white border-slate-200',
    accent: 'text-slate-800',
  },
  {
    emoji: '🎨',
    title: 'Graphics & Video Editing',
    desc: 'Design, UI/UX, content creation and digital creative skills.',
    color: 'bg-yellow-50/30 border-brand-yellow/30',
    accent: 'text-slate-800',
  },
  {
    emoji: '💼',
    title: 'Business & Freelancing',
    desc: 'Sales, e-commerce, personal branding and entrepreneurship.',
    color: 'bg-white border-slate-200',
    accent: 'text-slate-800',
  },
  {
    emoji: '🚀',
    title: 'Career Development',
    desc: 'CV writing, interview prep, LinkedIn and remote job skills.',
    color: 'bg-blue-50/20 border-blue-100/50',
    accent: 'text-brand-blue',
  },
  {
    emoji: '🧠',
    title: 'Personal Growth',
    desc: 'Leadership, confidence, financial literacy and productivity.',
    color: 'bg-white border-slate-200',
    accent: 'text-slate-800',
  },
];

const testimonials = [
  {
    name: 'Amaka O.',
    role: 'JAMB Student',
    quote: 'The lesson flow kept me disciplined. I finally studied with clarity and confidence.',
    score: '⭐⭐⭐⭐⭐',
  },
  {
    name: 'David E.',
    role: 'Tech Skills Student',
    quote: 'I loved the structure. Seeing my progress motivated me to finish each topic.',
    score: '⭐⭐⭐⭐⭐',
  },
  {
    name: 'Ruth A.',
    role: 'Digital Marketing Student',
    quote: 'The platform felt premium and easy to use on my phone, which mattered a lot.',
    score: '⭐⭐⭐⭐⭐',
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
  const { data: courses } = await supabase
    .from('courses')
    .select('*')
    .eq('is_published', true)
    .order('created_at', { ascending: false })
    .limit(3);

  return (
    <main className="overflow-x-hidden bg-white">
      <Navbar />

      {/* ── PREMIUM HERO BANNER ── */}
      <section className="relative bg-brand-blue text-white overflow-hidden pt-12 pb-20 lg:pt-28 lg:pb-32">
        {/* Abstract structural graphics */}
        <div className="pointer-events-none absolute -top-24 -right-24 h-96 w-96 rounded-full bg-white/5 blur-xl" />
        <div className="pointer-events-none absolute bottom-0 left-0 h-64 w-64 rounded-full bg-brand-yellow/5 blur-lg" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 grid gap-12 lg:grid-cols-12 lg:items-center">
          
          {/* Main Copy Area */}
          <div className="lg:col-span-7 text-center lg:text-left space-y-6">
            <span className="inline-flex items-center rounded-full bg-brand-yellow/10 px-4 py-1.5 text-xs font-black uppercase tracking-widest text-brand-yellow border border-brand-yellow/20">
              ⚡ Where Champions Are Made
            </span>
            
            <h1 className="text-3xl font-black tracking-tight sm:text-5xl lg:text-6xl text-white leading-tight">
              Skills, Success & <br className="hidden sm:inline" />
              <span className="text-brand-yellow bg-gradient-to-r from-brand-yellow to-yellow-300 bg-clip-text">
                Academic Excellence
              </span>
            </h1>
            
            <p className="mx-auto lg:mx-0 max-w-xl text-base sm:text-lg leading-relaxed text-blue-100/90 font-medium">
              Nigeria's premium ecosystem for exam prep, high-demand tech skills, digital business growth, and elite career acceleration.
            </p>
            
            {/* Call To Actions */}
            <div className="pt-4 flex flex-col sm:flex-row justify-center lg:justify-start items-center gap-4">
              <a
                href="/register"
                className="w-full sm:w-auto text-center rounded-xl bg-brand-yellow px-8 py-4 text-sm font-black text-brand-dark shadow-md transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
              >
                Start Learning Free
              </a>
              <a
                href="#courses"
                className="w-full sm:w-auto text-center rounded-xl border border-white/20 bg-white/5 px-8 py-4 text-sm font-bold text-white backdrop-blur-sm transition-all hover:bg-white/10"
              >
                Browse Courses
              </a>
            </div>
            
            {/* Quick Support Contacts Tag */}
            <div className="pt-2 flex justify-center lg:justify-start items-center gap-2 text-xs font-bold text-blue-200/90 tracking-wide">
              <span>📞 Support Helplines:</span>
              <a href="tel:08138082009" className="hover:text-brand-yellow underline">08138082009</a>
              <span>·</span>
              <a href="tel:09053626207" className="hover:text-brand-yellow underline">09053626207</a>
            </div>
          </div>

          {/* Premium Interactive Logo Graphic Visual */}
          <div className="lg:col-span-5 flex flex-col items-center justify-center relative mt-6 lg:mt-0">
            <div className="relative w-72 h-72 sm:w-80 sm:h-80 flex items-center justify-center rounded-full bg-gradient-to-b from-white/10 to-transparent p-8 border border-white/5 shadow-2xl backdrop-blur-sm">
              {/* Radiating Glowing Light Effect Background */}
              <div className="absolute inset-0 rounded-full bg-brand-yellow/10 animate-pulse blur-xl" />
              
              {/* Iconic Shiney Brain Academy Graphic Illustration Concept */}
              <svg className="w-48 h-48 text-brand-yellow opacity-90 drop-shadow-[0_0_20px_rgba(255,204,0,0.4)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                {/* Custom Brain Line Patterns inside map structure visual */}
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              
              {/* Floating Graduation Cap Icon Component Overlaid */}
              <div className="absolute -top-2 bg-brand-dark p-3.5 rounded-2xl border border-white/10 shadow-lg transform -rotate-12">
                <span className="text-3xl">🎓</span>
              </div>
            </div>

            {/* Mobile Metric Grid Overlays */}
            <div className="grid grid-cols-2 gap-3 w-full max-w-md mt-8">
              {stats.slice(0, 2).map((s) => (
                <div key={s.label} className="rounded-xl bg-white/5 p-4 text-center border border-white/10 backdrop-blur-sm">
                  <p className="text-2xl font-black text-brand-yellow">{s.number}</p>
                  <p className="text-[0.75rem] font-bold tracking-wide uppercase text-blue-200 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

        </div>
      </section>

      {/* ── PREMIUM CATEGORIES ── */}
      <section className="bg-slate-50/60 py-20 border-b border-slate-100">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-3">
            <p className="text-xs font-black uppercase tracking-widest text-brand-blue">
              What We Teach
            </p>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-brand-blue tracking-tight">
              One Platform. Every Skill You Need.
            </h2>
            <p className="mx-auto max-w-2xl text-sm sm:text-base text-slate-500 font-medium">
              From high-scoring JAMB tracks to technical blueprints and international freelancing frameworks.
            </p>
          </div>
          
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((cat) => (
              <a
                key={cat.title}
                href="/courses"
                className={`group rounded-2xl border p-6 bg-white transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${cat.color}`}
              >
                <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                  {cat.emoji}
                </div>
                <h3 className="mt-4 text-base font-black text-slate-900">{cat.title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-500 font-medium">{cat.desc}</p>
                <p className="mt-4 text-xs font-bold text-brand-blue group-hover:text-brand-yellow transition-colors flex items-center gap-1">
                  Explore Track <span className="transform group-hover:translate-x-1 transition-transform">→</span>
                </p>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURED COURSES SECTION ── */}
      <section id="courses" className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between border-b border-slate-100 pb-6">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-brand-blue">
                Premium Tracks Available
              </p>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-brand-blue tracking-tight">
                Start with our top masterclasses
              </h2>
            </div>
            <a
              href="/courses"
              className="text-xs font-black text-brand-blue uppercase tracking-wider hover:text-brand-yellow transition flex items-center gap-1"
            >
              View all courses <span className="text-sm">→</span>
            </a>
          </div>
          
          <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {(courses || []).length ? (
              courses.map((course) => <CourseCard key={course.id} course={course} />)
            ) : (
              <div className="col-span-3 rounded-2xl border border-dashed border-slate-200 p-12 text-center text-slate-400 bg-slate-50/50">
                <p className="text-4xl">📚</p>
                <p className="mt-4 font-bold text-slate-700">Premium Packages Launching Live!</p>
                <p className="mt-1 text-xs text-slate-500">Secure your free profile registration now to grab exclusive introductory updates.</p>
                <a
                  href="/register"
                  className="mt-6 inline-block rounded-xl bg-brand-blue px-6 py-3 text-xs font-bold text-white hover:opacity-90 transition shadow-sm"
                >
                  Register Account Free
                </a>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="bg-brand-blue py-20 text-white relative overflow-hidden">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative">
          <div className="text-center space-y-2">
            <p className="text-xs font-black uppercase tracking-widest text-brand-yellow">
              How It Works
            </p>
            <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
              3 Simple Steps to Start Learning
            </h2>
          </div>
          
          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {howItWorks.map((item) => (
              <div
                key={item.step}
                className="rounded-2xl bg-white/5 p-6 backdrop-blur-sm border border-white/10 text-center flex flex-col items-center"
              >
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand-yellow text-brand-dark font-black text-sm shadow-sm">
                  {item.step}
                </span>
                <h3 className="mt-4 text-lg font-bold">{item.title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-blue-100/80 font-medium">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── WHY SHINEY BRAIN ── */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-12 lg:items-center">
            <div className="lg:col-span-7 space-y-3">
              <p className="text-xs font-black uppercase tracking-widest text-brand-blue">
                Why Choose Us
              </p>
              <h2 className="text-2xl sm:text-4xl font-extrabold text-brand-blue tracking-tight">
                More than lessons — a complete learning experience
              </h2>
              
              <div className="mt-8 space-y-4 pt-4">
                {[
                  { icon: '🎯', title: 'Structured Learning Paths', text: 'Every course is organized step-by-step so you never feel confused.' },
                  { icon: '📱', title: 'Optimized Mobile Classrooms', text: 'Study smoothly straight from your smartphone layout — anytime, anywhere.' },
                  { icon: '🏆', title: 'Vetted Industry Mentors', text: 'Gain inside techniques from verified mentors who practice what they teach.' },
                  { icon: '💰', title: 'Accessible Investment Plans', text: 'Premium high-value training structured affordably for Nigerian scholars.' },
                ].map((item) => (
                  <div key={item.title} className="flex gap-4 rounded-xl bg-slate-50 p-4 border border-slate-100">
                    <span className="text-xl shrink-0">{item.icon}</span>
                    <div>
                      <h4 className="font-bold text-sm text-brand-blue">{item.title}</h4>
                      <p className="mt-0.5 text-xs text-slate-500 font-medium">{item.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="lg:col-span-5 rounded-2xl bg-brand-blue p-8 sm:p-10 text-white text-center flex flex-col items-center justify-center border border-white/5 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-xl pointer-events-none" />
              <p className="text-5xl font-black text-brand-yellow tracking-tight">5,000+</p>
              <p className="mt-2 text-lg font-bold">Students Already Registered</p>
              <p className="mt-3 text-blue-200/90 text-xs leading-relaxed font-medium">
                Join thousands of driven students leveling up their competence and building standard career breakthroughs inside Shiney Brain Academy.
              </p>
              <a
                href="/register"
                className="mt-6 w-full text-center inline-block rounded-xl bg-brand-yellow px-6 py-3.5 text-xs font-black text-brand-dark transition hover:opacity-95 shadow-md"
              >
                Join the Ecosystem Today →
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section className="bg-slate-50/50 py-20 border-t border-b border-slate-100">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-2">
            <p className="text-xs font-black uppercase tracking-widest text-brand-blue">
              Student Reviews
            </p>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-brand-blue tracking-tight">
              Scholars Love Shiney Brain Academy
            </h2>
          </div>
          
          <div className="mt-10 grid gap-6 lg:grid-cols-3">
            {testimonials.map((item) => (
              <blockquote
                key={item.name}
                className="rounded-xl bg-white border border-slate-200/60 p-6 shadow-sm flex flex-col justify-between"
              >
                <div>
                  <p className="text-[0.7rem] tracking-wider">{item.score}</p>
                  <p className="mt-3 text-xs sm:text-sm font-medium leading-relaxed text-slate-600 italic">
                    "{item.quote}"
                  </p>
                </div>
                <footer className="mt-6 pt-4 border-t border-slate-50">
                  <p className="font-black text-xs text-brand-blue">{item.name}</p>
                  <p className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-wide mt-0.5">{item.role}</p>
                </footer>
              </blockquote>
            ))}
          </div>
        </div>
      </section>

      {/* ── FULL WIDTH CTA ACCELERATOR ── */}
      <section className="bg-brand-yellow py-16 relative overflow-hidden">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8 relative space-y-4">
          <h2 className="text-2xl sm:text-4xl font-black text-brand-dark tracking-tight">
            Ready to jumpstart your premium track?
          </h2>
          <p className="mx-auto max-w-xl text-xs sm:text-sm font-bold text-brand-dark/70 leading-relaxed">
            Create your account under a minute and access elite educational frameworks designed exclusively for your success.
          </p>
          <div className="pt-4 flex flex-col sm:flex-row justify-center items-center gap-3">
            <a
              href="/register"
              className="w-full sm:w-auto text-center rounded-xl bg-brand-blue px-8 py-4 text-xs font-black text-white shadow-md hover:opacity-90 transition"
            >
              Create Free Account
            </a>
            <a
              href="/courses"
              className="w-full sm:w-auto text-center rounded-xl border border-brand-dark/20 px-8 py-4 text-xs font-black text-brand-dark hover:bg-brand-dark/5 transition"
            >
              Browse Packages
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
