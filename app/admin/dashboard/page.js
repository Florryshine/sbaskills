'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function AdminDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    studentCount: 0,
    courseCount: 0,
    publishedCourseCount: 0,
    totalRevenue: 0,
    todayRevenue: 0,
    todayEnrollments: 0,
  });
  const [recentStudents, setRecentStudents] = useState([]);
  const [recentCourses, setRecentCourses] = useState([]);
  const [recentEnrollments, setRecentEnrollments] = useState([]);
  const router = useRouter();

  useEffect(() => {
    const supabase = createBrowserClient();

    async function loadDashboard() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/admin/login');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profile?.role !== 'admin') {
        router.push('/login');
        return;
      }

      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);

      const [
        { count: studentCount },
        { count: courseCount },
        { count: publishedCourseCount },
        { data: enrollments },
        { data: todayEnrollmentsData },
        { data: recentStudentsData },
        { data: recentCoursesData },
        { data: recentEnrollmentsData },
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'student'),
        supabase.from('courses').select('*', { count: 'exact', head: true }),
        supabase.from('courses').select('*', { count: 'exact', head: true }).eq('is_published', true),
        supabase.from('enrollments').select('amount_paid'),
        supabase.from('enrollments').select('amount_paid').gte('enrolled_at', startOfToday.toISOString()),
        supabase.from('profiles').select('id, full_name, email, created_at').eq('role', 'student').order('created_at', { ascending: false }).limit(5),
        supabase.from('courses').select('id, title, price, is_published, created_at').order('created_at', { ascending: false }).limit(5),
        supabase.from('enrollments').select('id, amount_paid, enrolled_at, courses(title), profiles(full_name, email)').order('enrolled_at', { ascending: false }).limit(6),
      ]);

      const totalRevenue = (enrollments || []).reduce(
        (sum, item) => sum + Number(item.amount_paid || 0), 0
      );
      const todayRevenue = (todayEnrollmentsData || []).reduce(
        (sum, item) => sum + Number(item.amount_paid || 0), 0
      );

      setStats({
        studentCount: studentCount || 0,
        courseCount: courseCount || 0,
        publishedCourseCount: publishedCourseCount || 0,
        totalRevenue,
        todayRevenue,
        todayEnrollments: todayEnrollmentsData?.length || 0,
      });
      setRecentStudents(recentStudentsData || []);
      setRecentCourses(recentCoursesData || []);
      setRecentEnrollments(recentEnrollmentsData || []);
      setLoading(false);
    }

    loadDashboard();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-5xl mb-4">⏳</p>
          <p className="text-gray-500 font-medium">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  const unpublishedCourses = Math.max(stats.courseCount - stats.publishedCourseCount, 0);

  const statCards = [
    { label: 'Total Students', value: stats.studentCount, icon: '👨‍🎓', color: 'text-brand-blue', bg: 'bg-blue-50', link: '/admin/students' },
    { label: 'Total Courses', value: stats.courseCount, icon: '📚', color: 'text-purple-600', bg: 'bg-purple-50', link: '/admin/courses' },
    { label: 'Published Courses', value: stats.publishedCourseCount, icon: '✅', color: 'text-green-600', bg: 'bg-green-50', link: '/admin/courses' },
    { label: 'Total Revenue', value: `₦${stats.totalRevenue.toLocaleString()}`, icon: '💰', color: 'text-yellow-600', bg: 'bg-yellow-50', link: '/admin/students' },
  ];

  return (
    <div className="space-y-6">

      <section className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-brand-yellow">Overview</p>
            <h1 className="mt-1 text-2xl font-extrabold text-brand-blue">Admin Dashboard</h1>
            <p className="mt-1 text-sm text-slate-500">Your operational snapshot: students, sales, content and things that need attention.</p>
          </div>
          <Link href="/admin/courses/new"
            className="hidden rounded-full bg-brand-yellow px-5 py-2.5 text-sm font-bold text-brand-dark hover:opacity-90 transition sm:block">
            + New Course
          </Link>
        </div>
      </section>

      <section className="grid gap-4 grid-cols-2 xl:grid-cols-4">
        {statCards.map((item) => (
          <Link key={item.label} href={item.link}
            className="rounded-2xl bg-white p-5 shadow-sm border border-slate-100 hover:shadow-md transition">
            <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${item.bg} text-xl mb-3`}>
              {item.icon}
            </div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">{item.label}</p>
            <p className={`mt-1 text-2xl font-extrabold ${item.color}`}>{item.value}</p>
          </Link>
        ))}
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl bg-brand-blue p-5 text-white shadow-sm">
          <p className="text-xs font-bold uppercase tracking-widest text-blue-100">Today</p>
          <div className="mt-2 flex items-end justify-between gap-4">
            <div>
              <p className="text-2xl font-extrabold">₦{stats.todayRevenue.toLocaleString()}</p>
              <p className="text-sm text-blue-100">revenue recorded today</p>
            </div>
            <span className="rounded-full bg-white/10 px-3 py-1 text-sm font-bold">
              {stats.todayEnrollments} enrollment{stats.todayEnrollments === 1 ? '' : 's'}
            </span>
          </div>
        </div>

        <Link href="/admin/courses"
          className={`rounded-2xl p-5 shadow-sm border transition hover:shadow-md ${
            unpublishedCourses > 0
              ? 'bg-yellow-50 border-yellow-200'
              : 'bg-green-50 border-green-200'
          }`}>
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Needs attention</p>
          <div className="mt-2 flex items-end justify-between gap-4">
            <div>
              <p className="text-2xl font-extrabold text-slate-800">{unpublishedCourses}</p>
              <p className="text-sm text-slate-500">
                {unpublishedCourses === 1 ? 'course is' : 'courses are'} currently unpublished
              </p>
            </div>
            <span className="text-sm font-bold text-brand-blue">Manage →</span>
          </div>
        </Link>
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-extrabold text-brand-blue">Recent Enrollments</h2>
            <p className="text-xs text-slate-400 mt-1">Latest course activity</p>
          </div>
          <Link href="/admin/students" className="text-xs font-bold text-brand-yellow hover:underline">View students →</Link>
        </div>
        {recentEnrollments.length > 0 ? (
          <ul className="divide-y divide-slate-100">
            {recentEnrollments.map((e) => (
              <li key={e.id} className="flex items-center gap-3 py-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-blue text-white text-sm font-bold">
                  {(e.profiles?.full_name || e.profiles?.email || '?')[0].toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-700">
                    {e.profiles?.full_name || e.profiles?.email || 'Student'}
                  </p>
                  <p className="truncate text-xs text-slate-400">{e.courses?.title || 'Course enrollment'}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-bold text-slate-700">₦{Number(e.amount_paid || 0).toLocaleString()}</p>
                  <p className="text-[11px] text-slate-400">
                    {new Date(e.enrolled_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-xl bg-slate-50 py-8 text-center text-sm text-slate-400">No enrollments yet.</div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">

        <section className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-extrabold text-brand-blue">Recent Students</h2>
            <Link href="/admin/students" className="text-xs font-bold text-brand-yellow hover:underline">View all →</Link>
          </div>
          {recentStudents.length > 0 ? (
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
              <p className="text-2xl">👨‍🎓</p>
              <p className="mt-2 text-sm text-slate-400">No students yet</p>
            </div>
          )}
        </section>

        <section className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-extrabold text-brand-blue">Recent Courses</h2>
            <Link href="/admin/courses" className="text-xs font-bold text-brand-yellow hover:underline">View all →</Link>
          </div>
          {recentCourses.length > 0 ? (
            <ul className="space-y-3">
              {recentCourses.map((c) => (
                <li key={c.id} className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-purple-100 text-purple-600 text-lg">📚</div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-700">{c.title}</p>
                    <p className="text-xs text-slate-400">{c.price === 0 ? 'Free' : `₦${c.price?.toLocaleString()}`}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${c.is_published ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-500'}`}>
                    {c.is_published ? 'Live' : 'Draft'}
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

      <section className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100">
        <h2 className="text-base font-extrabold text-brand-blue mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <Link href="/admin/courses/new" className="rounded-full bg-brand-yellow px-5 py-2.5 text-sm font-bold text-brand-dark hover:opacity-90 transition">✏️ Create Course</Link>
          <Link href="/admin/students" className="rounded-full bg-brand-blue px-5 py-2.5 text-sm font-bold text-white hover:opacity-90 transition">👨‍🎓 Students</Link>
          <Link href="/admin/quizzes" className="rounded-full border-2 border-brand-blue px-5 py-2.5 text-sm font-bold text-brand-blue hover:bg-brand-blue hover:text-white transition">📝 Quizzes</Link>
          <Link href="/admin/content-engine" className="rounded-full border-2 border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-600 hover:border-slate-400 transition">🧠 Content Engine</Link>
          <Link href="/" className="rounded-full border-2 border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-600 hover:border-slate-400 transition">🌐 Website</Link>
        </div>
      </section>
    </div>
  );
}
