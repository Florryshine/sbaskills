import { NextResponse } from 'next/server';
import { requireSchoolStaff } from '@/lib/school/auth';

export const dynamic = 'force-dynamic';

// GET /api/school/fees/structures?school=<slug>
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const schoolSlug = searchParams.get('school');
  if (!schoolSlug) return NextResponse.json({ error: 'Missing school.' }, { status: 400 });

  const { supabase, school, error } = await requireSchoolStaff(schoolSlug);
  if (error) return NextResponse.json({ error: error.message }, { status: error.status });

  const { data, error: fetchError } = await supabase
    .from('fee_structures')
    .select('id, term, session, class_level, title, amount, due_date, created_at')
    .eq('school_id', school.id)
    .order('created_at', { ascending: false });

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
  return NextResponse.json({ structures: data || [] });
}

// POST /api/school/fees/structures
// Body: { school, term, session, class_level, title, amount, due_date }
export async function POST(request) {
  const body = await request.json();
  const { school: schoolSlug, term, session, class_level, title, amount, due_date } = body;

  if (!schoolSlug || !term || !session || !amount) {
    return NextResponse.json({ error: 'Missing school, term, session, or amount.' }, { status: 400 });
  }

  const { supabase, profile, school, error } = await requireSchoolStaff(schoolSlug);
  if (error) return NextResponse.json({ error: error.message }, { status: error.status });

  const { data, error: insertError } = await supabase
    .from('fee_structures')
    .insert({
      school_id: school.id,
      term,
      session,
      class_level: class_level || null,
      title: title || 'School Fees',
      amount,
      due_date: due_date || null,
      created_by: profile.id,
    })
    .select()
    .single();

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
  return NextResponse.json({ structure: data });
}
