import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';

// Mirrors /api/verify-payment (courses), but for books — kept as its own
// route rather than editing the course route, so the existing, working
// course payment flow is never put at risk by a book-specific change.
export async function POST(request) {
  try {
    const { reference, book_id, student_id, amount } = await request.json();
    const supabase = createRouteHandlerClient();

    // Verify with Paystack
    const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      },
    });

    const data = await response.json();

    if (data.data.status === 'success') {
      // Record the purchase
      await supabase.from('book_purchases').insert({
        student_id: student_id,
        book_id: book_id,
        payment_reference: reference,
        amount_paid: data.data.amount / 100,
        status: 'active',
        payment_type: 'paystack',
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, message: 'Payment verification failed' });
  } catch (error) {
    console.error('Book payment verification error:', error);
    return NextResponse.json({ success: false, message: error.message });
  }
}
