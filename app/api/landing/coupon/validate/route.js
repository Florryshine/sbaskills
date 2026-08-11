import { NextResponse } from 'next/server';
import { checkCoupon } from '@/lib/landingCoupons';

// POST { code, productSlug } -> { valid, finalPrice, basePrice, reason? }
// Called from the landing page as the student types a coupon in. Never
// trust a price the client sends back to you — always recompute at
// checkout time too (see /api/landing/checkout).
export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const { code, productSlug = 'jamb-playbook' } = body;

  const result = await checkCoupon(code, productSlug);
  return NextResponse.json(result);
}
