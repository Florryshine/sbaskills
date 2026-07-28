import { NextResponse } from 'next/server';
import { requireSchoolStaff } from '@/lib/school/auth';

export const dynamic = 'force-dynamic';

// GET /api/school/fees?school=<slug>&term=...&session=...
// Returns every student with what they owe (matched by class_level, or a
// school-wide structure with class_level = null) vs what they've paid
// against that structure, so the UI can show an outstanding-balance list.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const schoolSlug = searchParams.get('school');
  const term = searchParams.get('term');
  const session = searchParams.get('session');

  if (!schoolSlug || !term || !session) {
    return NextResponse.json({ error: 'Missing school, term, or session.' }, { status: 400 });
  }

  const { supabase, school, error } = await requireSchoolStaff(schoolSlug);
  if (error) return NextResponse.json({ error: error.message }, { status: error.status });

  const { data: structures } = await supabase
    .from('fee_structures')
    .select('id, class_level, title, amount, due_date')
    .eq('school_id', school.id)
    .eq('term', term)
    .eq('session', session);

  const { data: students } = await supabase
    .from('profiles')
    .select('id, full_name, email, student_level')
    .eq('school_id', school.id)
    .eq('role', 'student')
    .order('full_name');

  const structureIds = (structures || []).map(s => s.id);
  let payments = [];
  if (structureIds.length > 0) {
    const { data: paymentRows } = await supabase
      .from('fee_payments')
      .select('student_id, fee_structure_id, amount')
      .eq('school_id', school.id)
      .in('fee_structure_id', structureIds);
    payments = paymentRows || [];
  }

  const balances = (students || []).map(student => {
    const structure = (structures || []).find(
      s => s.class_level === student.student_level || s.class_level === null
    );
    const owed = structure ? Number(structure.amount) : 0;
    const paid = payments
      .filter(p => p.student_id === student.id && (!structure || p.fee_structure_id === structure.id))
      .reduce((sum, p) => sum + Number(p.amount), 0);

    return {
      student_id: student.id,
      full_name: student.full_name,
      email: student.email,
      class_level: student.student_level,
      fee_structure_id: structure?.id || null,
      fee_title: structure?.title || null,
      due_date: structure?.due_date || null,
      amount_owed: owed,
      amount_paid: paid,
      balance: Math.max(owed - paid, 0),
      status: !structure ? 'no_fee_set' : paid >= owed ? 'paid' : paid > 0 ? 'partial' : 'unpaid',
    };
  });

  return NextResponse.json({ balances, structures: structures || [] });
}

// POST /api/school/fees
// Body: { school, student_id, fee_structure_id, amount, method, note }
export async function POST(request) {
  const body = await request.json();
  const { school: schoolSlug, student_id, fee_structure_id, amount, method, note } = body;

  if (!schoolSlug || !student_id || !amount) {
    return NextResponse.json({ error: 'Missing school, student_id, or amount.' }, { status: 400 });
  }

  const { supabase, profile, school, error } = await requireSchoolStaff(schoolSlug);
  if (error) return NextResponse.json({ error: error.message }, { status: error.status });

  const { data, error: insertError } = await supabase
    .from('fee_payments')
    .insert({
      school_id: school.id,
      student_id,
      fee_structure_id: fee_structure_id || null,
      amount,
      method: method || 'cash',
      note: note || null,
      recorded_by: profile.id,
    })
    .select()
    .single();

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
  return NextResponse.json({ payment: data });
}
