'use client';

import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function StudentDashboard() {
  const [user, setUser] = useState(null);
  const [enrolledCourses, setEnrolledCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClientComponentClient();
  const router = useRouter();

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      setUser(user);
      // Fetch all published courses
      const { data: courses } = await supabase
        .from('courses')
        .select('*')
        .eq('is_published', true);
      setEnrolledCourses(courses || []);
      setLoading(false);
    };
    getUser();
  }, [supabase, router]);

  if (loading) {
    return <div className="text-center py-10">Loading dashboard...</div>;
  }

  return (
  <div className="max-w-7xl mx-auto px-4 py-6">
    
    {/* Clean Top Navigation Bar */}
    <header className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 bg-brand-blue rounded-xl flex items-center justify-center text-xl text-white font-bold">
          🎓
        </div>
        <div>
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block leading-tight">Student Portal</span>
          <h2 className="text-sm font-black text-brand-blue">
            Shiney Brain Academy
          </h2>
        </div>
      </div>

      <nav className="flex items-center gap-2">
        <a 
          href="/" 
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-brand-blue bg-slate-50 hover:bg-slate-100 px-3 py-2 rounded-xl transition"
        >
          🏠 <span>Main Website</span>
        </a>
        <a 
          href="/courses" 
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-brand-blue bg-slate-50 hover:bg-slate-100 px-3 py-2 rounded-xl transition"
        >
          📚 <span>Browse Courses</span>
        </a>
      </nav>
    </header>

    {/* Welcome Section */}
    <div className="mb-8 bg-gradient-to-br from-brand-blue to-blue-900 p-6 rounded-2xl text-white shadow-sm">
      <span className="text-xs font-bold uppercase tracking-wider text-brand-yellow">Dashboard Overview</span>
      <h1 className="text-2xl font-black mt-1">
        Welcome back, {user?.email?.split('@')[0]}! 👋
      </h1>
      <p className="text-blue-100/80 text-xs font-medium mt-1">
        Track your progress, launch your classes, and build real-world skills.
      </p>
    </div>
      <p className="text-gray-600 mb-8">Continue your learning journey</p>

      <div className="grid md:grid-cols-2 gap-6">
        {/* My Courses Section */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">My Courses</h2>
          {enrolledCourses.length === 0 ? (
            <p className="text-gray-500">You haven't enrolled in any courses yet.</p>
          ) : (
            <div className="space-y-4">
              {enrolledCourses.map((course) => (
                <div key={course.id} className="border rounded p-4">
                  <h3 className="font-medium">{course.title}</h3>
                  <p className="text-sm text-gray-500">
                    {course.description?.substring(0, 100)}
                  </p>
                  <Link
                    href={`/courses/${course.id}`}
                    className="text-blue-600 text-sm mt-2 inline-block"
                  >
                    Continue Learning →
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Progress Section */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Your Progress</h2>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-gray-600">Total courses enrolled</p>
              <p className="text-2xl font-bold">{enrolledCourses.length}</p>
            </div>
          </div>
          <div className="mt-6 pt-4 border-t">
            <Link href="/courses" className="text-blue-600 hover:underline">
              Browse more courses →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
             }
