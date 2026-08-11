import { NextResponse } from 'next/server';
import { checkCoupon } from '@/lib/landingCoupons';
import { getProduct } from '@/lib/landingProducts';

// POST { email, name, productSlug, couponCode }
// Recomputes the price server-side from the coupon table (ignores any
// price the client might send) and opens a Paystack transaction for that
// exact amount. Returns { authorization_url } to redirect the student to.
export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const { email, name, productSlug = 'jamb-playbook', couponCode } = body;

  if (!email) {
    return NextResponse.json({ error: 'Email is required.' }, { status: 400 });
  }

  const product = getProduct(productSlug);
  if (!product) {
    return NextResponse.json({ error: 'Unknown product.' }, { status: 400 });
  }

  const check = await checkCoupon(couponCode, productSlug);
  if (couponCode && !check.valid) {
    return NextResponse.json(
      { error: 'That coupon code is not valid or has expired.' },
      { status: 400 }
    );
  }
  const amountNaira = check.finalPrice;

  // ADAPT: swap this for your existing Paystack init helper if you have
  // one — this hits Paystack directly so the patch works standalone.
  const paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      amount: Math.round(amountNaira * 100), // kobo
      metadata: {
        product_slug: productSlug,
        product_name: product.name,
        coupon_code: couponCode ? couponCode.trim().toUpperCase() : null,
        customer_name: name || null,
      },
      // ADAPT: point this at wherever your Paystack webhook / verify route
      // lives so you can mark the order as paid and (per instructions
      // below) increment coupon usage.
      callback_url: `${process.env.NEXT_PUBLIC_SITE_URL}/jamb-playbook/thank-you`,
    }),
  });

  const data = await paystackRes.json();
  if (!data.status) {
    return NextResponse.json(
      { error: data.message || 'Could not start payment.' },
      { status: 502 }
    );
  }

  return NextResponse.json({ authorization_url: data.data.authorization_url });
}
