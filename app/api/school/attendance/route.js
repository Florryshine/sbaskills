import { NextResponse } from 'next/server';
import { requireSchoolStaff } from '@/lib/school/auth';

export const dynamic = 'force-dynamic';

// GET /api/school/attendance?school=<slug>&date=YYYY-MM-DD&class=SS1
// Returns every student in the school (optionally filtered by class),
// each with their attendance status for the given date (or null if not
// yet marked), so the UI can render a full mark-sheet in one call.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const schoolSlug = searchParams.get('school');
  const date = searchParams.get('date') || new Date().toISOString().slice(0, 10);
  const classLevel = searchParams.get('class');

  if (!schoolSlug) {
    return NextResponse.json({ error: 'Missing school.' }, { status: 400 });
  }

  const { supabase, school, error } = await requireSchoolStaff(schoolSlug);
  if (error) return NextResponse.json({ error: error.message }, { status: error.status });

  let studentQuery = supabase
    .from('profiles')
    .select('id, full_name, email, student_level')
    .eq('school_id', school.id)
    .eq('role', 'student')
    .order('full_name');

  if (classLevel) studentQuery = studentQuery.eq('student_level', classLevel);

  const { data: students, error: studentsError } = await studentQuery;
  if (studentsError) {
    return NextResponse.json({ error: studentsError.message }, { status: 500 });
  }

  const { data: records } = await supabase
    .from('attendance_records')
    .select('student_id, status')
    .eq('school_id', school.id)
    .eq('date', date);

  const statusByStudent = Object.fromEntries((records || []).map(r => [r.student_id, r.status]));

  return NextResponse.json({
    date,
    students: (students || []).map(s => ({ ...s, status: statusByStudent[s.id] || null })),
  });
}

// POST /api/school/attendance
// Body: { school: <slug>, date: 'YYYY-MM-DD', records: [{ student_id, status }] }
// Upserts one row per student for that date. status is 'present' | 'absent' | 'late'.
export async function POST(request) {
  const body = await request.json();
  const { school: schoolSlug, date, records } = body;

  if (!schoolSlug || !date || !Array.isArray(records) || records.length === 0) {
    return NextResponse.json({ error: 'Missing school, date, or records.' }, { status: 400 });
  }

  const { supabase, profile, school, error } = await requireSchoolStaff(schoolSlug);
  if (error) return NextResponse.json({ error: error.message }, { status: error.status });

  const validStatuses = new Set(['present', 'absent', 'late']);
  const rows = records
    .filter(r => r.student_id && validStatuses.has(r.status))
    .map(r => ({
      school_id: school.id,
      student_id: r.student_id,
      class_level: r.class_level || null,
      date,
      status: r.status,
      marked_by: profile.id,
    }));

  if (rows.length === 0) {
    return NextResponse.json({ error: 'No valid records to save.' }, { status: 400 });
  }

  const { error: upsertError } = await supabase
    .from('attendance_records')
    .upsert(rows, { onConflict: 'student_id,date' });

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, saved: rows.length });
}
