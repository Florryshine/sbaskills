import Link from 'next/link';
import AdminCourseManager from '@/components/AdminCourseManager';
import { requireAdmin } from '@/lib/auth';

export default async function AdminCoursesPage() {
  const { supabase } = await requireAdmin();
  const { data: courses } = await supabase
    .from('courses')
    .select('*, lessons(count)')
    .order('created_at', { ascending: false });

  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] bg-white p-6 shadow-soft sm:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand-yellow">Admin Courses</p>
            <h1 className="mt-3 text-3xl font-bold text-brand-blue">Manage all courses</h1>
          </div>
          <Link href="/admin/courses/new" className="rounded-full bg-brand-yellow px-6 py-3 text-sm font-bold text-brand-dark">
            Create New Course
          </Link>
        </div>
      </section>
      <AdminCourseManager initialCourses={courses || []} />
    </div>
  );
}
