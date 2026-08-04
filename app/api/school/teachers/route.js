import { NextResponse } from 'next/server';
import { requireSchoolStaff } from '@/lib/school/auth';

export const dynamic = 'force-dynamic';

// GET /api/school/teachers?school=<slug>
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const schoolSlug = searchParams.get('school');
  if (!schoolSlug) return NextResponse.json({ error: 'Missing school.' }, { status: 400 });

  const { supabase, school, error } = await requireSchoolStaff(schoolSlug);
  if (error) return NextResponse.json({ error: error.message }, { status: error.status });

  const { data, error: fetchError } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, assigned_classes, is_active, created_at')
    .eq('school_id', school.id)
    .in('role', ['teacher', 'principal'])
    .order('full_name');

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
  return NextResponse.json({ teachers: data || [] });
}

// PATCH /api/school/teachers
// Body: { school, teacher_id, assigned_classes: ['SS1','SS2'] }
// Principal-only in practice (requireSchoolStaff allows teachers too, but
// a teacher has no UI path to call this against another teacher).
export async function PATCH(request) {
  const body = await request.json();
  const { school: schoolSlug, teacher_id, assigned_classes } = body;

  if (!schoolSlug || !teacher_id || !Array.isArray(assigned_classes)) {
    return NextResponse.json({ error: 'Missing school, teacher_id, or assigned_classes.' }, { status: 400 });
  }

  const { supabase, school, error } = await requireSchoolStaff(schoolSlug);
  if (error) return NextResponse.json({ error: error.message }, { status: error.status });

  const { data, error: updateError } = await supabase
    .from('profiles')
    .update({ assigned_classes })
    .eq('id', teacher_id)
    .eq('school_id', school.id)
    .select()
    .single();

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  return NextResponse.json({ teacher: data });
}
