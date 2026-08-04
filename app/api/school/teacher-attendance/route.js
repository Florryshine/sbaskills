import { NextResponse } from 'next/server';
import { requireSchoolStaff } from '@/lib/school/auth';

export const dynamic = 'force-dynamic';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// GET /api/school/teacher-attendance?school=<slug>&date=...
// Principals/admins see everyone's check-in/out for that day; a teacher
// viewing their own school sees the same list (read policy allows it),
// but the UI only needs their own row to show the check-in/out buttons.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const schoolSlug = searchParams.get('school');
  const date = searchParams.get('date') || todayStr();
  if (!schoolSlug) return NextResponse.json({ error: 'Missing school.' }, { status: 400 });

  const { supabase, school, error } = await requireSchoolStaff(schoolSlug);
  if (error) return NextResponse.json({ error: error.message }, { status: error.status });

  const { data, error: fetchError } = await supabase
    .from('teacher_attendance')
    .select('id, teacher_id, date, check_in_at, check_out_at, profiles:teacher_id(full_name, email)')
    .eq('school_id', school.id)
    .eq('date', date)
    .order('check_in_at', { ascending: true });

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
  return NextResponse.json({ records: data || [] });
}

// POST /api/school/teacher-attendance
// Body: { school, action: 'check_in' | 'check_out' }
// Always acts on the signed-in teacher's own record for today.
export async function POST(request) {
  const body = await request.json();
  const { school: schoolSlug, action } = body;
  if (!schoolSlug || !['check_in', 'check_out'].includes(action)) {
    return NextResponse.json({ error: 'Missing school or a valid action.' }, { status: 400 });
  }

  const { supabase, profile, school, error } = await requireSchoolStaff(schoolSlug);
  if (error) return NextResponse.json({ error: error.message }, { status: error.status });

  const date = todayStr();
  const now = new Date().toISOString();

  if (action === 'check_in') {
    const { data, error: upsertError } = await supabase
      .from('teacher_attendance')
      .upsert({
        school_id: school.id,
        teacher_id: profile.id,
        date,
        check_in_at: now,
      }, { onConflict: 'teacher_id,date', ignoreDuplicates: false })
      .select()
      .single();

    if (upsertError) return NextResponse.json({ error: upsertError.message }, { status: 500 });
    return NextResponse.json({ record: data });
  }

  // check_out: only fill in check_out_at on today's existing row.
  const { data: existing } = await supabase
    .from('teacher_attendance')
    .select('id')
    .eq('teacher_id', profile.id)
    .eq('date', date)
    .single();

  if (!existing) {
    return NextResponse.json({ error: 'Check in first before checking out.' }, { status: 400 });
  }

  const { data, error: updateError } = await supabase
    .from('teacher_attendance')
    .update({ check_out_at: now })
    .eq('id', existing.id)
    .select()
    .single();

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  return NextResponse.json({ record: data });
}
