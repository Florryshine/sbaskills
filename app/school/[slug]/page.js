import { createServerClient } from '@/lib/supabase-server';
import { notFound } from 'next/navigation';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

async function getSchool(slug) {
  const supabase = createServerClient();
  const { data } = await supabase
    .from('schools')
    .select('id, slug, name, logo_url, about, contact_phone, contact_email, address, is_published')
    .eq('slug', slug)
    .eq('is_published', true)
    .maybeSingle();
  return data;
}

async function getStudentCount(schoolId) {
  const supabase = createServerClient();
  const { count } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('school_id', schoolId)
    .eq('role', 'student');
  return count || 0;
}

export async function generateMetadata({ params }) {
  const school = await getSchool(params.slug);
  if (!school) return { title: 'School Not Found | Shiney Brain Academy' };
  return {
    title: `${school.name} | Powered by Shiney Brain Academy`,
    description: school.about || `${school.name}'s official page on Shiney Brain Academy.`,
  };
}

export default async function SchoolPage({ params }) {
  const school = await getSchool(params.slug);
  if (!school) notFound();

  const studentCount = await getStudentCount(school.id);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-brand-blue text-white">
        <div className="max-w-5xl mx-auto px-4 py-10 flex items-center gap-5">
          <div className="h-16 w-16 shrink-0 rounded-2xl bg-white flex items-center justify-center overflow-hidden">
            {school.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={school.logo_url} alt={`${school.name} logo`} className="h-full w-full object-cover" />
            ) : (
              <span className="text-2xl font-extrabold text-brand-blue">
                {school.name[0]}
              </span>
            )}
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-brand-yellow">
              Official School Page
            </p>
            <h1 className="text-3xl font-extrabold">{school.name}</h1>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-10 space-y-10">
        {/* About */}
        <section className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100">
          <h2 className="text-lg font-extrabold text-brand-blue mb-2">About {school.name}</h2>
          <p className="text-slate-600 leading-relaxed">
            {school.about || 'This school is on Shiney Brain Academy — helping students prepare for WAEC, JAMB, and NECO with quizzes, an AI tutor, and performance tracking.'}
          </p>
        </section>

        {/* Stats strip */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100 text-center">
            <p className="text-3xl font-extrabold text-brand-blue">{studentCount}</p>
            <p className="text-sm text-slate-500 mt-1">Students on Shiney Brain</p>
          </div>
          <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100 text-center">
            <p className="text-3xl font-extrabold text-brand-blue">WAEC / JAMB / NECO</p>
            <p className="text-sm text-slate-500 mt-1">Exam prep covered</p>
          </div>
          <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100 text-center">
            <p className="text-3xl font-extrabold text-brand-blue">24/7</p>
            <p className="text-sm text-slate-500 mt-1">AI Tutor access</p>
          </div>
        </section>

        {/* What students get */}
        <section className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100">
          <h2 className="text-lg font-extrabold text-brand-blue mb-4">
            What {school.name} students get, free
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              ['📝', 'Quizzes & Boss Battles', 'Practice by subject, gamified for real engagement.'],
              ['🎓', 'AI Tutor', 'Ask questions anytime, get explained answers instantly.'],
              ['📇', 'Flashcards', 'Quick revision for key topics before exams.'],
              ['📊', 'Past Questions', 'Real WAEC/JAMB/NECO past questions with practice mode.'],
            ].map(([icon, title, desc]) => (
              <div key={title} className="flex gap-3 rounded-xl border border-slate-100 p-4">
                <span className="text-2xl">{icon}</span>
                <div>
                  <p className="font-bold text-brand-dark">{title}</p>
                  <p className="text-sm text-slate-500">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Contact */}
        <section className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100">
          <h2 className="text-lg font-extrabold text-brand-blue mb-3">Contact {school.name}</h2>
          <div className="text-sm text-slate-600 space-y-1">
            {school.contact_phone && <p>📞 {school.contact_phone}</p>}
            {school.contact_email && <p>✉️ {school.contact_email}</p>}
            {school.address && <p>📍 {school.address}</p>}
            {!school.contact_phone && !school.contact_email && !school.address && (
              <p className="text-slate-400">Contact details coming soon.</p>
            )}
          </div>
        </section>

        {/* Footer CTA */}
        <section className="text-center py-6">
          <p className="text-sm text-slate-500">
            Powered by{' '}
            <Link href="/" className="font-bold text-brand-blue hover:underline">
              Shiney Brain Academy
            </Link>
          </p>
        </section>
      </main>
    </div>
  );
}
