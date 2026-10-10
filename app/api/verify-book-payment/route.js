import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';

export async function POST(request) {
  try {
    const { reference, book_id } = await request.json();
    const supabase = createRouteHandlerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ success: false, message: 'Please sign in before purchasing a book.' }, { status: 401 });
    if (typeof reference !== 'string' || !reference.trim() || !book_id) return NextResponse.json({ success: false, message: 'Missing payment reference or book.' }, { status: 400 });

    const { data: book, error: bookError } = await supabase.from('books').select('id, price, is_published').eq('id', book_id).single();
    if (bookError || !book || book.is_published !== true) return NextResponse.json({ success: false, message: 'Published book not found.' }, { status: 404 });
    const price = Number(book.price);
    if (!Number.isFinite(price) || price <= 0) return NextResponse.json({ success: false, message: 'This book does not require a paid purchase.' }, { status: 400 });

    const { data: existing } = await supabase.from('book_purchases').select('id').eq('student_id', user.id).eq('book_id', book_id).eq('status', 'active').maybeSingle();
    if (existing) return NextResponse.json({ success: true, alreadyPurchased: true });

    if (!process.env.PAYSTACK_SECRET_KEY) {
      return NextResponse.json({ success: false, message: 'Payment verification is not configured.' }, { status: 503 });
    }

    if (!process.env.PAYSTACK_SECRET_KEY) {
      return NextResponse.json({ success: false, message: 'Payment verification is not configured.' }, { status: 503 });
    }

    const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` }, cache: 'no-store',
    });
    if (!response.ok) return NextResponse.json({ success: false, message: 'Could not verify payment with Paystack.' }, { status: 502 });
    const result = await response.json();
    const transaction = result?.data;
    if (!result?.status || !transaction || transaction.status !== 'success') return NextResponse.json({ success: false, message: 'Payment verification failed.' }, { status: 400 });
    if (String(transaction.currency || '').toUpperCase() !== 'NGN') return NextResponse.json({ success: false, message: 'Payment currency does not match.' }, { status: 400 });
    if (Number(transaction.amount) < Math.round(price * 100)) return NextResponse.json({ success: false, message: 'The verified payment is below the book price.' }, { status: 400 });
    if (String(transaction.customer?.email || '').toLowerCase() !== String(user.email || '').toLowerCase()) return NextResponse.json({ success: false, message: 'This payment does not match your signed-in account.' }, { status: 403 });
    const metadataBookId = transaction.metadata?.book_id ?? transaction.metadata?.custom_fields?.find((field) => field.variable_name === 'book_id')?.value;
    if (metadataBookId !== undefined && String(metadataBookId) !== String(book_id)) {
      return NextResponse.json({ success: false, message: 'This payment was initiated for a different item.' }, { status: 403 });
    }

    const [{ data: duplicateReference }, { data: courseReference }] = await Promise.all([
      supabase.from('book_purchases').select('id').eq('payment_reference', reference).maybeSingle(),
      supabase.from('enrollments').select('id').eq('payment_reference', reference).maybeSingle(),
    ]);
    if (duplicateReference || courseReference) return NextResponse.json({ success: false, message: 'This payment reference has already been used.' }, { status: 409 });
    const { error: insertError } = await supabase.from('book_purchases').insert({
      student_id: user.id, book_id, payment_reference: reference, amount_paid: Number(transaction.amount) / 100, status: 'active', payment_type: 'paystack',
    });
    if (insertError) {
      console.error('Book purchase record error:', insertError);
      return NextResponse.json({ success: false, message: 'Payment was verified but the purchase could not be recorded. Contact support with your payment reference.' }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Book payment verification error:', error);
    return NextResponse.json({ success: false, message: 'Unable to verify the purchase right now.' }, { status: 500 });
  }
}