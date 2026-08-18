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
