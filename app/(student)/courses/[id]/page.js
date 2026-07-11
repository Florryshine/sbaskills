'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import { useParams, useRouter } from 'next/navigation';
import { initializePayment } from '@/lib/paystack';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Link from 'next/link';
import MarkDoneButton from '@/components/MarkDoneButton';

export default function CoursePage() {
  const [course, setCourse] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [enrollment, setEnrollment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const { id } = useParams();
  const router = useRouter();
  const supabase = createBrowserClient();

  useEffect(() => {
    async function loadCourse() {
      try {
        const { data: courseData } = await supabase
          .from('courses')
          .select('*')
          .eq('id', id)
          .single();
        setCourse(courseData);

        const { data: lessonsData } = await supabase
          .from('lessons')
          .select('*')
          .eq('course_id', id)
          .order('order_index', { ascending: true });
        setLessons(lessonsData || []);

        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: enrollmentData } = await supabase
            .from('enrollments')
            .select('*')
            .eq('student_id', user.id)
            .eq('course_id', id)
            .maybeSingle();
          setEnrollment(enrollmentData);
        }

        setLoading(false);
      } catch (error) {
        console.error('Error loading course:', error);
        setLoading(false);
      }
    }

    loadCourse();
  }, [id, supabase]);

  const handleEnroll = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push(`/login?next=/courses/${id}`);
      return;
    }

    setProcessing(true);

    try {
      // Free course
      if (course.price === 0 || course.price === '0') {
        const { error } = await supabase
          .from('enrollments')
          .insert({
            student_id: user.id,
            course_id: course.id,
            amount_paid: 0,
            status: 'active',
            payment_type: 'free',
            payment_reference: 'free-' + Date.now(),
          });

        if (error) {
          alert('Error enrolling: ' + error.message);
        } else {
          alert('✅ You are now enrolled in this course!');
          const { data: newEnrollment } = await supabase
            .from('enrollments')
            .select('*')
            .eq('student_id', user.id)
            .eq('course_id', id)
            .single();
          setEnrollment(newEnrollment);
          router.refresh();
        }
        setProcessing(false);
        return;
      }

      // Paid course – Paystack
      const amount = parseInt(course.price);
      if (isNaN(amount) || amount <= 0) {
        alert('Invalid course price.');
        setProcessing(false);
        return;
      }

      const transaction = await initializePayment(user.email, amount, {
        course_id: course.id,
        student_id: user.id,
      });

      // Verify payment
      const response = await fetch('/api/verify-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reference: transaction.reference,
          course_id: course.id,
          student_id: user.id,
          amount: amount,
        }),
      });

      const result = await response.json();
      if (result.success) {
        alert('✅ Payment successful! You are now enrolled.');
        const { data: newEnrollment } = await supabase
          .from('enrollments')
          .select('*')
          .eq('student_id', user.id)
          .eq('course_id', id)
          .single();
        setEnrollment(newEnrollment);
        router.refresh();
      } else {
        alert('Payment verification failed. Please contact admin.');
      }
    } catch (error) {
      console.error('Enrollment error:', error);
      alert(error.message || 'Payment cancelled or failed.');
    }
    setProcessing(false);
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <p className="text-2xl mb-2">⏳</p>
            <p className="text-gray-500">Loading course...</p>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  if (!course) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen flex items-center justify-center">Course not found</div>
        <Footer />
      </>
    );
  }

  const isEnrolled = enrollment?.status === 'active';
  const lessonCount = lessons.length;

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="h-48 flex items-center justify-center text-6xl"
              style={{ backgroundColor: course.color || '#1a73e8' }}>
              📚
            </div>
            <div className="p-6">
              <h1 className="text-2xl font-extrabold text-gray-900">{course.title}</h1>
              <p className="text-gray-600 mt-2">{course.description}</p>
              <div className="flex items-center gap-4 mt-4">
                <span className="text-2xl font-extrabold text-brand-blue">
                  {course.price === 0 || course.price === '0' ? 'FREE' : `₦${course.price?.toLocaleString()}`}
                </span>
                <span className="text-sm text-gray-500">{lessonCount} lessons</span>
              </div>

              {isEnrolled ? (
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <Link
                    href={`/courses/${id}/lessons/${lessons[0]?.id || '#'}`}
                    className="inline-block bg-green-600 text-white px-6 py-3 rounded-full font-bold hover:opacity-90"
                  >
                    Continue Learning →
                  </Link>
                  <MarkDoneButton activityType="course" activityId={course.id} points={20} label="✅ Mark as Completed" />
                </div>
              ) : (
                <button
                  onClick={handleEnroll}
                  disabled={processing}
                  className="mt-4 inline-block bg-brand-yellow text-brand-dark px-6 py-3 rounded-full font-bold hover:opacity-90 transition"
                >
                  {processing ? 'Processing...' : (course.price === 0 || course.price === '0' ? 'Enroll for Free' : 'Enroll Now')}
                </button>
              )}
            </div>
          </div>

          <div className="mt-8 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-xl font-extrabold mb-4">📖 Lessons</h2>
            {lessons.length === 0 ? (
              <p className="text-gray-400">No lessons yet.</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {lessons.map((lesson, idx) => (
                  <div key={lesson.id} className="py-3 flex items-center gap-4">
                    <span className="font-bold text-brand-blue w-8">{idx + 1}.</span>
                    <span className="flex-1 font-medium text-gray-800">{lesson.title}</span>
                    {isEnrolled && lesson.video_url && (
                      <Link href={`/courses/${id}/lessons/${lesson.id}`}
                        className="text-brand-blue font-bold text-sm hover:underline">
                        Watch →
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-6 text-center">
            <Link href="/dashboard" className="text-brand-blue hover:underline font-semibold text-sm">
              ← Back to Dashboard
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}