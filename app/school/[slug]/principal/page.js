'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase';

// Deterministic "random" so the same demo student always gets the same
// fake numbers within a session, instead of reshuffling on every render.
function fakeSeed(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

const DEMO_SUBJECTS = [
  { subject: 'Mathematics', score: 74 },
  { subject: 'English', score: 81 },
  { subject: 'Biology', score: 68 },
  { subject: 'Chemistry', score: 59 },
  { subject: 'Physics', score: 63 },
];

const DEMO_NAMES = [
  'Chidera Okafor', 'Amina Bello', 'Emeka Nwosu', 'Grace Adeyemi',
  'Ibrahim Suleiman', 'Ngozi Eze', 'Tunde Bakare', 'Fatima Yusuf',
  'David Okonkwo', 'Blessing Umeh',
];

function buildDemoStudents(count) {
  return Array.from({ length: count }).map((_, i) => {
    const seed = fakeSeed(`demo-${i}`);
    return {
      id: `demo-${i}`,
      full_name: DEMO_NAMES[i % DEMO_NAMES.length] + (i >= DEMO_NAMES.length ? ` ${Math.floor(i / DEMO_NAMES.length) + 1}` : ''),
      email: `student${i + 1}@demo.sba`,
      student_level: ['SS1', 'SS2', 'SS3'][seed % 3],
      target_exams: [['WAEC'], ['WAEC', 'JAMB'], ['NECO']][seed % 3],
      points: 120 + (seed % 880),
      activityCount: seed % 40,
      isDemo: true,
    };
  });
}

export default function PrincipalDashboard() {
  const { slug } = useParams();
  const router = useRouter();
  const [school, setSchool] = useState(null);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [demoMode, setDemoMode] = useState(false);

  useEffect(() => {
    const supabase = createBrowserClient();

    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/admin/login'); return; }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, school_id, full_name')
        .eq('id', user.id)
        .single();

      if (!profile || !['principal', 'teacher', 'admin'].includes(profile.role)) {
        setError('This page is only available to school staff.');
        setLoading(false);
        return;
      }

      const { data: schoolData } = await supabase
        .from('schools')
        .select('id, slug, name')
        .eq('slug', slug)
        .single();

      if (!schoolData) {
        setError('School not found.');
        setLoading(false);
        return;
      }

      if (profile.role !== 'admin' && profile.school_id !== schoolData.id) {
        setError('You do not have access to this school\'s dashboard.');
        setLoading(false);
        return;
      }

      setSchool(schoolData);

      const { data: studentRows } = await supabase
        .from('profiles')
        .select(`
          id, full_name, email, student_level, target_exams, created_at,
          user_points(total_points)
        `)
        .eq('school_id', schoolData.id)
        .eq('role', 'student')
        .order('created_at', { ascending: false });

      const studentIds = (studentRows || []).map(s => s.id);
      let activityCounts = {};
      if (studentIds.length > 0) {
        const { data: logRows } = await supabase
          .from('points_log')
          .select('user_id, action_type')
          .in('user_id', studentIds);

        (logRows || []).forEach(row => {
          activityCounts[row.user_id] = (activityCounts[row.user_id] || 0) + 1;
        });
      }

      setStudents(
        (studentRows || []).map(s => ({
          ...s,
          points: s.user_points?.total_points || 0,
          activityCount: activityCounts[s.id] || 0,
          isDemo: false,
        }))
      );
      setLoading(false);
    }

    load();
  }, [slug, router]);

  const demoStudents = useMemo(() => buildDemoStudents(48), []);
  const displayStudents = demoMode ? demoStudents : students;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-gray-500">Loading dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto mt-20 rounded-2xl bg-white p-6 shadow-sm border border-slate-100 text-center">
        <p className="text-red-500 font-semibold">{error}</p>
      </div>
    );
  }

  const totalStudents = displayStudents.length;
  const activeStudents = displayStudents.filter(s => s.activityCount > 0).length;
  const avgPoints = totalStudents > 0
    ? Math.round(displayStudents.reduce((sum, s) => sum + s.points, 0) / totalStudents)
    : 0;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 py-10 space-y-6">
        <section className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100">
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-brand-yellow">
                Principal Dashboard
              </p>
              <h1 className="mt-1 text-2xl font-extrabold text-brand-blue">
                {school.name}
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                {totalStudents} students on Shiney Brain
              </p>
            </div>
            <button
              onClick={() => setDemoMode(v => !v)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition ${
                demoMode
                  ? 'bg-purple-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              🎭 Demo Mode {demoMode ? 'ON' : 'OFF'}
            </button>
          </div>
          {demoMode && (
            <div className="mt-4 rounded-xl bg-purple-50 border border-purple-100 px-4 py-3 text-sm text-purple-700">
              You're viewing sample data to illustrate what this dashboard looks like with an active school.
              No real students are shown. Turn this off to see {school.name}'s real data.
            </div>
          )}
        </section>

        {/* Summary cards */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100 text-center">
            <p className="text-3xl font-extrabold text-brand-blue">{totalStudents}</p>
            <p className="text-sm text-slate-500 mt-1">Total Students</p>
          </div>
          <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100 text-center">
            <p className="text-3xl font-extrabold text-green-600">{activeStudents}</p>
            <p className="text-sm text-slate-500 mt-1">Active This Term</p>
          </div>
          <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100 text-center">
            <p className="text-3xl font-extrabold text-purple-600">{avgPoints}</p>
            <p className="text-sm text-slate-500 mt-1">Average Points / Student</p>
          </div>
        </section>

        {/* Subject performance - only meaningful in demo mode for now,
            since real per-subject scoring isn't tracked yet */}
        {demoMode && (
          <section className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100">
            <h2 className="font-extrabold text-brand-blue mb-4">Subject Performance (sample)</h2>
            <div className="space-y-3">
              {DEMO_SUBJECTS.map(({ subject, score }) => (
                <div key={subject}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-semibold text-slate-600">{subject}</span>
                    <span className="font-bold text-brand-blue">{score}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${score >= 70 ? 'bg-green-500' : score >= 60 ? 'bg-amber-400' : 'bg-red-400'}`}
                      style={{ width: `${score}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-slate-400">
              Once your students start using quizzes, this fills in with their real subject-by-subject results.
            </p>
          </section>
        )}

        {/* Students table */}
        <section className="rounded-2xl bg-white shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-6 border-b border-slate-100">
            <h2 className="font-extrabold text-brand-blue">Students</h2>
          </div>
          <div className="overflow-x-auto max-h-[32rem] overflow-y-auto">
            <table className="min-w-full divide-y divide-slate-100 text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 sticky top-0">
                <tr>
                  <th className="px-6 py-4 font-semibold">Student</th>
                  <th className="px-6 py-4 font-semibold">Level</th>
                  <th className="px-6 py-4 font-semibold">Target Exams</th>
                  <th className="px-6 py-4 font-semibold">Activity</th>
                  <th className="px-6 py-4 font-semibold">Points</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayStudents.length > 0 ? displayStudents.map(s => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <p className="font-bold text-brand-dark">{s.full_name || 'Unnamed Student'}</p>
                      <p className="text-xs text-slate-400">{s.email}</p>
                    </td>
                    <td className="px-6 py-4 text-slate-600">{s.student_level || '—'}</td>
                    <td className="px-6 py-4 text-slate-600">{(s.target_exams || []).join(', ') || '—'}</td>
                    <td className="px-6 py-4">
                      {s.activityCount > 0 ? (
                        <span className="rounded-full bg-green-100 text-green-700 px-3 py-1 text-xs font-bold">
                          {s.activityCount} actions logged
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-100 text-slate-500 px-3 py-1 text-xs font-bold">
                          No activity yet
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 font-bold text-brand-blue">{s.points}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="5" className="px-6 py-10 text-center text-slate-500">
                      No students linked to this school yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
