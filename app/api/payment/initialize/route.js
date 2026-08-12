import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req) {
  try {
    const body = await req.json();
    const { basePrice, coupon, product, email } = body;

    if (!basePrice || basePrice <= 0) {
      return NextResponse.json(
        { error: 'Invalid amount' },
        { status: 400 }
      );
    }

    // Never trust a client-sent final amount — recompute it here from the
    // coupon table so a tampered request can't pay less than it should.
    let amount = basePrice;
    let appliedCoupon = null;
    if (coupon) {
      const { data: couponRow } = await supabaseAdmin
        .from('landing_coupons')
        .select('*')
        .eq('code', coupon.toUpperCase())
        .eq('product_slug', product || 'jamb-playbook')
        .eq('active', true)
        .single();

      if (couponRow && (!couponRow.max_uses || couponRow.used_count < couponRow.max_uses)) {
        if (couponRow.discount_type === 'fixed_price') {
          amount = couponRow.discount_value;
        } else if (couponRow.discount_type === 'amount_off') {
          amount = basePrice - couponRow.discount_value;
        }
        amount = Math.max(0, Math.round(amount));
        appliedCoupon = couponRow.code;
      }
      // If the coupon doesn't validate here, silently fall back to
      // basePrice rather than trusting anything else from the client.
    }

    // Generate unique reference
    const reference = 'JAMB-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);

    // Initialize Paystack transaction
    const response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: email || 'customer@example.com',
        amount: amount * 100, // Paystack uses kobo
        reference: reference,
        callback_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://shineybrainacademy.vercel.app'}/jamb-playbook/thank-you`,
        metadata: {
          custom_fields: [
            {
              display_name: "Product",
              variable_name: "product",
              value: product || 'jamb-playbook'
            },
            {
              display_name: "Coupon",
              variable_name: "coupon",
              value: appliedCoupon || 'none'
            }
          ]
        }
      }),
    });

    const data = await response.json();

    if (data.status) {
      return NextResponse.json({
        authorization_url: data.data.authorization_url,
        reference: data.data.reference,
      });
    } else {
      return NextResponse.json(
        { error: data.message || 'Payment initialization failed' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Payment initialization error:', error);
    return NextResponse.json(
      { error: 'Payment initialization failed' },
      { status: 500 }
    );
  }
}
