import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import VideoPlayer from '@/components/VideoPlayer';
import MarkCompleteButton from '@/components/MarkCompleteButton';
import { requireStudent } from '@/lib/auth';

export default async function LessonPlayerPage({ params }) {
  const { user, profile, supabase } = await requireStudent();

  const [{ data: lesson }, { data: course }, { data: enrollment }, { data: allLessons }, { data: progress }] = await Promise.all([
    supabase.from('lessons').select('*').eq('id', params.lessonId).single(),
    supabase.from('courses').select('*').eq('id', params.id).single(),
    supabase.from('enrollments').select('id').eq('student_id', user.id).eq('course_id', params.id).maybeSingle(),
    supabase.from('lessons').select('*').eq('course_id', params.id).eq('is_published', true).order('order_index', { ascending: true }),
    supabase.from('lesson_progress').select('*').eq('student_id', user.id).eq('lesson_id', params.lessonId).maybeSingle()
  ]);

  if (!lesson || !course) {
    notFound();
  }

  const isAdmin = profile?.role === 'admin';

  if (!enrollment && !isAdmin) {
    redirect(`/courses/${params.id}`);
  }

  if (!lesson.is_published && !isAdmin) {
    notFound();
  }

  const lessonIndex = (allLessons || []).findIndex((item) => item.id === lesson.id);
  const previousLesson = lessonIndex > 0 ? allLessons[lessonIndex - 1] : null;
  const nextLesson = lessonIndex >= 0 ? allLessons[lessonIndex + 1] : null;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-[2rem] bg-white p-6 shadow-soft">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand-yellow">Lesson Player</p>
            <h1 className="mt-2 text-3xl font-bold text-brand-blue">{lesson.title}</h1>
            <p className="mt-2 text-sm text-slate-600">{course.title}</p>
          </div>
          <Link href={`/courses/${course.id}`} className="rounded-full border border-brand-blue px-5 py-3 text-sm font-bold text-brand-blue">
            Back to Course
          </Link>
        </div>

        <VideoPlayer src={lesson.video_url} title={lesson.title} />

        <section className="rounded-[2rem] bg-white p-6 shadow-soft">
          <h2 className="text-2xl font-bold text-brand-blue">Lesson Description</h2>
          <p className="mt-4 text-sm leading-7 text-slate-600">{lesson.description}</p>
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <MarkCompleteButton lessonId={lesson.id} studentId={user.id} completed={Boolean(progress?.completed)} />
            {lesson.duration ? <span className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">{lesson.duration}</span> : null}
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded-[2rem] bg-white p-6 shadow-soft">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">Previous Lesson</p>
            {previousLesson ? (
              <Link href={`/courses/${course.id}/lessons/${previousLesson.id}`} className="mt-3 inline-block text-lg font-bold text-brand-blue underline underline-offset-4">
                {previousLesson.title}
              </Link>
            ) : (
              <p className="mt-3 text-sm text-slate-500">This is the first lesson.</p>
            )}
          </div>
          <div className="rounded-[2rem] bg-white p-6 shadow-soft">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">Next Lesson</p>
            {nextLesson ? (
              <Link href={`/courses/${course.id}/lessons/${nextLesson.id}`} className="mt-3 inline-block text-lg font-bold text-brand-blue underline underline-offset-4">
                {nextLesson.title}
              </Link>
            ) : (
              <p className="mt-3 text-sm text-slate-500">You have reached the final lesson.</p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
