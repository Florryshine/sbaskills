import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';

export async function POST(request) {
  try {
    const { reference, course_id, student_id, amount } = await request.json();
    const supabase = createRouteHandlerClient();

    // Verify with Paystack
    const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      },
    });

    const data = await response.json();

    if (data.data.status === 'success') {
      // Create enrollment
      await supabase.from('enrollments').insert({
        student_id: student_id,
        course_id: course_id,
        payment_reference: reference,
        amount_paid: data.data.amount / 100,
        status: 'active',
        payment_type: 'paystack',
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, message: 'Payment verification failed' });
  } catch (error) {
    console.error('Payment verification error:', error);
    return NextResponse.json({ success: false, message: error.message });
  }
}