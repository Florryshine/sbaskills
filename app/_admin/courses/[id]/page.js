import Link from 'next/link';
import { notFound } from 'next/navigation';
import AdminCourseEditor from '@/components/AdminCourseEditor';
import { requireAdmin } from '@/lib/auth';

export default async function AdminCourseEditorPage({ params }) {
  await requireAdmin();

  if (params.id === 'new') {
    return (
      <div className="space-y-8">
        <div className="rounded-[2rem] bg-white p-6 shadow-soft">
          <Link href="/admin/courses" className="text-sm font-bold text-brand-blue underline underline-offset-4">
            Back to Courses
          </Link>
        </div>
        <AdminCourseEditor course={null} initialLessons={[]} />
      </div>
    );
  }

  const { supabase } = await requireAdmin();
  const [{ data: course }, { data: lessons }] = await Promise.all([
    supabase.from('courses').select('*').eq('id', params.id).single(),
    supabase.from('lessons').select('*').eq('course_id', params.id).order('order_index', { ascending: true })
  ]);

  if (!course) {
    notFound();
  }

  return (
    <div className="space-y-8">
      <div className="rounded-[2rem] bg-white p-6 shadow-soft">
        <Link href="/admin/courses" className="text-sm font-bold text-brand-blue underline underline-offset-4">
          Back to Courses
        </Link>
      </div>
      <AdminCourseEditor course={course} initialLessons={lessons || []} />
    </div>
  );
}
