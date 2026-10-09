'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function AdminStudentsPage() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const router = useRouter();

  useEffect(() => {
    const supabase = createBrowserClient();

    async function load() {
      try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) { router.push('/admin/login'); return; }

      const { data: profile, error: roleError } = await supabase
        .from('profiles').select('role').eq('id', user.id).single();
      if (roleError || profile?.role !== 'admin') { router.push('/login'); return; }

      const { data, error: studentsError } = await supabase
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

      if (studentsError) throw studentsError;
      setStudents(data || []);
      } catch (error) {
        console.error('Admin student list failed to load:', error);
        setErrorMessage('We could not load the student list. Check your connection and permissions, then refresh.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recentStudents = students.filter(s => s.created_at && new Date(s.created_at).getTime() >= sevenDaysAgo).length;
  const incompleteStudents = students.filter(s => !s.onboarding_completed).length;
  const jambStudents = students.filter(s => (s.target_exams || []).includes('JAMB')).length;

  const filtered = students.filter(s => {
    const term = search.trim().toLowerCase();
    const matchesSearch = !term || [s.full_name, s.email, s.phone].some(value => value?.toLowerCase().includes(term));
    const matchesStatus = statusFilter === 'all' ||
      (statusFilter === 'incomplete' && !s.onboarding_completed) ||
      (statusFilter === 'complete' && s.onboarding_completed) ||
      (statusFilter === 'jamb' && (s.target_exams || []).includes('JAMB'));
    return matchesSearch && matchesStatus;
  });

  const exportCsv = () => {
    const headers = ['Name', 'Email', 'Phone', 'Joined', 'Onboarding complete', 'Exam targets', 'Subjects', 'Student level', 'Goal'];
    const quote = value => '"' + String(value ?? '').replace(/"/g, '""') + '"';
    const rows = filtered.map(s => [s.full_name, s.email, s.phone, s.created_at, s.onboarding_completed ? 'Yes' : 'No', (s.target_exams || []).join('; '), (s.interests || []).join('; '), s.student_level, s.goal_title]);
    const csv = [headers, ...rows].map(row => row.map(quote).join(',')).join('\\r\\n');
    const blob = new Blob(['\\uFEFF', csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'sba-students-' + new Date().toISOString().slice(0, 10) + '.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

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
        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-2xl bg-blue-50 p-4"><p className="text-xs font-semibold text-slate-500">Registered students</p><p className="mt-1 text-2xl font-black text-brand-blue">{students.length}</p></div>
          <div className="rounded-2xl bg-amber-50 p-4"><p className="text-xs font-semibold text-slate-500">Onboarding incomplete</p><p className="mt-1 text-2xl font-black text-amber-700">{incompleteStudents}</p></div>
          <div className="rounded-2xl bg-green-50 p-4"><p className="text-xs font-semibold text-slate-500">Joined in last 7 days</p><p className="mt-1 text-2xl font-black text-green-700">{recentStudents}</p></div>
          <div className="rounded-2xl bg-violet-50 p-4"><p className="text-xs font-semibold text-slate-500">JAMB students</p><p className="mt-1 text-2xl font-black text-violet-700">{jambStudents}</p></div>
        </div>
        {errorMessage && <div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{errorMessage}</div>}
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search name, email or phone..."
            className="w-full max-w-md rounded-2xl border border-slate-200 
                       px-4 py-3 text-sm outline-none focus:border-brand-blue"
          />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="rounded-2xl border border-slate-200 px-3 py-3 text-sm">
            <option value="all">All students</option>
            <option value="incomplete">Onboarding incomplete</option>
            <option value="complete">Onboarding complete</option>
            <option value="jamb">JAMB target selected</option>
          </select>
          <button type="button" onClick={exportCsv} className="rounded-2xl bg-brand-blue px-4 py-3 text-sm font-bold text-white">Export CSV ({filtered.length})</button>
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
                <th className="px-6 py-4 font-semibold">Onboarding</th>
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
                  <td className="px-6 py-5 text-xs">
                    <span className={'rounded-full px-3 py-1 font-bold ' + (student.onboarding_completed ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700')}>
                      {student.onboarding_completed ? 'Complete' : 'Incomplete'}
                    </span>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="6" className="px-6 py-10 text-center text-slate-500">
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