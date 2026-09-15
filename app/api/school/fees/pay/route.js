import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';
import { koboFromNaira, paystackRequest } from '@/lib/school/paystack';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const { school: schoolSlug, student_id: studentId, fee_structure_id: feeStructureId } = body;
  if (!schoolSlug || !studentId || !feeStructureId) {
    return NextResponse.json({ error: 'school, student_id, and fee_structure_id are required.' }, { status: 400 });
  }

  const supabase = createRouteHandlerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const [{ data: profile }, { data: school }, { data: structure }] = await Promise.all([
    supabase.from('profiles').select('id, role, school_id, full_name, email').eq('id', user.id).single(),
    supabase.from('schools').select('id, slug, name, payment_account_status, paystack_subaccount_code').eq('slug', schoolSlug).single(),
    supabase.from('fee_structures').select('id, school_id, title, amount, term, session, class_level').eq('id', feeStructureId).single(),
  ]);
  if (!profile || !school || !structure || structure.school_id !== school.id) {
    return NextResponse.json({ error: 'School fee not found.' }, { status: 404 });
  }
  if (profile.role === 'parent') {
    const { data: link } = await supabase.from('parent_links').select('id').eq('parent_id', user.id).eq('student_id', studentId).eq('school_id', school.id).maybeSingle();
    if (!link) return NextResponse.json({ error: 'You can only pay for a linked child.' }, { status: 403 });
  } else if (profile.role === 'student') {
    if (profile.id !== studentId || profile.school_id !== school.id) {
      return NextResponse.json({ error: 'You can only pay your own school fees.' }, { status: 403 });
    }
  } else {
    return NextResponse.json({ error: 'Only a student or linked parent can pay school fees.' }, { status: 403 });
  }
  if (school.payment_account_status !== 'connected' || !school.paystack_subaccount_code) {
    return NextResponse.json({ error: 'This school has not connected its payment account yet.' }, { status: 409 });
  }

  const { data: payments } = await supabase
    .from('fee_payments')
    .select('amount, status')
    .eq('school_id', school.id)
    .eq('student_id', studentId)
    .eq('fee_structure_id', feeStructureId)
    .eq('status', 'confirmed');
  const paid = (payments || []).reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const owed = Number(structure.amount || 0);
  const balance = Math.max(owed - paid, 0);
  if (balance <= 0) return NextResponse.json({ error: 'This fee is already fully paid.' }, { status: 409 });

  const reference = `SBAFEE-${school.slug}-${crypto.randomUUID()}`;
  const callbackBase = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
  try {
    const transaction = await paystackRequest('/transaction/initialize', {
      method: 'POST',
      body: JSON.stringify({
        email: user.email || profile.email,
        amount: koboFromNaira(balance),
        currency: 'NGN',
        reference,
        subaccount: school.paystack_subaccount_code,
        bearer: 'subaccount',
        callback_url: `${callbackBase}/school/${encodeURIComponent(school.slug)}/fees/receipt?reference=${encodeURIComponent(reference)}`,
        metadata: { school_slug: school.slug, student_id: studentId, fee_structure_id: feeStructureId, payment_type: 'school_fee' },
      }),
    });
    const { data: pending, error: insertError } = await supabase.from('fee_payments').insert({
      school_id: school.id,
      student_id: studentId,
      fee_structure_id: feeStructureId,
      amount: balance,
      method: 'paystack',
      status: 'pending',
      paystack_reference: reference,
      paystack_subaccount_code: school.paystack_subaccount_code,
      note: 'Online Paystack school-fee payment',
      paid_at: null,
    }).select('id, amount, status, paystack_reference').single();
    if (insertError) throw insertError;
    return NextResponse.json({ authorization_url: transaction.authorization_url, reference: transaction.reference, payment: pending });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 502 });
  }
}
