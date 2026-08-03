import { NextResponse } from 'next/server';
import { requireSchoolStaff } from '@/lib/school/auth';
import { computeSubjectRow, computePositions, overallAverage, DEFAULT_SCALE } from '@/lib/school/grading';

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
//         teacher_comment, principal_comment, attendance_present, attendance_total }
// Upserts (one report card per student per term+session). Teachers only
// enter raw ca1/ca2/exam per subject -- total, grade, position, and class
// size are always computed here, never hand-typed.
export async function POST(request) {
  const body = await request.json();
  const {
    school: schoolSlug, student_id, term, session, class_level,
    subject_scores, teacher_comment, principal_comment,
    attendance_present, attendance_total,
  } = body;

  if (!schoolSlug || !student_id || !term || !session || !Array.isArray(subject_scores)) {
    return NextResponse.json({ error: 'Missing school, student_id, term, session, or subject_scores.' }, { status: 400 });
  }

  const { supabase, profile, school, error } = await requireSchoolStaff(schoolSlug);
  if (error) return NextResponse.json({ error: error.message }, { status: error.status });

  const { data: scaleRows } = await supabase
    .from('grading_scales')
    .select('min_score, max_score, grade, remark')
    .eq('school_id', school.id);
  const scale = scaleRows && scaleRows.length ? scaleRows : DEFAULT_SCALE;

  const computedScores = subject_scores.map(s => computeSubjectRow(s, scale));

  const { data, error: upsertError } = await supabase
    .from('report_cards')
    .upsert({
      school_id: school.id,
      student_id,
      term,
      session,
      class_level: class_level || null,
      subject_scores: computedScores,
      teacher_comment: teacher_comment || null,
      principal_comment: principal_comment || null,
      attendance_present: attendance_present ?? null,
      attendance_total: attendance_total ?? null,
      created_by: profile.id,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'student_id,term,session' })
    .select()
    .single();

  if (upsertError) return NextResponse.json({ error: upsertError.message }, { status: 500 });

  // Recompute class position for everyone in this class/term/session now
  // that one student's totals may have changed.
  if (class_level) {
    const { data: classCards } = await supabase
      .from('report_cards')
      .select('id, student_id, subject_scores')
      .eq('school_id', school.id)
      .eq('term', term)
      .eq('session', session)
      .eq('class_level', class_level);

    if (classCards && classCards.length) {
      const totals = classCards.map(c => ({
        student_id: c.student_id,
        total: (c.subject_scores || []).reduce((acc, r) => acc + (Number(r.total) || 0), 0),
      }));
      const positions = computePositions(totals);
      const classSize = classCards.length;

      await Promise.all(classCards.map(c =>
        supabase
          .from('report_cards')
          .update({ position_in_class: positions[c.student_id], class_size: classSize })
          .eq('id', c.id)
      ));

      data.position_in_class = positions[student_id];
      data.class_size = classSize;
    }
  }

  return NextResponse.json({ reportCard: data, average: overallAverage(computedScores) });
}
