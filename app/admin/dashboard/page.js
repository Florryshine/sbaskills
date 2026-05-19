import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { formatCurrency } from '@/lib/utils';

export default async function AdminDashboardPage() {
  const { supabase } = await requireAdmin();

  const [{ count: studentCount }, { count: courseCount }, { data: enrollments }, { count: publishedCourseCount }] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'student'),
    supabase.from('courses').select('*', { count: 'exact', head: true }),
    supabase.from('enrollments').select('amount_paid'),
    supabase.from('courses').select('*', { count: 'exact', head: true }).eq('is_published', true)
  ]);

  const totalRevenue = (enrollments || []).reduce((sum, item) => sum + Number(item.amount_paid || 0), 0);

  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] bg-white p-6 shadow-soft sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand-yellow">Overview</p>
        <h1 className="mt-3 text-3xl font-bold text-brand-blue">Admin Dashboard</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">Monitor students, courses, revenue, and publishing activity from one place.</p>
      </section>

      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Total Students', value: studentCount || 0 },
          { label: 'Total Courses', value: courseCount || 0 },
          { label: 'Published Courses', value: publishedCourseCount || 0 },
          { label: 'Revenue', value: formatCurrency(totalRevenue) }
        ].map((item) => (
          <div key={item.label} className="rounded-[2rem] bg-white p-6 shadow-soft">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">{item.label}</p>
            <h2 className="mt-4 text-3xl font-extrabold text-brand-blue">{item.value}</h2>
            <div className="mt-6 h-2 rounded-full bg-brand-yellow/20">
              <div className="h-2 w-1/2 rounded-full bg-brand-yellow" />
            </div>
          </div>
        ))}
      </section>

      <section className="rounded-[2rem] bg-white p-6 shadow-soft">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-brand-blue">Quick Actions</h2>
            <p className="mt-2 text-sm text-slate-600">Jump into course management and student monitoring.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/admin/courses/new" className="rounded-full bg-brand-yellow px-5 py-3 text-sm font-bold text-brand-dark">
              Create New Course
            </Link>
            <Link href="/admin/students" className="rounded-full bg-brand-blue px-5 py-3 text-sm font-bold text-white">
              View Students
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
