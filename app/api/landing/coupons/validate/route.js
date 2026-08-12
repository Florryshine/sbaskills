import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase admin client
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code')?.toUpperCase();
  const product = searchParams.get('product') || 'jamb-playbook';
  const basePrice = Number(searchParams.get('basePrice')) || 0;

  if (!code) {
    return NextResponse.json(
      { valid: false, error: 'Coupon code required' },
      { status: 400 }
    );
  }

  try {
    // Query the coupon
    const { data: coupon, error } = await supabaseAdmin
      .from('landing_coupons')
      .select('*')
      .eq('code', code)
      .eq('product_slug', product)
      .eq('active', true)
      .single();

    if (error || !coupon) {
      return NextResponse.json({
        valid: false,
        error: 'Invalid or expired coupon code'
      });
    }

    // Check if coupon has reached max uses
    if (coupon.max_uses && coupon.used_count >= coupon.max_uses) {
      return NextResponse.json({
        valid: false,
        error: 'This coupon has reached its maximum uses'
      });
    }

    if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
      return NextResponse.json({
        valid: false,
        error: 'This coupon has expired'
      });
    }

    // The table stores discount_type ('fixed_price' | 'amount_off') and
    // discount_value — NOT a discount_percent field. Compute the actual
    // final price here, server-side, so the client never has to (and
    // can't) fudge the math.
    let finalPrice = basePrice;
    if (coupon.discount_type === 'fixed_price') {
      finalPrice = coupon.discount_value;
    } else if (coupon.discount_type === 'amount_off') {
      finalPrice = basePrice - coupon.discount_value;
    }
    finalPrice = Math.max(0, Math.round(finalPrice));
    const discountAmount = Math.max(0, basePrice - finalPrice);

    // Coupon is valid
    return NextResponse.json({
      valid: true,
      code: coupon.code,
      discountType: coupon.discount_type,
      discountValue: coupon.discount_value,
      discountAmount,
      finalPrice,
      maxUses: coupon.max_uses,
      usedCount: coupon.used_count,
    });

  } catch (error) {
    console.error('Coupon validation error:', error);
    return NextResponse.json(
      { valid: false, error: 'Failed to validate coupon' },
      { status: 500 }
    );
  }
}

