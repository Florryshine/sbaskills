import TestimonialsClient from './TestimonialsClient';

// ADAPT: wrap with your existing admin auth guard/layout, same as
// /admin/landing/coupons/page.js.
export default function AdminLandingTestimonialsPage() {
  return <TestimonialsClient />;
}
