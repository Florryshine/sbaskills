import { createServerClient } from '@/lib/supabase-server';
import { notFound } from 'next/navigation';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

async function getSchool(slug) {
  const supabase = createServerClient();
  const { data } = await supabase
    .from('schools')
    .select('id, slug, name, logo_url, about, contact_phone, contact_email, address, is_published, principal_name, welcome_message, admission_info')
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

async function getTeacherCount(schoolId) {
  const supabase = createServerClient();
  const { count } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('school_id', schoolId)
    .in('role', ['teacher', 'principal']);
  return count || 0;
}

async function getGallery(schoolId) {
  const supabase = createServerClient();
  const { data } = await supabase
    .from('school_gallery')
    .select('id, image_url, caption')
    .eq('school_id', schoolId)
    .order('sort_order')
    .limit(6);
  return data || [];
}

async function getAnnouncements(schoolId) {
  const supabase = createServerClient();
  const { data } = await supabase
    .from('school_announcements')
    .select('id, title, message, created_at')
    .eq('school_id', schoolId)
    .eq('is_public', true)
    .order('created_at', { ascending: false })
    .limit(4);
  return data || [];
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

  const [studentCount, teacherCount, gallery, announcements] = await Promise.all([
    getStudentCount(school.id),
    getTeacherCount(school.id),
    getGallery(school.id),
    getAnnouncements(school.id),
  ]);
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(`https://shineybrainacademy.vercel.app/school/${school.slug}`)}`;

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

        {/* Principal's welcome message */}
        {school.welcome_message && (
          <section className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100">
            <h2 className="text-lg font-extrabold text-brand-blue mb-2">
              A Word from {school.principal_name ? `the Principal, ${school.principal_name}` : 'Our Principal'}
            </h2>
            <p className="text-slate-600 leading-relaxed italic">&ldquo;{school.welcome_message}&rdquo;</p>
          </section>
        )}

        {/* Stats strip */}
        <section className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100 text-center">
            <p className="text-3xl font-extrabold text-brand-blue">{studentCount}</p>
            <p className="text-sm text-slate-500 mt-1">Students</p>
          </div>
          <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100 text-center">
            <p className="text-3xl font-extrabold text-brand-blue">{teacherCount}</p>
            <p className="text-sm text-slate-500 mt-1">Teachers</p>
          </div>
          <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100 text-center">
            <p className="text-2xl font-extrabold text-brand-blue">WAEC/JAMB/NECO</p>
            <p className="text-sm text-slate-500 mt-1">Exam prep covered</p>
          </div>
          <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100 text-center">
            <p className="text-3xl font-extrabold text-brand-blue">24/7</p>
            <p className="text-sm text-slate-500 mt-1">AI Tutor access</p>
          </div>
        </section>

        {/* Portal links */}
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link href="/login" className="rounded-2xl bg-brand-blue text-white p-6 shadow-sm hover:opacity-90 transition text-center">
            <p className="font-extrabold text-lg">Student Portal →</p>
            <p className="text-sm text-white/80 mt-1">Log in to quizzes, AI tutor, and more</p>
          </Link>
          <div className="rounded-2xl bg-white border border-dashed border-slate-200 p-6 text-center text-slate-400">
            <p className="font-bold text-lg">Parent Portal</p>
            <p className="text-sm mt-1">Coming soon</p>
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

        {/* Gallery */}
        {gallery.length > 0 && (
          <section className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100">
            <h2 className="text-lg font-extrabold text-brand-blue mb-4">Gallery</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {gallery.map((img) => (
                <div key={img.id} className="rounded-xl overflow-hidden aspect-video bg-slate-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.image_url} alt={img.caption || school.name} className="h-full w-full object-cover" />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* News & Announcements */}
        {announcements.length > 0 && (
          <section className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100">
            <h2 className="text-lg font-extrabold text-brand-blue mb-4">News &amp; Announcements</h2>
            <div className="space-y-4">
              {announcements.map((a) => (
                <div key={a.id} className="border-l-4 border-brand-yellow pl-4">
                  <p className="font-bold text-brand-dark">{a.title}</p>
                  <p className="text-sm text-slate-600">{a.message}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {new Date(a.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Admission info */}
        {school.admission_info && (
          <section className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100">
            <h2 className="text-lg font-extrabold text-brand-blue mb-2">Admissions</h2>
            <p className="text-slate-600 leading-relaxed">{school.admission_info}</p>
          </section>
        )}

        {/* QR code */}
        <section className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100 flex flex-col sm:flex-row items-center gap-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrCodeUrl} alt={`QR code for ${school.name}'s page`} className="h-32 w-32 rounded-lg border border-slate-100" />
          <div>
            <p className="font-bold text-brand-dark">Scan to visit this page</p>
            <p className="text-sm text-slate-500 mt-1">
              Print this QR code on flyers, ID cards, or the school notice board so parents and prospective students can find {school.name} instantly.
            </p>
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
