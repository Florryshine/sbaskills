'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function TutorDashboard() {
  const [stats, setStats] = useState({
    quizzes: 0,
    assignments: 0,
    materials: 0,
    students: 0,
  });
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createBrowserClient();

  useEffect(() => {
    async function loadStats() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }

      const { count: quizCount } = await supabase
        .from('quizzes')
        .select('*', { count: 'exact', head: true })
        .eq('tutor_id', user.id);

      const { count: assignmentCount } = await supabase
        .from('assignments')
        .select('*', { count: 'exact', head: true })
        .eq('tutor_id', user.id);

      const { count: materialCount } = await supabase
        .from('tutor_materials')
        .select('*', { count: 'exact', head: true })
        .eq('tutor_id', user.id);

      const { count: studentCount } = await supabase
        .from('assignment_submissions')
        .select('student_id', { count: 'exact', head: true })
        .eq('assignment_id', user.id);

      setStats({
        quizzes: quizCount || 0,
        assignments: assignmentCount || 0,
        materials: materialCount || 0,
        students: studentCount || 0,
      });
      setLoading(false);
    }

    loadStats();
  }, [router]);

  if (loading) {
    return <div className="text-center py-20">Loading dashboard...</div>;
  }

  const actions = [
    { href: '/tutor/quizzes/new', label: '📝 Create Quiz', color: 'bg-brand-blue', desc: 'Create a quiz with questions' },
    { href: '/tutor/assignments/new', label: '📄 Create Assignment', color: 'bg-purple-600', desc: 'Create an assignment' },
    { href: '/tutor/materials/new', label: '📁 Upload Material', color: 'bg-green-600', desc: 'Upload notes or recordings' },
    { href: '/tutor/submissions', label: '📊 View Submissions', color: 'bg-orange-500', desc: 'Grade student submissions' },
    { href: '/tutor/bonus', label: '⭐ Award Bonus Points', color: 'bg-yellow-500', desc: 'Award bonus points to students' },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <p className="text-xs font-bold uppercase tracking-widest text-brand-yellow">Tutor Dashboard</p>
        <h1 className="text-2xl font-extrabold text-brand-blue mt-1">Welcome to Your Tutor Dashboard</h1>
        <p className="text-sm text-gray-500">Manage your quizzes, assignments, and track student progress.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-4 shadow-sm border text-center">
          <p className="text-2xl font-extrabold text-brand-blue">{stats.quizzes}</p>
          <p className="text-xs text-gray-500">Quizzes</p>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border text-center">
          <p className="text-2xl font-extrabold text-purple-600">{stats.assignments}</p>
          <p className="text-xs text-gray-500">Assignments</p>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border text-center">
          <p className="text-2xl font-extrabold text-green-600">{stats.materials}</p>
          <p className="text-xs text-gray-500">Materials</p>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border text-center">
          <p className="text-2xl font-extrabold text-orange-500">{stats.students}</p>
          <p className="text-xs text-gray-500">Students</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {actions.map((action) => (
          <Link key={action.href} href={action.href}
            className="bg-white rounded-2xl p-6 shadow-sm border hover:shadow-md transition group">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl mb-3 ${action.color} bg-opacity-10`}>
              {action.label.split(' ')[0]}
            </div>
            <h3 className="font-bold text-gray-800 group-hover:text-brand-blue transition">{action.label}</h3>
            <p className="text-xs text-gray-500 mt-1">{action.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}