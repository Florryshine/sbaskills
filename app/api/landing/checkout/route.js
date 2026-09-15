import { NextResponse } from 'next/server';
import { checkCoupon } from '@/lib/landingCoupons';
import { getProduct } from '@/lib/landingProducts';

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const { email, name, productSlug = 'ai-playbook', couponCode } = body;

  if (!email) {
    return NextResponse.json({ error: 'Email is required.' }, { status: 400 });
  }

  const product = getProduct(productSlug);
  if (!product) {
    return NextResponse.json({ error: 'Unknown product.' }, { status: 400 });
  }

  let amountNaira = product.price;
  if (couponCode) {
    const check = await checkCoupon(couponCode, productSlug);
    if (!check.valid) {
      return NextResponse.json(
        { error: 'That coupon code is not valid or has expired.' },
        { status: 400 }
      );
    }
    amountNaira = check.finalPrice;
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://shineybrainacademy.vercel.app';
  const callbackUrl = productSlug === 'ai-playbook'
    ? `${baseUrl}/ai-playbook/confirmation`
    : `${baseUrl}/jamb-playbook/thank-you`;

  const paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      amount: Math.round(amountNaira * 100), // in kobo
      metadata: {
        product_slug: productSlug,
        product_name: product.name,
        coupon_code: couponCode ? couponCode.trim().toUpperCase() : null,
        customer_name: name || null,
      },
      callback_url: callbackUrl,
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
