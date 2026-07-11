'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function AdminStudentsPage() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
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
        .from('profiles')
        .select(`
          id, full_name, email, phone, role, created_at,
          date_of_birth, student_level, target_exams, interests,
          institution_name, institution_type, state,
          goal_title, goal_target, onboarding_completed,
          enrollments(course_id, courses(title))
        `)
        .eq('role', 'student')
        .order('created_at', { ascending: false });

      setStudents(data || []);
      setLoading(false);
    }
    load();
  }, [router]);

  const filtered = students.filter(s =>
    s.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    s.email?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <p className="text-gray-500">Loading students...</p>
    </div>
  );

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100">
        <p className="text-xs font-bold uppercase tracking-widest text-brand-yellow">
          Management
        </p>
        <h1 className="mt-1 text-2xl font-extrabold text-brand-blue">
          All Students
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {students.length} registered students
        </p>
        <div className="mt-4 flex gap-3">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full max-w-md rounded-2xl border border-slate-200 
                       px-4 py-3 text-sm outline-none focus:border-brand-blue"
          />
        </div>
      </section>

      <section className="rounded-2xl bg-white shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-6 py-4 font-semibold">Student</th>
                <th className="px-6 py-4 font-semibold">Contact</th>
                <th className="px-6 py-4 font-semibold">Details</th>
                <th className="px-6 py-4 font-semibold">Enrolled Courses</th>
                <th className="px-6 py-4 font-semibold">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length > 0 ? filtered.map((student) => (
                <tr key={student.id} className="hover:bg-slate-50">
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-blue text-white text-sm font-bold">
                        {(student.full_name || student.email || '?')[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="font-bold text-brand-blue">
                          {student.full_name || 'Unnamed Student'}
                        </p>
                        <p className="text-xs text-slate-400">{student.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-slate-600">
                    <p>{student.phone || 'No phone'}</p>
                  </td>
                  <td className="px-6 py-5 text-slate-600 text-xs space-y-1">
                    <p>🎂 {student.date_of_birth
                      ? new Date(student.date_of_birth).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })
                      : 'No birthday'}</p>
                    <p>🎓 {student.student_level || 'Level not set'}</p>
                    <p>📝 {(student.target_exams || []).join(', ') || 'No exam picked'}</p>
                    <p>📚 {(student.interests || []).join(', ') || 'No subjects picked'}</p>
                    {student.goal_title && <p>🎯 {student.goal_title}</p>}
                    {!student.onboarding_completed && (
                      <p className="text-amber-500 font-semibold">⚠️ Onboarding incomplete</p>
                    )}
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex flex-wrap gap-2">
                      {(student.enrollments || []).length > 0 ? (
                        student.enrollments.map((enrollment, index) => (
                          <span key={index}
                            className="rounded-full bg-brand-yellow/20 px-3 py-1 
                                       text-xs font-bold text-brand-dark">
                            {enrollment.courses?.title || 'Course'}
                          </span>
                        ))
                      ) : (
                        <span className="text-slate-400 text-xs">No enrollments</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-5 text-slate-500 text-xs">
                    {new Date(student.created_at).toLocaleDateString('en-NG', {
                      day: 'numeric', month: 'short', year: 'numeric'
                    })}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="5" className="px-6 py-10 text-center text-slate-500">
                    No students found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}