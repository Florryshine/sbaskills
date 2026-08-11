import { landingSupabaseAdmin } from './landingSupabaseAdmin';
import { getProduct, priceWithCoupon } from './landingProducts';

// Looks up a coupon and tells you whether it's usable right now for this
// product. Does NOT increment usage — that only happens on confirmed
// payment (see applyCouponUsage below), so a browsed-but-unpaid checkout
// never burns a redemption.
export async function checkCoupon(code, productSlug) {
  const product = getProduct(productSlug);
  if (!product) {
    return { valid: false, reason: 'unknown_product' };
  }
  if (!code) {
    return { valid: true, coupon: null, finalPrice: product.price, basePrice: product.price };
  }

  const supabase = landingSupabaseAdmin();
  const { data: coupon, error } = await supabase
    .from('landing_coupons')
    .select('*')
    .eq('code', code.trim().toUpperCase())
    .eq('product_slug', productSlug)
    .maybeSingle();

  if (error || !coupon) {
    return { valid: false, reason: 'not_found' };
  }
  if (!coupon.active) {
    return { valid: false, reason: 'inactive' };
  }
  if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
    return { valid: false, reason: 'expired' };
  }
  if (coupon.max_uses != null && coupon.used_count >= coupon.max_uses) {
    return { valid: false, reason: 'exhausted' };
  }

  const finalPrice = priceWithCoupon(product.price, coupon);
  return { valid: true, coupon, finalPrice, basePrice: product.price };
}

// Call this from your Paystack webhook once a payment referencing a coupon
// code has been verified as successful. Safe to call even if code is null.
export async function applyCouponUsage(code) {
  if (!code) return null;
  const supabase = landingSupabaseAdmin();
  const { data, error } = await supabase.rpc('increment_coupon_usage', {
    p_code: code.trim().toUpperCase(),
  });
  if (error) {
    console.error('applyCouponUsage failed', error);
    return null;
  }
  return data;
}
