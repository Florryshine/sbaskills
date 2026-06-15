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
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">
        Welcome back, {user?.email?.split('@')[0]}! 👋
      </h1>
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
