import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';

// Previously broken end-to-end: EnrollButton.js sent { courseId, reference }
// but this route read { course_id, student_id, amount } — course_id never
// matched (camelCase vs snake_case) and student_id was never sent at all,
// so every paid enrollment silently failed to record after a real charge.
// Fixed by: accepting courseId as sent, deriving the student from the
// authenticated session instead of trusting a client-supplied id (also
// closes a spoofing hole), and looking up price server-side instead of
// trusting a client-supplied amount.
export async function POST(request) {
  try {
    const { courseId, reference, free } = await request.json();
    const supabase = createRouteHandlerClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, message: 'You must be logged in to enroll.' }, { status: 401 });
    }

    if (!courseId) {
      return NextResponse.json({ success: false, message: 'Missing course.' }, { status: 400 });
    }

    // Don't double-enroll on a retry / page refresh.
    const { data: existing } = await supabase
      .from('enrollments')
      .select('id')
      .eq('student_id', user.id)
      .eq('course_id', courseId)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ success: true, alreadyEnrolled: true });
    }

    const { data: course } = await supabase
      .from('courses')
      .select('id, price')
      .eq('id', courseId)
      .single();

    if (!course) {
      return NextResponse.json({ success: false, message: 'Course not found.' }, { status: 404 });
    }

    if (free || Number(course.price) === 0) {
      await supabase.from('enrollments').insert({
        student_id: user.id,
        course_id: courseId,
        amount_paid: 0,
        status: 'active',
        payment_type: 'free',
      });
      return NextResponse.json({ success: true });
    }

    if (!reference) {
      return NextResponse.json({ success: false, message: 'Missing payment reference.' }, { status: 400 });
    }

    // Verify with Paystack
    const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      },
    });

    const data = await response.json();

    if (!data?.data) {
      return NextResponse.json({ success: false, message: 'Could not verify payment with Paystack.' }, { status: 502 });
    }

    // Amount actually charged (kobo -> naira) must cover the course price —
    // never trust a client-supplied amount for what gets recorded.
    const amountPaid = data.data.amount / 100;
    if (data.data.status === 'success' && amountPaid >= Number(course.price)) {
      await supabase.from('enrollments').insert({
        student_id: user.id,
        course_id: courseId,
        payment_reference: reference,
        amount_paid: amountPaid,
        status: 'active',
        payment_type: 'paystack',
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, message: 'Payment verification failed' });
  } catch (error) {
    console.error('Payment verification error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}