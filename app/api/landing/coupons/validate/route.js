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

    // Coupon is valid
    return NextResponse.json({
      valid: true,
      discountPercent: coupon.discount_percent || 0,
      code: coupon.code,
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
