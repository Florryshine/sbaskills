'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function AdminCoursesPage() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const supabase = createBrowserClient();

    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/admin/login'); return; }

      const { data: profile } = await supabase
        .from('profiles').select('role').eq('id', user.id).single();
      if (profile?.role !== 'admin') { router.push('/login'); return; }

      const { data } = await supabase
        .from('courses')
        .select('*')
        .order('created_at', { ascending: false });

      setCourses(data || []);
      setLoading(false);
    }
    load();
  }, [router]);

  async function togglePublish(course) {
    const supabase = createBrowserClient();
    await supabase
      .from('courses')
      .update({ is_published: !course.is_published })
      .eq('id', course.id);
    setCourses(prev =>
      prev.map(c => c.id === course.id
        ? { ...c, is_published: !c.is_published } : c)
    );
  }

  async function deleteCourse(id) {
    if (!confirm('Are you sure you want to delete this course?')) return;
    const supabase = createBrowserClient();
    await supabase.from('courses').delete().eq('id', id);
    setCourses(prev => prev.filter(c => c.id !== id));
  }

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <p className="text-gray-500">Loading courses...</p>
    </div>
  );

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-brand-yellow">
              Management
            </p>
            <h1 className="mt-1 text-2xl font-extrabold text-brand-blue">All Courses</h1>
            <p className="mt-1 text-sm text-slate-500">{courses.length} courses total</p>
          </div>
          <Link href="/admin/courses/new"
            className="rounded-full bg-brand-yellow px-5 py-2.5 text-sm 
                       font-bold text-brand-dark hover:opacity-90 transition">
            + New Course
          </Link>
        </div>
      </section>

      <section className="rounded-2xl bg-white shadow-sm border border-slate-100 overflow-hidden">
        {courses.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {courses.map((course) => (
              <div key={course.id}
                className="flex items-center gap-4 p-4 hover:bg-slate-50 transition">
                <div className="h-14 w-20 shrink-0 overflow-hidden rounded-xl"
                  style={{ backgroundColor: course.color || '#1a73e8' }}>
                  {course.thumbnail_url ? (
                    <img src={course.thumbnail_url} alt={course.title}
                      className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center 
                                    justify-center text-2xl">📚</div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-slate-800">{course.title}</p>
                  <p className="mt-0.5 text-sm font-semibold text-brand-blue">
                    {course.price === 0 ? 'Free' : `₦${course.price?.toLocaleString()}`}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {new Date(course.created_at).toLocaleDateString('en-NG', {
                      day: 'numeric', month: 'short', year: 'numeric'
                    })}
                  </p>
                </div>

                <span className={`hidden shrink-0 rounded-full px-3 py-1 
                                  text-xs font-bold sm:block
                  ${course.is_published
                    ? 'bg-green-100 text-green-700'
                    : 'bg-slate-200 text-slate-500'}`}>
                  {course.is_published ? '🟢 Live' : '⏸ Draft'}
                </span>

                <div className="flex shrink-0 items-center gap-2 flex-wrap">
                  <Link href={`/admin/courses/${course.id}`}
                    className="rounded-full border border-brand-blue px-3 py-1.5 
                               text-xs font-bold text-brand-blue hover:bg-brand-blue 
                               hover:text-white transition">
                    Edit
                  </Link>
                  <button onClick={() => togglePublish(course)}
                    className={`rounded-full px-3 py-1.5 text-xs font-bold transition
                      ${course.is_published
                        ? 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                        : 'bg-green-100 text-green-700 hover:bg-green-200'}`}>
                    {course.is_published ? 'Unpublish' : 'Publish'}
                  </button>
                  <button onClick={() => deleteCourse(course.id)}
                    className="rounded-full bg-red-100 px-3 py-1.5 text-xs 
                               font-bold text-red-600 hover:bg-red-200 transition">
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-16 text-center">
            <p className="text-4xl">📚</p>
            <h3 className="mt-4 text-lg font-bold text-slate-700">No courses yet</h3>
            <p className="mt-2 text-sm text-slate-400">
              Create your first course to get started.
            </p>
            <Link href="/admin/courses/new"
              className="mt-5 inline-block rounded-full bg-brand-yellow px-6 
                         py-3 text-sm font-bold text-brand-dark hover:opacity-90 
                         transition">
              + Create First Course
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}