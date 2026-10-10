import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';

export async function POST(request) {
  try {
    const { courseId, reference } = await request.json();
    const supabase = createRouteHandlerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ success: false, message: 'You must be logged in to enroll.' }, { status: 401 });
    if (!courseId) return NextResponse.json({ success: false, message: 'Missing course.' }, { status: 400 });

    const { data: course, error: courseError } = await supabase.from('courses').select('id, price').eq('id', courseId).single();
    if (courseError || !course) return NextResponse.json({ success: false, message: 'Course not found.' }, { status: 404 });
    const price = Number(course.price);
    if (!Number.isFinite(price) || price < 0) return NextResponse.json({ success: false, message: 'Invalid course price.' }, { status: 400 });

    const { data: existing } = await supabase.from('enrollments').select('id').eq('student_id', user.id).eq('course_id', courseId).eq('status', 'active').maybeSingle();
    if (existing) return NextResponse.json({ success: true, alreadyEnrolled: true });

    // Only the server-side course price determines whether the course is free.
    if (price === 0) {
      const { error: insertError } = await supabase.from('enrollments').insert({ student_id: user.id, course_id: courseId, amount_paid: 0, status: 'active', payment_type: 'free' });
      if (insertError) {
        console.error('Free enrollment insert failed:', insertError);
        return NextResponse.json({ success: false, message: 'Could not complete enrollment. Please try again.' }, { status: 500 });
      }
      return NextResponse.json({ success: true });
    }
    if (typeof reference !== 'string' || !reference.trim()) return NextResponse.json({ success: false, message: 'Missing payment reference.' }, { status: 400 });
    if (!process.env.PAYSTACK_SECRET_KEY) return NextResponse.json({ success: false, message: 'Payment verification is not configured.' }, { status: 503 });

    const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` }, cache: 'no-store',
    });
    if (!response.ok) return NextResponse.json({ success: false, message: 'Could not verify payment with Paystack.' }, { status: 502 });
    const result = await response.json();
    const transaction = result?.data;
    if (!result?.status || !transaction || transaction.status !== 'success') return NextResponse.json({ success: false, message: 'Payment verification failed.' }, { status: 400 });
    if (String(transaction.currency || '').toUpperCase() !== 'NGN') return NextResponse.json({ success: false, message: 'Payment currency does not match.' }, { status: 400 });
    if (Number(transaction.amount) < Math.round(price * 100)) return NextResponse.json({ success: false, message: 'The verified payment is below the course price.' }, { status: 400 });
    if (String(transaction.customer?.email || '').toLowerCase() !== String(user.email || '').toLowerCase()) return NextResponse.json({ success: false, message: 'This payment does not match your signed-in account.' }, { status: 403 });

    const { data: duplicateReference } = await supabase.from('enrollments').select('id').eq('payment_reference', reference).maybeSingle();
    if (duplicateReference) return NextResponse.json({ success: false, message: 'This payment reference has already been used.' }, { status: 409 });
    const { error: insertError } = await supabase.from('enrollments').insert({ student_id: user.id, course_id: courseId, payment_reference: reference, amount_paid: Number(transaction.amount) / 100, status: 'active', payment_type: 'paystack' });
    if (insertError) {
      console.error('Paid enrollment insert failed:', insertError);
      return NextResponse.json({ success: false, message: 'Payment was verified but enrollment could not be recorded. Contact support with your payment reference.' }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Payment verification error:', error);
    return NextResponse.json({ success: false, message: 'Unable to verify payment right now.' }, { status: 500 });
  }
}