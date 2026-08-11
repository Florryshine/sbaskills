// Base prices for landing-page offers, in Naira.
// Coupons apply on top of this — the server always computes the real
// price from here + the coupon row, never from anything the client sends.
export const LANDING_PRODUCTS = {
  'jamb-playbook': {
    name: '100/100 JAMB AI Playbook',
    price: 10000,
  },
};

export function getProduct(slug) {
  return LANDING_PRODUCTS[slug] || null;
}

export function priceWithCoupon(basePrice, coupon) {
  if (!coupon) return basePrice;
  if (coupon.discount_type === 'fixed_price') {
    return Math.max(0, Number(coupon.discount_value));
  }
  if (coupon.discount_type === 'amount_off') {
    return Math.max(0, basePrice - Number(coupon.discount_value));
  }
  return basePrice;
}
