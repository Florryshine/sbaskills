import CouponsClient from './CouponsClient';

// ADAPT: wrap this route with whatever admin-layout/auth-guard your other
// /admin pages use (this one relies on the API routes checking auth, but
// your existing pattern likely also protects the page itself).
export default function AdminLandingCouponsPage() {
  return <CouponsClient />;
}
