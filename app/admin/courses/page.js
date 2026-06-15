import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/utils';

export default async function AdminCoursesPage() {
  await requireAdmin();

  const { data: courses } = await supabase
    .from('courses')
    .select('id, title, description, price, published, thumbnail_url, created_at')
    .order('created_at', { ascending: false });

  return (
    <div className="space-y-6">

      {/* Header */}
      <section className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-brand-yellow">Management</p>
            <h1 className="mt-1 text-2xl font-extrabold text-brand-blue">All Courses</h1>
            <p className="mt-1 text-sm text-slate-500">{courses?.length || 0} courses total</p>
          </div>
          <Link
            href="/admin/courses/new"
            className="rounded-full bg-brand-yellow px-5 py-2.5 text-sm font-bold text-brand-dark hover:opacity-90 transition"
          >
            ➕ New Course
          </Link>
        </div>
      </section>

      {/* Courses List */}
      <section className="rounded-2xl bg-white shadow-sm border border-slate-100 overflow-hidden">
        {courses && courses.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {courses.map((course) => (
              <div key={course.id} className="flex items-center gap-4 p-4 hover:bg-slate-50 transition">

                {/* Thumbnail */}
                <div className="h-14 w-20 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                  {course.thumbnail_url ? (
                    <img
                      src={course.thumbnail_url}
                      alt={course.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-brand-blue/10 text-2xl">
                      📚
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-slate-800">{course.title}</p>
                  <p className="mt-0.5 text-sm text-slate-500">
                    {course.price === 0 ? (
                      <span className="font-semibold text-green-600">Free</span>
                    ) : (
                      <span className="font-semibold text-brand-blue">{formatCurrency(course.price)}</span>
                    )}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Created {new Date(course.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>

                {/* Status badge */}
                <span className={`hidden shrink-0 rounded-full px-3 py-1 text-xs font-bold sm:block ${
                  course.published ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-500'
                }`}>
                  {course.published ? '🟢 Live' : '⚪ Draft'}
                </span>

                {/* Actions */}
                <div className="flex shrink-0 items-center gap-2">
                  <Link
                    href={`/admin/courses/${course.id}/edit`}
                    className="rounded-full border border-brand-blue px-3 py-1.5 text-xs font-bold text-brand-blue hover:bg-brand-blue hover:text-white transition"
                  >
                    Edit
                  </Link>
                  <Link
                    href={`/admin/courses/${course.id}/lessons`}
                    className="rounded-full bg-brand-yellow px-3 py-1.5 text-xs font-bold text-brand-dark hover:opacity-80 transition"
                  >
                    Lessons
                  </Link>
                </div>

              </div>
            ))}
          </div>
        ) : (
          <div className="py-16 text-center">
            <p className="text-4xl">📚</p>
            <h3 className="mt-4 text-lg font-bold text-slate-700">No courses yet</h3>
            <p className="mt-2 text-sm text-slate-400">Create your first course to get started.</p>
            <Link
              href="/admin/courses/new"
              className="mt-5 inline-block rounded-full bg-brand-yellow px-6 py-3 text-sm font-bold text-brand-dark hover:opacity-90 transition"
            >
              ➕ Create First Course
            </Link>
          </div>
        )}
      </section>

    </div>
  );
}
