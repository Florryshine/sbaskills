'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { addPoints, updateStreak, getUserPoints } from '@/lib/gamification';

export default function StudentDashboard() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [enrolledCourses, setEnrolledCourses] = useState([]);
  const [availableCourses, setAvailableCourses] = useState([]);
  const [certificates, setCertificates] = useState([]);
  const [userPoints, setUserPoints] = useState(0);
  const [userStreak, setUserStreak] = useState(0);
  const [lessonsDone, setLessonsDone] = useState(0);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const supabase = createBrowserClient();

    async function loadDashboard() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      setUser(user);

      // Update streak and add daily login bonus
      await updateStreak(user.id);
      await addPoints(user.id, 5, 'Daily login bonus', 'login');

      // Get user points
      const pointsData = await getUserPoints(user.id);
      setUserPoints(pointsData.total_points || 0);
      setUserStreak(pointsData.streak_days || 0);

      // Get profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      setProfile(profileData);

      // Get enrollments
      const { data: enrollments } = await supabase
        .from('enrollments')
        .select('*, courses(*)')
        .eq('student_id', user.id);

      const enrolled = enrollments?.map(e => e.courses).filter(Boolean) || [];
      setEnrolledCourses(enrolled);

      // Get available courses
      const enrolledIds = enrolled.map(c => c.id);
      const { data: allCourses } = await supabase
        .from('courses')
        .select('*')
        .eq('is_published', true);
      const available = (allCourses || []).filter(
        c => !enrolledIds.includes(c.id)
      );
      setAvailableCourses(available);

      // Get certificates
      const { data: certs } = await supabase
        .from('certificates')
        .select('*, courses(title)')
        .eq('student_id', user.id)
        .order('issued_at', { ascending: false });
      setCertificates(certs || []);

      // Count lessons completed
      const { data: progress } = await supabase
        .from('lesson_progress')
        .select('id')
        .eq('student_id', user.id)
        .eq('completed', true);
      setLessonsDone(progress?.length || 0);

      setLoading(false);
    }

    loadDashboard();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-5xl mb-4">⏳</p>
          <p className="text-gray-500 font-medium">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 py-8">

          {/* Welcome Banner */}
          <div className="bg-brand-blue rounded-2xl p-6 mb-8 text-white">
            <h1 className="text-2xl font-extrabold mb-1">
              Welcome back, {profile?.full_name || user?.email?.split('@')[0]}! 👋
            </h1>
            <p className="text-blue-100 text-sm">
              Continue your learning journey — champions never stop growing.
            </p>
            {userStreak > 0 && (
              <div className="mt-3 bg-white/10 inline-block px-4 py-1 rounded-full">
                <span className="text-sm font-bold">🔥 {userStreak} day streak</span>
              </div>
            )}
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Enrolled Courses', value: enrolledCourses.length, emoji: '📚' },
              { label: 'Available Courses', value: availableCourses.length, emoji: '🎯' },
              { label: 'Lessons Done', value: lessonsDone, emoji: '✅' },
              { label: 'Points', value: userPoints, emoji: '⭐' },
            ].map((stat) => (
              <div key={stat.label}
                className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-center">
                <p className="text-2xl mb-1">{stat.emoji}</p>
                <p className="text-2xl font-extrabold text-brand-blue">{stat.value}</p>
                <p className="text-xs text-gray-500 mt-1">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* My Enrolled Courses */}
          <div className="mb-10">
            <h2 className="text-xl font-extrabold text-gray-800 mb-4">
              📖 My Courses
            </h2>
            {enrolledCourses.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 
                              shadow-sm p-8 text-center">
                <p className="text-4xl mb-3">🎓</p>
                <p className="font-bold text-gray-700 mb-1">No courses yet</p>
                <p className="text-sm text-gray-500 mb-4">
                  Browse available courses below and enroll today
                </p>
                <Link href="/courses"
                  className="inline-block bg-brand-yellow text-brand-dark 
                             font-bold px-6 py-3 rounded-full text-sm 
                             hover:opacity-90 transition">
                  Browse Courses →
                </Link>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {enrolledCourses.map((course) => (
                  <div key={course.id}
                    className="bg-white rounded-2xl border border-gray-100 
                               shadow-sm overflow-hidden hover:shadow-md transition">
                    <div className="h-24 flex items-center justify-center text-4xl"
                      style={{ backgroundColor: course.color || '#1a73e8' }}>
                      📚
                    </div>
                    <div className="p-4">
                      <span className="text-xs font-bold text-green-600 
                                       bg-green-50 px-2 py-1 rounded-full">
                        ✅ Enrolled
                      </span>
                      <h3 className="font-bold text-gray-800 mt-2 mb-1">
                        {course.title}
                      </h3>
                      <p className="text-xs text-gray-500 mb-3 line-clamp-2">
                        {course.description}
                      </p>
                      <Link href={`/courses/${course.id}`}
                        className="block text-center bg-brand-blue text-white 
                                   font-bold py-2 rounded-full text-sm 
                                   hover:opacity-90 transition">
                        Continue Learning →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Available Courses */}
          {availableCourses.length > 0 && (
            <div className="mb-10">
              <h2 className="text-xl font-extrabold text-gray-800 mb-4">
                🎯 Available Courses
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {availableCourses.map((course) => (
                  <div key={course.id}
                    className="bg-white rounded-2xl border border-gray-100 
                               shadow-sm overflow-hidden hover:shadow-md transition">
                    <div className="h-24 flex items-center justify-center text-4xl"
                      style={{ backgroundColor: course.color || '#1a73e8' }}>
                      🎓
                    </div>
                    <div className="p-4">
                      <h3 className="font-bold text-gray-800 mb-1">{course.title}</h3>
                      <p className="text-xs text-gray-500 mb-3 line-clamp-2">
                        {course.description}
                      </p>
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-brand-blue text-sm">
                          {course.price === 0 ? 'FREE' : `₦${course.price?.toLocaleString()}`}
                        </span>
                        <Link href={`/courses/${course.id}`}
                          className="bg-brand-yellow text-brand-dark font-bold 
                                     px-4 py-2 rounded-full text-xs 
                                     hover:opacity-90 transition">
                          Enroll Now
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Certificates Section */}
          {certificates.length > 0 && (
            <div className="mb-10">
              <h2 className="text-xl font-extrabold text-gray-800 mb-4">🎓 My Certificates</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {certificates.map((cert) => (
                  <div key={cert.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                    <div className="text-3xl mb-2">🎓</div>
                    <p className="font-bold text-gray-800">{cert.courses?.title}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Issued: {new Date(cert.issued_at).toLocaleDateString('en-NG', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                      })}
                    </p>
                    <a
                      href={`/certificate/${cert.id}`}
                      target="_blank"
                      className="inline-block mt-3 text-brand-blue font-bold text-sm hover:underline"
                    >
                      View Certificate →
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Links */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="font-extrabold text-gray-800 mb-4">⚡ Quick Links</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Browse Courses', href: '/courses', emoji: '📚' },
                { label: 'Leaderboard', href: '/leaderboard', emoji: '🏆' },
                { label: 'Blog', href: '/blog', emoji: '📝' },
                { label: 'Audio', href: '/audio', emoji: '🎵' },
                { label: 'Library', href: '/library', emoji: '📖' },
                { label: 'Rewards', href: '/rewards', emoji: '🎁' },
              ].map((link) => (
                <Link key={link.href} href={link.href}
                  className="flex flex-col items-center gap-2 p-4 rounded-2xl 
                             border border-gray-100 hover:border-brand-blue 
                             hover:shadow-sm transition text-center">
                  <span className="text-2xl">{link.emoji}</span>
                  <span className="text-xs font-bold text-gray-700">
                    {link.label}
                  </span>
                </Link>
              ))}
            </div>
          </div>

        </div>
      </div>
      <Footer />
    </>
  );
}