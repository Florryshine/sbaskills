import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';

function generateCertificateNumber() {
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `SBA-${new Date().getUTCFullYear()}-${Date.now().toString(36).toUpperCase()}-${suffix}`;
}

export async function POST(request, { params }) {
  const supabase = createRouteHandlerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  const courseId = params?.id;
  if (!courseId) return NextResponse.json({ error: 'Course id is required.' }, { status: 400 });

  const { data: enrollment } = await supabase
    .from('enrollments')
    .select('id, status')
    .eq('student_id', user.id)
    .eq('course_id', courseId)
    .maybeSingle();

  if (!enrollment || enrollment.status !== 'active') {
    return NextResponse.json({ error: 'Active enrollment required.' }, { status: 403 });
  }

  const { data: lessons, error: lessonError } = await supabase
    .from('lessons')
    .select('id')
    .eq('course_id', courseId)
    .eq('is_published', true)
    .order('order_index', { ascending: true });

  if (lessonError) return NextResponse.json({ error: lessonError.message }, { status: 500 });

  const lessonIds = (lessons || []).map((lesson) => lesson.id);
  if (lessonIds.length === 0) {
    return NextResponse.json({ courseComplete: false, completedLessonCount: 0, requiredLessonCount: 0 });
  }

  const { data: completedRows, error: progressError } = await supabase
    .from('lesson_progress')
    .select('lesson_id')
    .eq('student_id', user.id)
    .eq('completed', true)
    .in('lesson_id', lessonIds);

  if (progressError) return NextResponse.json({ error: progressError.message }, { status: 500 });

  const completedLessonIds = [...new Set((completedRows || []).map((row) => row.lesson_id))];
  const courseComplete = completedLessonIds.length === lessonIds.length;
  if (!courseComplete) {
    return NextResponse.json({
      courseComplete: false,
      completedLessonCount: completedLessonIds.length,
      requiredLessonCount: lessonIds.length,
    });
  }

  const { data: existingCertificate, error: certificateLookupError } = await supabase
    .from('certificates')
    .select('id, certificate_number, issued_at')
    .eq('student_id', user.id)
    .eq('course_id', courseId)
    .maybeSingle();

  if (certificateLookupError) {
    return NextResponse.json({ error: certificateLookupError.message }, { status: 500 });
  }

  if (existingCertificate) {
    return NextResponse.json({
      courseComplete: true,
      certificateIssued: false,
      certificate: existingCertificate,
      completedLessonCount: completedLessonIds.length,
      requiredLessonCount: lessonIds.length,
    });
  }

  const { data: certificate, error: certificateError } = await supabase
    .from('certificates')
    .insert({
      student_id: user.id,
      course_id: courseId,
      certificate_number: generateCertificateNumber(),
    })
    .select('id, certificate_number, issued_at')
    .single();

  if (certificateError) {
    // A unique race may mean another request issued the certificate first.
    const { data: racedCertificate } = await supabase
      .from('certificates')
      .select('id, certificate_number, issued_at')
      .eq('student_id', user.id)
      .eq('course_id', courseId)
      .maybeSingle();
    if (racedCertificate) {
      return NextResponse.json({ courseComplete: true, certificateIssued: false, certificate: racedCertificate });
    }
    return NextResponse.json({ error: certificateError.message }, { status: 500 });
  }

  return NextResponse.json({
    courseComplete: true,
    certificateIssued: true,
    certificate,
    completedLessonCount: completedLessonIds.length,
    requiredLessonCount: lessonIds.length,
  });
}
