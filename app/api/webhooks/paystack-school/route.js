import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { naira } from '@/lib/school/notify';
import { sendEmail } from '@/lib/school/notify';

export const dynamic = 'force-dynamic';

function signatureMatches(rawBody, signature) {
  if (!process.env.PAYSTACK_SECRET_KEY || !signature) return false;
  const expected = crypto.createHmac('sha512', process.env.PAYSTACK_SECRET_KEY).update(rawBody).digest('hex');
  const received = Buffer.from(String(signature), 'utf8');
  const expectedBuffer = Buffer.from(expected, 'utf8');
  return received.length === expectedBuffer.length && crypto.timingSafeEqual(received, expectedBuffer);
}

function receiptNumber() {
  return `SBA-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

export async function POST(request) {
  const rawBody = await request.text();
  if (!signatureMatches(rawBody, request.headers.get('x-paystack-signature'))) {
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 401 });
  }
  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }
  const reference = event?.data?.reference;
  if (event?.event !== 'charge.success' || typeof reference !== 'string' || !reference.startsWith('SBAFEE-')) {
    return NextResponse.json({ received: true, ignored: true });
  }

  const admin = createAdminClient();
  const { data: payment, error: paymentError } = await admin
    .from('fee_payments')
    .select('id, school_id, student_id, fee_structure_id, amount, status, receipt_number, paystack_subaccount_code')
    .eq('paystack_reference', reference)
    .maybeSingle();
  if (paymentError) return NextResponse.json({ error: paymentError.message }, { status: 500 });
  if (!payment) return NextResponse.json({ received: true, ignored: true });
  if (payment.status === 'confirmed' && payment.receipt_number) {
    return NextResponse.json({ received: true, idempotent: true, receipt_number: payment.receipt_number });
  }

  const [{ data: school }, { data: student }] = await Promise.all([
    admin.from('schools').select('id, slug, name, platform_fee_percent').eq('id', payment.school_id).single(),
    admin.from('profiles').select('id, full_name, email').eq('id', payment.student_id).single(),
  ]);
  if (!school) return NextResponse.json({ error: 'School not found.' }, { status: 500 });
  const paidAmount = Number(payment.amount || Number(event.data.amount || 0) / 100);
  const platformFee = Number((paidAmount * Number(school.platform_fee_percent || 5) / 100).toFixed(2));
  const receipt = payment.receipt_number || receiptNumber();
  const { error: updateError } = await admin.from('fee_payments').update({
    status: 'confirmed',
    paid_at: event.data.paid_at || new Date().toISOString(),
    receipt_number: receipt,
    platform_fee_amount: platformFee,
    paystack_subaccount_code: payment.paystack_subaccount_code || event.data.subaccount?.subaccount_code || null,
  }).eq('id', payment.id).eq('status', 'pending');
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  const { error: notificationError } = await admin.from('school_notifications').insert({
    school_id: school.id,
    type: 'fee_payment',
    title: 'Fee payment received',
    body: `${student?.full_name || 'A parent'} paid ${naira(paidAmount)}. Receipt ${receipt}.`,
    link: `/school/${school.slug}/fees/receipt?reference=${encodeURIComponent(reference)}`,
  });
  if (notificationError) console.error('[school-payment-webhook] notification failed', notificationError);

  if (student?.email || event.data.customer?.email) {
    try {
      await sendEmail({
        to: student?.email || event.data.customer.email,
        subject: `${school.name} fee payment receipt ${receipt}`,
        html: `<p>We received your school-fee payment of <strong>${naira(paidAmount)}</strong>.</p><p>Receipt number: <strong>${receipt}</strong></p><p>Thank you.</p>`,
      });
    } catch (error) {
      console.error('[school-payment-webhook] receipt email failed', error);
    }
  }
  return NextResponse.json({ received: true, receipt_number: receipt });
}
