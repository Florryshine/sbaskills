'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import LessonScreenPlayer from '@/components/LessonScreenPlayer';

export default function LessonPlayerPage() {
  const [lesson, setLesson] = useState(null);
  const [course, setCourse] = useState(null);
  const [enrollment, setEnrollment] = useState(null);
  const [allLessons, setAllLessons] = useState([]);
  const [completedLessons, setCompletedLessons] = useState([]);
  const [screens, setScreens] = useState([]);
  const [screenProgress, setScreenProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isComplete, setIsComplete] = useState(false);
  const [processing, setProcessing] = useState(false);
  const router = useRouter();
  const params = useParams();
  const { id, lessonId } = params;
  const supabase = createBrowserClient();

  useEffect(() => {
    async function loadData() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.push(`/login?next=/courses/${id}/lessons/${lessonId}`);
          return;
        }

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

        const { data: lessonData } = await supabase
          .from('lessons')
          .select('*')
          .eq('id', lessonId)
          .single();
        if (!lessonData) {
          router.push(`/courses/${id}`);
          return;
        }
        setLesson(lessonData);

        if (lessonData.content_type === 'bite_sized') {
          const { data: screenData } = await supabase
            .from('lesson_screens')
            .select('*')
            .eq('lesson_id', lessonId)
            .order('order_index', { ascending: true });
          setScreens(screenData || []);
        } else {
          setScreens([]);
        }

        const { data: courseData } = await supabase
          .from('courses')
          .select('*')
          .eq('id', id)
          .single();
        setCourse(courseData);

        const { data: lessons } = await supabase
          .from('lessons')
          .select('*')
          .eq('course_id', id)
          .order('order_index', { ascending: true });
        setAllLessons(lessons || []);

        const { data: completed } = await supabase
          .from('lesson_progress')
          .select('lesson_id')
          .eq('student_id', user.id)
          .eq('completed', true);
        const completedIds = completed?.map(c => c.lesson_id) || [];
        setCompletedLessons(completedIds);
        setIsComplete(completedIds.includes(lessonId));

        if (lessonData.content_type === 'bite_sized') {
          const { data: progressRow } = await supabase
            .from('lesson_progress')
            .select('current_screen_index, started_at, last_viewed_at, content_version, practice_attempts')
            .eq('student_id', user.id)
            .eq('lesson_id', lessonId)
            .maybeSingle();
          setScreenProgress(progressRow || null);
        } else {
          setScreenProgress(null);
        }

        setLoading(false);
      } catch (error) {
        console.error('Error loading lesson:', error);
        setLoading(false);
      }
    }

    loadData();
  }, [id, lessonId, router]);

  const handleScreenProgress = async ({ screenIndex, attempted = false, correct = false } = {}) => {
    if (!lesson || lesson.content_type !== 'bite_sized') return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const previousAttempts = screenProgress?.practice_attempts && typeof screenProgress.practice_attempts === 'object'
      ? screenProgress.practice_attempts
      : {};
    const nextAttempts = { ...previousAttempts };
    if (attempted) {
      const key = String(screenIndex);
      const prior = nextAttempts[key] || { attempts: 0, correct: 0 };
      nextAttempts[key] = {
        attempts: prior.attempts + 1,
        correct: prior.correct + (correct ? 1 : 0),
      };
    }

    const payload = {
      student_id: user.id,
      lesson_id: lessonId,
      current_screen_index: Math.max(0, Number.isInteger(screenIndex) ? screenIndex : 0),
      started_at: screenProgress?.started_at || new Date().toISOString(),
      last_viewed_at: new Date().toISOString(),
      content_version: lesson.content_version || 1,
      practice_attempts: nextAttempts,
    };

    const { data, error } = await supabase
      .from('lesson_progress')
      .upsert(payload, { onConflict: 'student_id,lesson_id' })
      .select('current_screen_index, started_at, last_viewed_at, content_version, practice_attempts')
      .single();

    if (!error && data) setScreenProgress(data);
  };

  const handleMarkComplete = async () => {
    if (isComplete) return;
    setProcessing(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert('Please login first');
        setProcessing(false);
        return;
      }

      const { data: completedProgress, error } = await supabase
        .from('lesson_progress')
        .upsert({
          student_id: user.id,
          lesson_id: lessonId,
          completed: true,
          completed_at: new Date().toISOString(),
          current_screen_index: lesson.content_type === 'bite_sized' ? Math.max(0, screens.length - 1) : 0,
          started_at: screenProgress?.started_at || new Date().toISOString(),
          last_viewed_at: new Date().toISOString(),
          content_version: lesson.content_version || 1,
          practice_attempts: screenProgress?.practice_attempts || {},
        }, { onConflict: 'student_id,lesson_id' })
        .select('current_screen_index, started_at, last_viewed_at, content_version, practice_attempts')
        .single();

      if (error) {
        alert('Error marking lesson as complete: ' + error.message);
        setProcessing(false);
        return;
      }

      if (completedProgress) setScreenProgress(completedProgress);
      setIsComplete(true);
      const updatedCompleted = completedLessons.includes(lessonId) ? completedLessons : [...completedLessons, lessonId];
      setCompletedLessons(updatedCompleted);

      try {
        const completionResponse = await fetch(`/api/courses/${id}/completion`, { method: 'POST' });
        const completion = await completionResponse.json();
        if (completionResponse.ok && completion.certificateIssued) {
          alert('🎉 Congratulations! You completed the course and earned a certificate!');
        } else if (completionResponse.ok && completion.courseComplete) {
          alert('🎉 Congratulations! You completed the course. Your certificate is ready.');
        }
      } catch (completionError) {
        console.error('Course completion check failed:', completionError);
      }

    } catch (error) {
      console.error('Error marking complete:', error);
      alert('An error occurred. Please try again.');
    }
    setProcessing(false);
  };

  const currentIndex = allLessons.findIndex(l => l.id === lessonId);
  const prevLesson = currentIndex > 0 ? allLessons[currentIndex - 1] : null;
  const nextLesson = currentIndex < allLessons.length - 1 ? allLessons[currentIndex + 1] : null;

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <p className="text-2xl mb-2">⏳</p>
            <p className="text-gray-500">Loading lesson...</p>
          </div>
        </div>
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

  const progress = allLessons.length > 0 ? Math.round((completedLessons.length / allLessons.length) * 100) : 0;

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-6">
            <div className="flex justify-between text-sm mb-2">
              <span className="font-bold text-gray-700">Progress</span>
              <span className="font-bold text-brand-blue">{progress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div className="bg-brand-yellow h-2.5 rounded-full" style={{ width: `${progress}%` }} />
            </div>
          </div>

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

              {lesson.content_type === 'bite_sized' ? (
                <LessonScreenPlayer
                  lesson={lesson}
                  screens={screens}
                  completed={isComplete}
                  initialScreenIndex={screenProgress?.current_screen_index || 0}
                  onProgress={handleScreenProgress}
                  onComplete={handleMarkComplete}
                  onExit={() => router.push(`/courses/${id}`)}
                />
              ) : (
                <>
                  {lesson.content_type === 'video' && lesson.video_url && (
                    <div className="rounded-xl overflow-hidden bg-black">
                      <video src={lesson.video_url} controls className="w-full aspect-video" playsInline />
                    </div>
                  )}

                  {lesson.content_type === 'text' && lesson.text_content && (
                    <div className="prose max-w-none bg-gray-50 p-6 rounded-xl">
                      <div dangerouslySetInnerHTML={{ __html: lesson.text_content }} />
                    </div>
                  )}

                  {lesson.content_type === 'pdf' && lesson.pdf_url && (
                    <div className="text-center py-8">
                      <p className="text-4xl mb-4">📄</p>
                      <p className="text-gray-600 mb-4">This lesson is a PDF document</p>
                      <a href={lesson.pdf_url} target="_blank" rel="noopener noreferrer"
                        className="inline-block bg-brand-blue text-white px-6 py-3 rounded-full font-bold hover:opacity-90">
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
                </>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between mt-6">
            <div>
              {prevLesson && (
                <Link href={`/courses/${id}/lessons/${prevLesson.id}`}
                  className="inline-block bg-gray-200 text-gray-700 px-6 py-3 rounded-full font-bold hover:bg-gray-300 transition">
                  ← Previous
                </Link>
              )}
            </div>

            <button
              onClick={handleMarkComplete}
              disabled={isComplete || processing}
              className={`px-6 py-3 rounded-full font-bold transition ${
                isComplete ? 'bg-green-100 text-green-700 cursor-default' :
                processing ? 'bg-gray-400 text-white cursor-not-allowed' :
                'bg-brand-yellow text-brand-dark hover:opacity-90'
              }`}>
              {isComplete ? '✅ Completed' : processing ? 'Processing...' : '✅ Mark as Complete'}
            </button>

            <div>
              {nextLesson && isComplete && (
                <Link href={`/courses/${id}/lessons/${nextLesson.id}`}
                  className="inline-block bg-brand-blue text-white px-6 py-3 rounded-full font-bold hover:opacity-90 transition">
                  Next →
                </Link>
              )}
            </div>
          </div>

          <div className="mt-6 text-center">
            <Link href={`/courses/${id}`} className="text-brand-blue hover:underline font-semibold text-sm">
              ← Back to Course
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}