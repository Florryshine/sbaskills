import { NextResponse } from 'next/server';
import { requireSchoolStaff } from '@/lib/school/auth';

export const dynamic = 'force-dynamic';

// GET /api/school/observations?school=<slug>&student_id=...&date=...&limit=...
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const schoolSlug = searchParams.get('school');
  const studentId = searchParams.get('student_id');
  const date = searchParams.get('date');
  const limit = Number(searchParams.get('limit')) || 50;
  if (!schoolSlug) return NextResponse.json({ error: 'Missing school.' }, { status: 400 });

  const { supabase, school, error } = await requireSchoolStaff(schoolSlug);
  if (error) return NextResponse.json({ error: error.message }, { status: error.status });

  let query = supabase
    .from('student_observations')
    .select('id, student_id, date, status, note, created_at, observed_by, profiles:student_id(full_name, student_level), teacher:observed_by(full_name)')
    .eq('school_id', school.id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (studentId) query = query.eq('student_id', studentId);
  if (date) query = query.eq('date', date);

  const { data, error: fetchError } = await query;
  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
  return NextResponse.json({ observations: data || [] });
}

// POST /api/school/observations
// Body: { school, student_id, status, note?, date? }
export async function POST(request) {
  const body = await request.json();
  const { school: schoolSlug, student_id, status, note, date } = body;

  const validStatuses = ['present', 'absent', 'sick', 'improving', 'excellent', 'needs_attention', 'misbehaving', 'other'];
  if (!schoolSlug || !student_id || !status || !validStatuses.includes(status)) {
    return NextResponse.json({ error: 'Missing school, student_id, or a valid status.' }, { status: 400 });
  }

  const { supabase, profile, school, error } = await requireSchoolStaff(schoolSlug);
  if (error) return NextResponse.json({ error: error.message }, { status: error.status });

  const { data, error: insertError } = await supabase
    .from('student_observations')
    .insert({
      school_id: school.id,
      student_id,
      observed_by: profile.id,
      date: date || new Date().toISOString().slice(0, 10),
      status,
      note: note || null,
    })
    .select()
    .single();

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
  return NextResponse.json({ observation: data });
}
