import Link from 'next/link';
import { notFound } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import LessonList from '@/components/LessonList';
import EnrollButton from '@/components/EnrollButton';
import { createServerClient } from '@/lib/supabase-server';
import { formatCurrency } from '@/lib/utils';

export default async function CourseDetailsPage({ params }) {
  const supabase = createServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  const { data: course } = await supabase.from('courses').select('*').eq('id', params.id).single();

  if (!course || (!course.is_published && !user)) {
    notFound();
  }

  const { data: lessons } = await supabase
    .from('lessons')
    .select('*')
    .eq('course_id', params.id)
    .order('order_index', { ascending: true });

  let isAdmin = false;
  let isEnrolled = false;
  let completedLessonIds = [];

  if (user) {
    const [{ data: profile }, { data: enrollment }, { data: progress }] = await Promise.all([
      supabase.from('profiles').select('role').eq('id', user.id).single(),
      supabase.from('enrollments').select('id').eq('student_id', user.id).eq('course_id', params.id).maybeSingle(),
      supabase.from('lesson_progress').select('lesson_id').eq('student_id', user.id).eq('completed', true)
    ]);

    isAdmin = profile?.role === 'admin';
    isEnrolled = Boolean(enrollment) || isAdmin;
    completedLessonIds = (progress || []).map((item) => item.lesson_id);
  }

  if (!course.is_published && !isAdmin) {
    notFound();
  }

  const publishedLessons = isAdmin ? lessons || [] : (lessons || []).filter((lesson) => lesson.is_published);

  return (
    <main>
      <Navbar />
      <section className="bg-brand-blue text-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.3fr,0.9fr] lg:px-8 lg:py-20">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand-yellow">Course Overview</p>
            <h1 className="mt-4 text-4xl font-extrabold leading-tight">{course.title}</h1>
            <p className="mt-6 max-w-3xl text-base leading-8 text-blue-100">{course.description}</p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <span className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white">
                {publishedLessons.length} lessons
              </span>
              <span className="rounded-full bg-brand-yellow px-4 py-2 text-sm font-bold text-brand-dark">
                {Number(course.price) === 0 ? 'Free course' : formatCurrency(course.price)}
              </span>
            </div>
            <div className="mt-8 flex flex-wrap gap-4">
              {!isEnrolled ? (
                <EnrollButton
                  courseId={course.id}
                  courseTitle={course.title}
                  amount={course.price}
                  email={user?.email}
                  isLoggedIn={Boolean(user)}
                />
              ) : null}
              <Link href="/dashboard" className="rounded-full border border-white/30 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10">
                Back to Dashboard
              </Link>
            </div>
          </div>
          <div className="overflow-hidden rounded-[2rem] bg-white shadow-soft">
            {course.thumbnail_url ? (
              <img src={course.thumbnail_url} alt={course.title} className="aspect-video w-full object-cover" />
            ) : (
              <div className="flex aspect-video items-center justify-center bg-brand-yellow/20 text-center text-lg font-bold text-brand-blue">
                Shiney Brain Academy
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand-yellow">Lessons</p>
            <h2 className="mt-2 text-3xl font-bold text-brand-blue">Course content</h2>
          </div>
          {!isEnrolled ? (
            <p className="text-sm font-medium text-slate-600">Enroll to unlock lesson videos and lesson player access.</p>
          ) : null}
        </div>
        <LessonList
          lessons={publishedLessons}
          enrolled={isEnrolled}
          courseId={course.id}
          completedLessonIds={completedLessonIds}
        />
      </section>
      <Footer />
    </main>
  );
}
