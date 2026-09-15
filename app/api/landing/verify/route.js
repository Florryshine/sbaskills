import { NextResponse } from 'next/server';

// GET /api/landing/verify?reference=xxx
// Confirms a Paystack transaction actually succeeded before the thank-you
// page sends the student on to Telegram. Never trust the mere presence of
// a callback hit as proof of payment — always verify server-side against
// Paystack directly using the secret key.
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const reference = searchParams.get('reference');

  if (!reference) {
    return NextResponse.json({ error: 'Missing reference.' }, { status: 400 });
  }

  const res = await fetch(
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
    {
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
    }
  );
  const data = await res.json();

  const success = !!data.status && data.data?.status === 'success';

  // ADAPT: this is also the right place to mark the order as paid in your
  // DB and increment coupon usage, if that isn't already handled by a
  // separate Paystack webhook route elsewhere in the codebase.

  return NextResponse.json({
    success,
    amount: data.data?.amount ? data.data.amount / 100 : null,
    email: data.data?.customer?.email || null,
  });
}
