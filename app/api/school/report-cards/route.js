import { NextResponse } from 'next/server';
import { requireSchoolStaff } from '@/lib/school/auth';

export const dynamic = 'force-dynamic';

// GET /api/school/report-cards?school=<slug>&term=...&session=...&student_id=...
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const schoolSlug = searchParams.get('school');
  const term = searchParams.get('term');
  const session = searchParams.get('session');
  const studentId = searchParams.get('student_id');

  if (!schoolSlug) return NextResponse.json({ error: 'Missing school.' }, { status: 400 });

  const { supabase, school, error } = await requireSchoolStaff(schoolSlug);
  if (error) return NextResponse.json({ error: error.message }, { status: error.status });

  let query = supabase
    .from('report_cards')
    .select('id, student_id, term, session, class_level, subject_scores, teacher_comment, principal_comment, position_in_class, class_size, attendance_present, attendance_total, created_at, profiles:student_id(full_name, email, student_level)')
    .eq('school_id', school.id)
    .order('created_at', { ascending: false });

  if (term) query = query.eq('term', term);
  if (session) query = query.eq('session', session);
  if (studentId) query = query.eq('student_id', studentId);

  const { data, error: fetchError } = await query;
  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
  return NextResponse.json({ reportCards: data || [] });
}

// POST /api/school/report-cards
// Body: { school, student_id, term, session, class_level, subject_scores,
//         teacher_comment, principal_comment, position_in_class, class_size,
//         attendance_present, attendance_total }
// Upserts (one report card per student per term+session).
export async function POST(request) {
  const body = await request.json();
  const {
    school: schoolSlug, student_id, term, session, class_level,
    subject_scores, teacher_comment, principal_comment,
    position_in_class, class_size, attendance_present, attendance_total,
  } = body;

  if (!schoolSlug || !student_id || !term || !session || !Array.isArray(subject_scores)) {
    return NextResponse.json({ error: 'Missing school, student_id, term, session, or subject_scores.' }, { status: 400 });
  }

  const { supabase, profile, school, error } = await requireSchoolStaff(schoolSlug);
  if (error) return NextResponse.json({ error: error.message }, { status: error.status });

  const { data, error: upsertError } = await supabase
    .from('report_cards')
    .upsert({
      school_id: school.id,
      student_id,
      term,
      session,
      class_level: class_level || null,
      subject_scores,
      teacher_comment: teacher_comment || null,
      principal_comment: principal_comment || null,
      position_in_class: position_in_class || null,
      class_size: class_size || null,
      attendance_present: attendance_present ?? null,
      attendance_total: attendance_total ?? null,
      created_by: profile.id,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'student_id,term,session' })
    .select()
    .single();

  if (upsertError) return NextResponse.json({ error: upsertError.message }, { status: 500 });
  return NextResponse.json({ reportCard: data });
}
