'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createBrowserClient } from '@/lib/supabase';
import { formatCurrency } from '@/lib/utils';

export default function AdminCourseManager({ initialCourses = [] }) {
  const [courses, setCourses] = useState(initialCourses);
  const [loadingId, setLoadingId] = useState('');

  const deleteCourse = async (courseId) => {
    const confirmed = window.confirm('Delete this course and all related lessons?');

    if (!confirmed) {
      return;
    }

    try {
      setLoadingId(courseId);
      const supabase = createBrowserClient();
      const { error } = await supabase.from('courses').delete().eq('id', courseId);

      if (error) {
        throw error;
      }

      setCourses((current) => current.filter((course) => course.id !== courseId));
    } catch (error) {
      alert(error.message);
    } finally {
      setLoadingId('');
    }
  };

  const togglePublished = async (courseId, currentValue) => {
    try {
      setLoadingId(courseId);
      const supabase = createBrowserClient();
      const { data, error } = await supabase
        .from('courses')
        .update({ is_published: !currentValue })
        .eq('id', courseId)
        .select('*')
        .single();

      if (error) {
        throw error;
      }

      setCourses((current) => current.map((course) => (course.id === courseId ? data : course)));
    } catch (error) {
      alert(error.message);
    } finally {
      setLoadingId('');
    }
  };

  return (
    <div className="space-y-6">
      {courses.map((course) => (
        <div key={course.id} className="rounded-3xl border border-slate-100 bg-white p-6 shadow-soft">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="text-xl font-bold text-brand-blue">{course.title}</h3>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${course.is_published ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                  {course.is_published ? 'Published' : 'Draft'}
                </span>
              </div>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{course.description}</p>
              <div className="mt-3 flex flex-wrap gap-4 text-sm font-semibold text-slate-500">
                <span>{formatCurrency(course.price)}</span>
                <span>{course.lessons?.[0]?.count || 0} lessons</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => togglePublished(course.id, course.is_published)}
                disabled={loadingId === course.id}
                className="rounded-full border border-brand-blue px-4 py-2 text-sm font-semibold text-brand-blue disabled:opacity-60"
              >
                {course.is_published ? 'Unpublish' : 'Publish'}
              </button>
              <Link href={`/admin/courses/${course.id}`} className="rounded-full bg-brand-yellow px-4 py-2 text-sm font-bold text-brand-dark">
                Edit Course
              </Link>
              <button
                onClick={() => deleteCourse(course.id)}
                disabled={loadingId === course.id}
                className="rounded-full border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 disabled:opacity-60"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ))}
      {!courses.length ? (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center text-slate-500">
          No courses yet. Create your first course.
        </div>
      ) : null}
    </div>
  );
}
