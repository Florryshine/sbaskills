// lib/landingProducts.js

export const PRODUCTS = {
  'jamb-playbook': {
    name: '100/100 JAMB AI Playbook',
    price: 5000,
    slug: 'jamb-playbook',
  },
  'ai-playbook': {
    name: '100/100 AI Playbook for Students',
    price: 5000,
    slug: 'ai-playbook',
  },
};

export function getProduct(slug) {
  return PRODUCTS[slug] || null;
}

export function priceWithCoupon(price, coupon) {
  if (!coupon) return Number(price);
  const base = Number(price);
  const type = coupon.discount_type || coupon.type;
  const value = Number(coupon.discount_value ?? coupon.value ?? 0);
  if (!Number.isFinite(base) || !Number.isFinite(value) || value < 0) return base;
  if (type === 'percent' || type === 'percentage') {
    return Math.max(0, Math.round(base * (1 - Math.min(value, 100) / 100)));
  }
  if (type === 'fixed' || type === 'amount') {
    return Math.max(0, Math.round(base - value));
  }
  return base;
}
