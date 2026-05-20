import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export const metadata = {
  title: 'About Us | Shiney Brain Academy',
  description: 'Learn about Shiney Brain Academy - Nigeria\'s learning platform for skills, success and academic excellence',
};

const team = [
  {
    name: 'Florry',
    role: 'Founder & Lead Instructor',
    bio: 'Passionate educator dedicated to helping Nigerian students achieve academic excellence and build real-world skills.',
    emoji: '👨‍🏫',
  },
  {
    name: 'Peace',
    role: 'Literature & English Tutor',
    bio: 'Expert in Literature and English Language with a proven track record of helping students excel in JAMB and WAEC.',
    emoji: '📖',
  },
];

const values = [
  {
    emoji: '🎯',
    title: 'Excellence',
    text: 'We hold ourselves and our students to the highest standards in everything we do.',
  },
  {
    emoji: '❤️',
    title: 'Student First',
    text: 'Every decision we make is focused on what is best for our students and their futures.',
  },
  {
    emoji: '💡',
    title: 'Innovation',
    text: 'We constantly improve our teaching methods and platform to give students the best experience.',
  },
  {
    emoji: '🤝',
    title: 'Community',
    text: 'We believe learning is better together. Our students support and inspire each other.',
  },
  {
    emoji: '💰',
    title: 'Affordability',
    text: 'World-class education should be accessible to every Nigerian student regardless of background.',
  },
  {
    emoji: '🏆',
    title: 'Results',
    text: 'We are not just about lessons — we are about real results, real scores and real success.',
  },
];

const milestones = [
  { year: '2022', text: 'Shiney Brain Academy founded with a vision to transform Nigerian education.' },
  { year: '2023', text: 'Launched JAMB bootcamps serving hundreds of students across Nigeria.' },
  { year: '2024', text: 'Expanded to WhatsApp and Telegram communities with thousands of students.' },
  { year: '2025', text: 'Launched online platform with tech skills, business and career courses.' },
];

export default function AboutPage() {
  return (
    <main>
      <Navbar />

      {/* Hero */}
      <section className="relative bg-brand-blue text-white overflow-hidden py-20">
        <div className="pointer-events-none absolute -top-24 -right-24 h-96 w-96 rounded-full bg-white/5" />
        <div className="pointer-events-none absolute bottom-0 left-0 h-64 w-64 rounded-full bg-brand-yellow/10" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-sm font-bold uppercase tracking-widest text-brand-yellow">
              Our Story
            </p>
            <h1 className="mt-3 text-4xl font-extrabold sm:text-5xl lg:text-6xl">
              We Exist to Help Nigerian Students Win
            </h1>
            <p className="mt-6 text-lg leading-8 text-blue-200">
              Shiney Brain Academy was built with one mission — to give every Nigerian student access to world-class education, real skills, and the confidence to achieve their dreams.
            </p>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-white py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
            {[
              { number: '5,000+', label: 'Students Trained' },
              { number: '20+', label: 'Courses Available' },
              { number: '6', label: 'Skill Categories' },
              { number: '3+', label: 'Years of Excellence' },
            ].map((stat) => (
              <div key={stat.label} className="rounded-2xl bg-slate-50 p-6 text-center border border-slate-100">
                <p className="text-3xl font-extrabold text-brand-blue">{stat.number}</p>
                <p className="mt-1 text-sm font-semibold text-slate-500">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Mission & Vision */}
      <section className="bg-slate-50 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-2">
            <div className="rounded-2xl bg-brand-blue p-10 text-white">
              <span className="text-4xl">🎯</span>
              <h2 className="mt-4 text-2xl font-extrabold">Our Mission</h2>
              <p className="mt-4 leading-8 text-blue-200">
                To provide affordable, structured, and results-driven education that empowers Nigerian students to excel academically, build valuable skills, and achieve financial independence.
              </p>
            </div>
            <div className="rounded-2xl bg-brand-yellow p-10 text-brand-dark">
              <span className="text-4xl">🔭</span>
              <h2 className="mt-4 text-2xl font-extrabold">Our Vision</h2>
              <p className="mt-4 leading-8 text-brand-dark/70">
                To become Nigeria's most trusted student platform — covering JAMB, WAEC, university, skills training, career development and beyond. A complete Student OS for every Nigerian.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Our Values */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="text-sm font-bold uppercase tracking-widest text-brand-yellow">
              What We Stand For
            </p>
            <h2 className="mt-3 text-3xl font-extrabold text-brand-blue">Our Core Values</h2>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {values.map((item) => (
              <div key={item.title} className="rounded-2xl bg-slate-50 p-6 border border-slate-100">
                <span className="text-3xl">{item.emoji}</span>
                <h3 className="mt-4 font-bold text-brand-blue text-lg">{item.title}</h3>
                <p className="mt-2 text-sm leading-7 text-slate-500">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section className="bg-slate-50 py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="text-sm font-bold uppercase tracking-widest text-brand-yellow">
              Our Journey
            </p>
            <h2 className="mt-3 text-3xl font-extrabold text-brand-blue">How We Got Here</h2>
          </div>
          <div className="mt-12 space-y-6">
            {milestones.map((item) => (
              <div key={item.year} className="flex gap-6 rounded-2xl bg-white p-6 border border-slate-100">
                <div className="flex-shrink-0">
                  <span className="inline-flex h-12 w-16 items-center justify-center rounded-full bg-brand-blue text-sm font-extrabold text-white">
                    {item.year}
                  </span>
                </div>
                <p className="text-sm leading-7 text-slate-600 self-center">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="text-sm font-bold uppercase tracking-widest text-brand-yellow">
              The People Behind It
            </p>
            <h2 className="mt-3 text-3xl font-extrabold text-brand-blue">Meet Our Team</h2>
          </div>
          <div className="mt-12 grid gap-8 sm:grid-cols-2 max-w-2xl mx-auto">
            {team.map((member) => (
              <div key={member.name} className="rounded-2xl bg-slate-50 p-8 text-center border border-slate-100">
                <span className="text-6xl">{member.emoji}</span>
                <h3 className="mt-4 text-xl font-bold text-brand-blue">{member.name}</h3>
                <p className="text-sm font-semibold text-brand-yellow">{member.role}</p>
                <p className="mt-3 text-sm leading-7 text-slate-500">{member.bio}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-brand-blue py-16 text-white text-center">
        <div className="mx-auto max-w-3xl px-4">
          <h2 className="text-3xl font-extrabold">Join the Shiney Brain Family</h2>
          <p className="mt-4 text-blue-200">
            5,000+ students are already learning and growing with us. Come be part of something great.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <a
              href="/register"
              className="rounded-full bg-brand-yellow px-8 py-4 text-sm font-bold text-brand-dark hover:opacity-90 transition"
            >
              Create Free Account
            </a>
            <a
              href="/contact"
              className="rounded-full border border-white/30 px-8 py-4 text-sm font-bold text-white hover:bg-white/10 transition"
            >
              Contact Us
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
    }
    
