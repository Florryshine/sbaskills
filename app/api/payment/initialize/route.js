import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getProduct, priceWithCoupon } from '@/lib/landingProducts';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req) {
  try {
    const body = await req.json();
    const { coupon, product, email } = body || {};

    // Never accept a price from the browser. The product allowlist is the
    // only source of the base amount used to initialize a Paystack charge.
    const productSlug = product === undefined ? 'jamb-playbook' : product;
    const productConfig = typeof productSlug === 'string' ? getProduct(productSlug) : null;
    if (!productConfig) {
      return NextResponse.json({ error: 'Invalid product' }, { status: 400 });
    }

    const basePrice = Number(productConfig.price);
    if (!Number.isFinite(basePrice) || basePrice <= 0) {
      return NextResponse.json({ error: 'Product price is not configured' }, { status: 503 });
    }

    const customerEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
      return NextResponse.json({ error: 'A valid email address is required' }, { status: 400 });
    }

    let amount = basePrice;
    let appliedCoupon = null;

    if (coupon !== undefined && coupon !== null && String(coupon).trim()) {
      if (typeof coupon !== 'string') {
        return NextResponse.json({ error: 'Invalid coupon code' }, { status: 400 });
      }

      const { data: couponRow, error: couponError } = await supabaseAdmin
        .from('landing_coupons')
        .select('*')
        .eq('code', coupon.trim().toUpperCase())
        .eq('product_slug', productSlug)
        .eq('active', true)
        .maybeSingle();

      if (couponError || !couponRow) {
        return NextResponse.json({ error: 'Invalid or expired coupon code' }, { status: 400 });
      }

      if (couponRow.max_uses && couponRow.used_count >= couponRow.max_uses) {
        return NextResponse.json({ error: 'This coupon has reached its maximum uses' }, { status: 400 });
      }

      if (couponRow.expires_at && new Date(couponRow.expires_at) <= new Date()) {
        return NextResponse.json({ error: 'This coupon has expired' }, { status: 400 });
      }

      amount = priceWithCoupon(basePrice, couponRow);
      appliedCoupon = couponRow.code;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { error: 'This order has no payable balance. Please contact support for assistance.' },
        { status: 400 }
      );
    }

    if (!process.env.PAYSTACK_SECRET_KEY) {
      return NextResponse.json({ error: 'Payment processing is not configured' }, { status: 503 });
    }

    const reference = 'JAMB-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);

    const response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + process.env.PAYSTACK_SECRET_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: customerEmail,
        amount: Math.round(amount * 100),
        reference,
        callback_url: (process.env.NEXT_PUBLIC_APP_URL || 'https://shineybrainacademy.vercel.app') + '/jamb-playbook/thank-you',
        metadata: {
          custom_fields: [
            {
              display_name: 'Product',
              variable_name: 'product',
              value: productSlug,
            },
            {
              display_name: 'Coupon',
              variable_name: 'coupon',
              value: appliedCoupon || 'none',
            },
          ],
        },
      }),
      cache: 'no-store',
    });

    const data = await response.json();

    if (response.ok && data.status && data.data?.authorization_url) {
      return NextResponse.json({
        authorization_url: data.data.authorization_url,
        reference: data.data.reference,
      });
    }

    return NextResponse.json(
      { error: data.message || 'Payment initialization failed' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Payment initialization error:', error);
    return NextResponse.json(
      { error: 'Payment initialization failed' },
      { status: 500 }
    );
  }
}
