'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { addPoints } from '@/lib/gamification';

export default function LessonPlayerPage() {
  const [lesson, setLesson] = useState(null);
  const [course, setCourse] = useState(null);
  const [enrollment, setEnrollment] = useState(null);
  const [allLessons, setAllLessons] = useState([]);
  const [completedLessons, setCompletedLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isComplete, setIsComplete] = useState(false);
  const [processing, setProcessing] = useState(false);
  const router = useRouter();
  const params = useParams();
  const { id, lessonId } = params;
  const supabase = createBrowserClient();

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push(`/login?next=/courses/${id}/lessons/${lessonId}`);
        return;
      }

      // Check enrollment
      const { data: enrollmentData } = await supabase
        .from('enrollments')
        .select('*')
        .eq('student_id', user.id)
        .eq('course_id', id)
        .maybeSingle();

      if (!enrollmentData || enrollmentData.status !== 'active') {
        router.push(`/courses/${id}`);
        return;
      }
      setEnrollment(enrollmentData);

      // Get lesson
      const { data: lessonData } = await supabase
        .from('lessons')
        .select('*')
        .eq('id', lessonId)
        .single();
      setLesson(lessonData);

      // Get course
      const { data: courseData } = await supabase
        .from('courses')
        .select('*')
        .eq('id', id)
        .single();
      setCourse(courseData);

      // Get all lessons for this course
      const { data: lessons } = await supabase
        .from('lessons')
        .select('*')
        .eq('course_id', id)
        .order('order_index', { ascending: true });
      setAllLessons(lessons || []);

      // Get completed lessons
      const { data: completed } = await supabase
        .from('lesson_progress')
        .select('lesson_id')
        .eq('student_id', user.id)
        .eq('completed', true);
      const completedIds = completed?.map(c => c.lesson_id) || [];
      setCompletedLessons(completedIds);
      setIsComplete(completedIds.includes(lessonId));

      setLoading(false);
    }

    loadData();
  }, [id, lessonId, router, supabase]);

  const handleMarkComplete = async () => {
    if (isComplete) return;
    setProcessing(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert('Please login first');
      setProcessing(false);
      return;
    }

    // Mark lesson as complete
    const { error } = await supabase
      .from('lesson_progress')
      .insert({
        student_id: user.id,
        lesson_id: lessonId,
        completed: true,
        completed_at: new Date(),
      });

    if (error) {
      alert('Error marking lesson as complete: ' + error.message);
      setProcessing(false);
      return;
    }

    // Add points for completing lesson
    await addPoints(user.id, 20, 'Completed a lesson', 'lesson_complete', lessonId);

    // Update local state
    setIsComplete(true);
    setCompletedLessons([...completedLessons, lessonId]);

    // Check if all lessons are complete (course completion)
    if (allLessons.every(l => [...completedLessons, lessonId].includes(l.id))) {
      // Course completed! Add bonus points
      await addPoints(user.id, 100, 'Completed full course', 'course_complete', id);

      // Check if certificate already exists
      const { data: existingCert } = await supabase
        .from('certificates')
        .select('id')
        .eq('student_id', user.id)
        .eq('course_id', id)
        .maybeSingle();

      if (!existingCert) {
        // Generate certificate number
        const certNumber = 'SBA-' + Math.random().toString(36).substring(2, 10).toUpperCase();
        
        await supabase
          .from('certificates')
          .insert({
            student_id: user.id,
            course_id: id,
            certificate_number: certNumber,
          });

        alert('🎉 Congratulations! You completed the course! You\'ve earned a certificate!');
      } else {
        alert('🎉 Congratulations! You completed the course!');
      }
    }

    setProcessing(false);
  };

  // Find current lesson index
  const currentIndex = allLessons.findIndex(l => l.id === lessonId);
  const prevLesson = currentIndex > 0 ? allLessons[currentIndex - 1] : null;
  const nextLesson = currentIndex < allLessons.length - 1 ? allLessons[currentIndex + 1] : null;

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen flex items-center justify-center">Loading lesson...</div>
        <Footer />
      </>
    );
  }

  if (!lesson) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen flex items-center justify-center">Lesson not found</div>
        <Footer />
      </>
    );
  }

  const progress = ((completedLessons.length / allLessons.length) * 100).toFixed(0);

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 py-8">

          {/* Progress bar */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-6">
            <div className="flex justify-between text-sm mb-2">
              <span className="font-bold text-gray-700">Progress</span>
              <span className="font-bold text-brand-blue">{progress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div className="bg-brand-yellow h-2.5 rounded-full" style={{ width: `${progress}%` }} />
            </div>
          </div>

          {/* Lesson content */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold text-brand-blue uppercase tracking-wider">
                  Lesson {currentIndex + 1} of {allLessons.length}
                </span>
                {isComplete && (
                  <span className="text-xs font-bold text-green-600 bg-green-50 px-3 py-1 rounded-full">
                    ✅ Completed
                  </span>
                )}
              </div>

              <h1 className="text-2xl font-extrabold text-gray-900 mb-4">{lesson.title}</h1>

              {/* Video content */}
              {lesson.content_type === 'video' && lesson.video_url && (
                <div className="rounded-xl overflow-hidden bg-black">
                  <video
                    src={lesson.video_url}
                    controls
                    className="w-full aspect-video"
                    playsInline
                  />
                </div>
              )}

              {/* Text content */}
              {lesson.content_type === 'text' && lesson.text_content && (
                <div className="prose max-w-none bg-gray-50 p-6 rounded-xl">
                  <div dangerouslySetInnerHTML={{ __html: lesson.text_content }} />
                </div>
              )}

              {/* PDF content */}
              {lesson.content_type === 'pdf' && lesson.pdf_url && (
                <div className="text-center py-8">
                  <p className="text-4xl mb-4">📄</p>
                  <p className="text-gray-600 mb-4">This lesson is a PDF document</p>
                  <a
                    href={lesson.pdf_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block bg-brand-blue text-white px-6 py-3 rounded-full font-bold hover:opacity-90"
                  >
                    📥 Open PDF
                  </a>
                </div>
              )}

              {!lesson.video_url && !lesson.text_content && !lesson.pdf_url && (
                <div className="text-center py-8 text-yellow-600">
                  <p className="text-2xl mb-2">⏳</p>
                  <p>Content coming soon!</p>
                </div>
              )}
            </div>
          </div>

          {/* Navigation buttons */}
          <div className="flex items-center justify-between mt-6">
            <div>
              {prevLesson && (
                <Link
                  href={`/courses/${id}/lessons/${prevLesson.id}`}
                  className="inline-block bg-gray-200 text-gray-700 px-6 py-3 rounded-full font-bold hover:bg-gray-300 transition"
                >
                  ← Previous
                </Link>
              )}
            </div>

            <button
              onClick={handleMarkComplete}
              disabled={isComplete || processing}
              className={`px-6 py-3 rounded-full font-bold transition ${
                isComplete
                  ? 'bg-green-100 text-green-700 cursor-default'
                  : processing
                  ? 'bg-gray-400 text-white cursor-not-allowed'
                  : 'bg-brand-yellow text-brand-dark hover:opacity-90'
              }`}
            >
              {isComplete ? '✅ Completed' : processing ? 'Processing...' : '✅ Mark as Complete'}
            </button>

            <div>
              {nextLesson && isComplete && (
                <Link
                  href={`/courses/${id}/lessons/${nextLesson.id}`}
                  className="inline-block bg-brand-blue text-white px-6 py-3 rounded-full font-bold hover:opacity-90 transition"
                >
                  Next →
                </Link>
              )}
            </div>
          </div>

          {/* Back to course */}
          <div className="mt-6 text-center">
            <Link
              href={`/courses/${id}`}
              className="text-brand-blue hover:underline font-semibold text-sm"
            >
              ← Back to Course
            </Link>
          </div>

        </div>
      </main>
      <Footer />
    </>
  );
}