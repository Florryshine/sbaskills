import Link from 'next/link';
import DashboardSidebar from '@/components/DashboardSidebar';
import CourseCard from '@/components/CourseCard';
import { requireStudent } from '@/lib/auth';
import { calculateProgress } from '@/lib/utils';

export default async function DashboardPage() {
  const { user, profile, supabase } = await requireStudent();

  const [{ data: enrolledRecords }, { data: publishedCourses }, { data: completedProgress }] = await Promise.all([
    supabase
      .from('enrollments')
      .select('course_id, enrolled_at, courses(*)')
      .eq('student_id', user.id)
      .order('enrolled_at', { ascending: false }),
    supabase.from('courses').select('*').eq('is_published', true).order('created_at', { ascending: false }),
    supabase.from('lesson_progress').select('lesson_id').eq('student_id', user.id).eq('completed', true)
  ]);

  const enrolledCourses = (enrolledRecords || []).map((item) => item.courses).filter(Boolean);
  const enrolledCourseIds = enrolledCourses.map((course) => course.id);
  const availableCourses = (publishedCourses || []).filter((course) => !enrolledCourseIds.includes(course.id));

  const progressData = await Promise.all(
    enrolledCourses.map(async (course) => {
      const { data: lessons } = await supabase.from('lessons').select('id').eq('course_id', course.id).eq('is_published', true);
      const totalLessons = lessons?.length || 0;
      const completedLessons = (lessons || []).filter((lesson) => completedProgress?.some((item) => item.lesson_id === lesson.id)).length;
      return {
        ...course,
        totalLessons,
        completedLessons,
        progress: calculateProgress(totalLessons, completedLessons)
      };
    })
  );

  return (
    <main className="min-h-screen lg:flex">
      <DashboardSidebar />
      <section className="flex-1 p-4 sm:p-6 lg:p-10">
        <div className="rounded-[2rem] bg-white p-6 shadow-soft sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand-yellow">Dashboard</p>
          <h1 className="mt-3 text-3xl font-bold text-brand-blue">Welcome, {profile?.full_name || user.email}</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">Track your courses, continue lessons, and stay focused on your JAMB goals.</p>
        </div>

        <div className="mt-8 grid gap-8 xl:grid-cols-[1.4fr,1fr]">
          <div className="space-y-8">
            <section className="rounded-[2rem] bg-white p-6 shadow-soft">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-brand-blue">My Courses</h2>
                <span className="rounded-full bg-brand-yellow/20 px-3 py-1 text-xs font-bold text-brand-dark">{progressData.length}</span>
              </div>
              <div className="mt-6 space-y-5">
                {progressData.length ? (
                  progressData.map((course) => (
                    <div key={course.id} className="rounded-3xl border border-slate-100 p-5">
                      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div>
                          <h3 className="text-xl font-bold text-brand-blue">{course.title}</h3>
                          <p className="mt-2 text-sm text-slate-600">
                            {course.completedLessons} of {course.totalLessons} lessons completed
                          </p>
                        </div>
                        <Link href={`/courses/${course.id}`} className="rounded-full bg-brand-blue px-5 py-3 text-sm font-bold text-white">
                          Continue
                        </Link>
                      </div>
                      <div className="mt-5 h-3 overflow-hidden rounded-full bg-brand-yellow/20">
                        <div className="h-full rounded-full bg-brand-yellow" style={{ width: `${course.progress}%` }} />
                      </div>
                      <p className="mt-3 text-xs font-bold uppercase tracking-[0.2em] text-slate-400">{course.progress}% complete</p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-3xl border border-dashed border-slate-200 p-8 text-center text-slate-500">
                    You have not enrolled in any course yet.
                  </div>
                )}
              </div>
            </section>

            <section>
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-2xl font-bold text-brand-blue">Available Courses</h2>
                <Link href="/" className="text-sm font-bold text-brand-blue underline underline-offset-4">
                  View Homepage
                </Link>
              </div>
              <div className="grid gap-6 md:grid-cols-2">
                {availableCourses.length ? (
                  availableCourses.map((course) => <CourseCard key={course.id} course={course} />)
                ) : (
                  <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-8 text-slate-500">
                    You are enrolled in all currently published courses.
                  </div>
                )}
              </div>
            </section>
          </div>

          <aside className="space-y-8">
            <section className="rounded-[2rem] bg-white p-6 shadow-soft">
              <h2 className="text-2xl font-bold text-brand-blue">Profile</h2>
              <dl className="mt-6 space-y-4 text-sm text-slate-600">
                <div>
                  <dt className="font-semibold text-slate-500">Full Name</dt>
                  <dd className="mt-1 font-medium text-slate-800">{profile?.full_name || 'Not set'}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-slate-500">Email</dt>
                  <dd className="mt-1 font-medium text-slate-800">{profile?.email || user.email}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-slate-500">Phone</dt>
                  <dd className="mt-1 font-medium text-slate-800">{profile?.phone || 'Not set'}</dd>
                </div>
              </dl>
            </section>

            <section className="rounded-[2rem] bg-brand-blue p-6 text-white shadow-soft">
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-100">Need help?</p>
              <h3 className="mt-3 text-2xl font-bold text-brand-yellow">Call Support</h3>
              <p className="mt-3 text-sm leading-6 text-blue-100">08138082009</p>
              <p className="text-sm leading-6 text-blue-100">09053626207</p>
            </section>
          </aside>
        </div>
      </section>
    </main>
  );
}
