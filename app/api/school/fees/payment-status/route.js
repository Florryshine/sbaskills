import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const reference = new URL(request.url).searchParams.get('reference');
  if (!reference) return NextResponse.json({ error: 'Missing reference.' }, { status: 400 });
  const supabase = createRouteHandlerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  const { data: payment, error } = await supabase
    .from('fee_payments')
    .select('id, amount, status, receipt_number, paid_at, paystack_reference, school_id, student_id, fee_structure_id')
    .eq('paystack_reference', reference)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!payment) return NextResponse.json({ error: 'Payment not found or not accessible.' }, { status: 404 });
  return NextResponse.json({
    status: payment.status,
    amount: Number(payment.amount || 0),
    receipt_number: payment.receipt_number,
    paid_at: payment.paid_at,
    reference: payment.paystack_reference,
  });
}
