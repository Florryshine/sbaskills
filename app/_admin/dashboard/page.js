import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/utils';

export default async function AdminDashboardPage() {
  const admin = await requireAdmin();

  const [
    { count: studentCount },
    { count: courseCount },
    { count: publishedCourseCount },
    { data: enrollments },
    { data: recentStudents },
    { data: recentCourses },
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('courses').select('*', { count: 'exact', head: true }),
    supabase.from('courses').select('*', { count: 'exact', head: true }).eq('published', true),
    supabase.from('enrollments').select('amount_paid'),
    supabase.from('profiles').select('id, full_name, email, created_at').order('created_at', { ascending: false }).limit(5),
    supabase.from('courses').select('id, title, price, published, created_at').order('created_at', { ascending: false }).limit(5),
  ]);

  const totalRevenue = (enrollments || []).reduce((sum, item) => sum + Number(item.amount_paid || 0), 0);

  const stats = [
    { label: 'Total Students', value: studentCount || 0, icon: '👥', color: 'text-brand-blue', bg: 'bg-blue-50', link: '/admin/students' },
    { label: 'Total Courses', value: courseCount || 0, icon: '📚', color: 'text-purple-600', bg: 'bg-purple-50', link: '/admin/courses' },
    { label: 'Published Courses', value: publishedCourseCount || 0, icon: '✅', color: 'text-green-600', bg: 'bg-green-50', link: '/admin/courses' },
    { label: 'Total Revenue', value: formatCurrency(totalRevenue), icon: '💰', color: 'text-brand-yellow', bg: 'bg-yellow-50', link: '/admin/students' },
  ];

  return (
    <div className="space-y-6">

      {/* Header */}
      <section className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-brand-yellow">Overview</p>
            <h1 className="mt-1 text-2xl font-extrabold text-brand-blue">Admin Dashboard</h1>
            <p className="mt-1 text-sm text-slate-500">Monitor students, courses, revenue, and activity.</p>
          </div>
          <Link
            href="/admin/courses/new"
            className="hidden rounded-full bg-brand-yellow px-5 py-2.5 text-sm font-bold text-brand-dark hover:opacity-90 transition sm:block"
          >
            + New Course
          </Link>
        </div>
      </section>

      {/* Stats Grid */}
      <section className="grid gap-4 grid-cols-2 xl:grid-cols-4">
        {stats.map((item) => (
          <Link
            key={item.label}
            href={item.link}
            className="rounded-2xl bg-white p-5 shadow-sm border border-slate-100 hover:shadow-md transition group"
          >
            <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${item.bg} text-xl mb-3`}>
              {item.icon}
            </div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">{item.label}</p>
            <p className={`mt-1 text-2xl font-extrabold ${item.color}`}>{item.value}</p>
            <div className="mt-3 h-1.5 rounded-full bg-slate-100">
              <div className="h-1.5 w-1/2 rounded-full bg-brand-yellow group-hover:w-3/4 transition-all duration-500" />
            </div>
          </Link>
        ))}
      </section>

      {/* Quick Actions */}
      <section className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100">
        <h2 className="text-base font-extrabold text-brand-blue mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <Link href="/admin/courses/new" className="rounded-full bg-brand-yellow px-5 py-2.5 text-sm font-bold text-brand-dark hover:opacity-90 transition">
            ➕ Create New Course
          </Link>
          <Link href="/admin/students" className="rounded-full bg-brand-blue px-5 py-2.5 text-sm font-bold text-white hover:opacity-90 transition">
            👥 View Students
          </Link>
          <Link href="/admin/courses" className="rounded-full border-2 border-brand-blue px-5 py-2.5 text-sm font-bold text-brand-blue hover:bg-brand-blue hover:text-white transition">
            📚 Manage Courses
          </Link>
          <Link href="/" className="rounded-full border-2 border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-600 hover:border-slate-400 transition">
            🌐 View Website
          </Link>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">

        {/* Recent Students */}
        <section className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-extrabold text-brand-blue">Recent Students</h2>
            <Link href="/admin/students" className="text-xs font-bold text-brand-yellow hover:underline">View all →</Link>
          </div>
          {recentStudents && recentStudents.length > 0 ? (
            <ul className="space-y-3">
              {recentStudents.map((s) => (
                <li key={s.id} className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-blue text-white text-sm font-bold">
                    {(s.full_name || s.email || '?')[0].toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-700">{s.full_name || 'No name'}</p>
                    <p className="truncate text-xs text-slate-400">{s.email}</p>
                  </div>
                  <span className="ml-auto text-xs text-slate-400 shrink-0">
                    {new Date(s.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="rounded-xl bg-slate-50 py-8 text-center">
              <p className="text-2xl">👥</p>
              <p className="mt-2 text-sm text-slate-400">No students yet</p>
            </div>
          )}
        </section>

        {/* Recent Courses */}
        <section className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-extrabold text-brand-blue">Recent Courses</h2>
            <Link href="/admin/courses" className="text-xs font-bold text-brand-yellow hover:underline">View all →</Link>
          </div>
          {recentCourses && recentCourses.length > 0 ? (
            <ul className="space-y-3">
              {recentCourses.map((c) => (
                <li key={c.id} className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-purple-100 text-purple-600 text-lg">
                    📚
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-700">{c.title}</p>
                    <p className="text-xs text-slate-400">{c.price === 0 ? 'Free' : formatCurrency(c.price)}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${
                    c.published ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-500'
                  }`}>
                    {c.published ? 'Live' : 'Draft'}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="rounded-xl bg-slate-50 py-8 text-center">
              <p className="text-2xl">📚</p>
              <p className="mt-2 text-sm text-slate-400">No courses yet</p>
              <Link href="/admin/courses/new" className="mt-3 inline-block rounded-full bg-brand-yellow px-4 py-2 text-xs font-bold text-brand-dark">
                Create first course
              </Link>
            </div>
          )}
        </section>

      </div>
    </div>
  );
}
