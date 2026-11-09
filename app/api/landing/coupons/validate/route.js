import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getProduct, priceWithCoupon } from '@/lib/landingProducts';

// Coupon validation is public, but the product price is always resolved
// from the server-side catalogue. A client-supplied basePrice is ignored.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code')?.trim().toUpperCase();
  const productSlug = searchParams.get('product') || 'jamb-playbook';
  const product = getProduct(productSlug);

  if (!product) {
    return NextResponse.json({ valid: false, error: 'Unknown product' }, { status: 400 });
  }

  if (!code) {
    return NextResponse.json(
      { valid: false, error: 'Coupon code required' },
      { status: 400 }
    );
  }

  try {
    const { data: coupon, error } = await supabaseAdmin
      .from('landing_coupons')
      .select('*')
      .eq('code', code)
      .eq('product_slug', productSlug)
      .eq('active', true)
      .maybeSingle();

    if (error || !coupon) {
      return NextResponse.json({
        valid: false,
        error: 'Invalid or expired coupon code',
      });
    }

    if (coupon.max_uses && coupon.used_count >= coupon.max_uses) {
      return NextResponse.json({
        valid: false,
        error: 'This coupon has reached its maximum uses',
      });
    }

    if (coupon.expires_at && new Date(coupon.expires_at) <= new Date()) {
      return NextResponse.json({
        valid: false,
        error: 'This coupon has expired',
      });
    }

    const basePrice = Number(product.price);
    const finalPrice = priceWithCoupon(basePrice, coupon);
    const discountAmount = Math.max(0, basePrice - finalPrice);

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
