import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';
import { createAdminClient } from '@/lib/supabase-admin';
import { verifyPaystackTransaction } from '@/lib/paystack';

export async function POST(request) {
  try {
    const supabase = createRouteHandlerClient();
    const adminSupabase = createAdminClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const body = await request.json();
    const { courseId, reference, free = false } = body;

    if (!courseId) {
      return NextResponse.json({ error: 'Course ID is required.' }, { status: 400 });
    }

    const { data: course } = await adminSupabase.from('courses').select('*').eq('id', courseId).single();

    if (!course) {
      return NextResponse.json({ error: 'Course not found.' }, { status: 404 });
    }

    const { data: existingEnrollment } = await adminSupabase
      .from('enrollments')
      .select('id')
      .eq('student_id', user.id)
      .eq('course_id', courseId)
      .maybeSingle();

    if (existingEnrollment) {
      return NextResponse.json({ success: true, already_enrolled: true });
    }

    let paymentReference = null;
    let amountPaid = Number(course.price || 0);

    if (Number(course.price) === 0 || free) {
      paymentReference = `FREE-${courseId}-${user.id}`;
      amountPaid = 0;
    } else {
      const transaction = await verifyPaystackTransaction(reference);

      if (transaction.status !== 'success') {
        return NextResponse.json({ error: 'Payment was not successful.' }, { status: 400 });
      }

      if (Number(transaction.amount) !== Number(course.price) * 100) {
        return NextResponse.json({ error: 'Payment amount does not match course price.' }, { status: 400 });
      }

      if (transaction.customer?.email?.toLowerCase() !== user.email?.toLowerCase()) {
        return NextResponse.json({ error: 'Payment email does not match the logged in user.' }, { status: 400 });
      }

      paymentReference = transaction.reference;
      amountPaid = Number(transaction.amount) / 100;
    }

    const { error: enrollmentError } = await adminSupabase.from('enrollments').insert({
      student_id: user.id,
      course_id: courseId,
      payment_reference: paymentReference,
      amount_paid: amountPaid
    });

    if (enrollmentError) {
      throw enrollmentError;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Unable to verify payment.' }, { status: 500 });
  }
}
