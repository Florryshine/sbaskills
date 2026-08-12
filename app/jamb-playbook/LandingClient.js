'use client';

import { useState, useEffect, useRef } from 'react';

function naira(n) {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

export default function LandingClient({ basePrice = 40000, screenshots = [], quotes = [] }) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [slotShots, setSlotShots] = useState(screenshots);
  const [uploadingSlot, setUploadingSlot] = useState(null);
  const slotFileRefs = [useRef(null), useRef(null), useRef(null)];

  // Coupon states
  const [couponCode, setCouponCode] = useState('');
  const [couponApplied, setCouponApplied] = useState(false);
  const [couponError, setCouponError] = useState('');
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [finalPrice, setFinalPrice] = useState(basePrice);
  const [loading, setLoading] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [email, setEmail] = useState('');

  // Admin check
  useEffect(() => {
    fetch('/api/admin/landing/is-admin')
      .then(r => r.json())
      .then(d => setIsAdmin(!!d.isAdmin))
      .catch(() => {});
  }, []);

  // Screenshot handlers
  async function handleSlotFile(slot, file) {
    if (!file) return;
    setUploadingSlot(slot);
    try {
      const fd = new FormData();
      fd.append('slot', String(slot));
      fd.append('image', file);
      const res = await fetch('/api/admin/landing/testimonials/screenshot-slot', {
        method: 'POST',
        body: fd,
      });
      const data = await res.json();
      if (res.ok && data.testimonial) {
        setSlotShots(prev => {
          const next = prev.filter(s => s.sort_order !== slot);
          next.push(data.testimonial);
          return next;
        });
      } else {
        alert(data.error || 'Upload failed.');
      }
    } catch {
      alert('Upload failed.');
    } finally {
      setUploadingSlot(null);
    }
  }

  async function handleSlotRemove(slot) {
    if (!confirm('Remove this screenshot?')) return;
    setUploadingSlot(slot);
    try {
      const res = await fetch('/api/admin/landing/testimonials/screenshot-slot', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slot }),
      });
      const data = await res.json();
      if (res.ok) {
        setSlotShots(prev => prev.filter(s => s.sort_order !== slot));
      } else {
        alert(data.error || 'Remove failed.');
      }
    } catch {
      alert('Remove failed.');
    } finally {
      setUploadingSlot(null);
    }
  }

  // Coupon handler
  async function handleApplyCoupon() {
    if (!couponCode.trim()) {
      setCouponError('Please enter a coupon code.');
      return;
    }

    setLoading(true);
    setCouponError('');
    setCouponDiscount(0);

    try {
      const res = await fetch(
        `/api/landing/coupons/validate?code=${encodeURIComponent(couponCode)}&product=jamb-playbook&basePrice=${basePrice}`
      );
      const data = await res.json();

      if (data.valid) {
        setCouponDiscount(data.discountAmount);
        setFinalPrice(data.finalPrice);
        setCouponApplied(true);
        setCouponError('');
        
        // Show success message
        alert(`✅ Coupon applied! You saved ${naira(data.discountAmount)}. Final price: ${naira(data.finalPrice)}`);
      } else {
        setCouponError(data.error || 'Invalid coupon code.');
        setCouponApplied(false);
        setCouponDiscount(0);
        setFinalPrice(basePrice);
      }
    } catch (err) {
      setCouponError('Failed to validate coupon. Please try again.');
      setCouponApplied(false);
      setCouponDiscount(0);
      setFinalPrice(basePrice);
    } finally {
      setLoading(false);
    }
  }

  // Handle payment
  async function handlePayment() {
    if (!email.trim()) {
      alert('Please enter your email address.');
      return;
    }

    setPaymentLoading(true);
    try {
      const response = await fetch('/api/payment/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          basePrice: basePrice,
          email: email,
          coupon: couponApplied ? couponCode : null,
          product: 'jamb-playbook'
        }),
      });

      const data = await response.json();
      
      if (data.authorization_url) {
        window.location.href = data.authorization_url;
      } else {
        alert(data.error || 'Payment initialization failed.');
      }
    } catch (err) {
      alert('Payment failed. Please try again.');
    } finally {
      setPaymentLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0b0f1a] text-white">
      {/* Hero Section */}
      <section className="relative px-4 py-16 text-center md:py-24">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-3xl font-bold leading-tight md:text-5xl">
            STOP STRUGGLING. <br />
            <span className="bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">
              START SCORING.
            </span>
          </h1>
          <p className="mt-4 text-lg text-gray-400 md:text-xl">
            The Ultimate JAMB Domination System
          </p>
        </div>
      </section>

      {/* Price & Coupon Section */}
      <section className="px-4 py-8">
        <div className="mx-auto max-w-md rounded-2xl bg-white/5 p-6 backdrop-blur">
          {/* Email input */}
          <div className="mb-4">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              className="w-full rounded-lg bg-white/10 px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400"
              required
            />
          </div>

          <div className="flex items-center gap-3">
            <input
              type="text"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
              placeholder="Enter coupon code"
              className="flex-1 rounded-lg bg-white/10 px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400"
              disabled={couponApplied}
            />
            <button
              onClick={handleApplyCoupon}
              disabled={couponApplied || loading}
              className={`rounded-lg px-4 py-3 font-semibold transition ${
                couponApplied
                  ? 'bg-green-500/20 text-green-400'
                  : loading
                  ? 'bg-gray-500/50 text-gray-400'
                  : 'bg-yellow-400 text-black hover:bg-yellow-300'
              }`}
            >
              {couponApplied ? '✓ Applied' : loading ? '...' : 'Apply'}
            </button>
          </div>
          
          {couponError && (
            <p className="mt-2 text-sm text-red-400">{couponError}</p>
          )}

          {couponApplied && (
            <p className="mt-2 text-sm text-green-400">
              ✅ Coupon applied! You saved {naira(couponDiscount)}
            </p>
          )}

          <div className="mt-6 border-t border-white/10 pt-6">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Original Price</span>
              <span className="text-lg text-gray-400 line-through">
                {naira(basePrice)}
              </span>
            </div>
            {couponApplied && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-green-400">Discount</span>
                <span className="text-green-400">-{naira(couponDiscount)}</span>
              </div>
            )}
            <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-3">
              <span className="text-xl font-bold">Final Price</span>
              <span className="text-2xl font-bold text-yellow-400">
                {naira(finalPrice)}
              </span>
            </div>
          </div>

          <button
            onClick={handlePayment}
            disabled={paymentLoading}
            className={`mt-6 w-full rounded-lg py-4 text-lg font-bold text-black transition ${
              paymentLoading
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-yellow-400 hover:bg-yellow-300'
            }`}
          >
            {paymentLoading ? 'Processing...' : `Get Instant Access – ${naira(finalPrice)}`}
          </button>

          <p className="mt-3 text-center text-sm text-gray-400">
            98% off - first 100 students only
          </p>
        </div>
      </section>

      {/* Screenshot section */}
      <section className="px-4 py-12">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-8 text-center text-2xl font-bold">Real Results</h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {[0, 1, 2].map(idx => {
              const shot = slotShots.find(s => s.sort_order === idx);
              const busy = uploadingSlot === idx;
              return (
                <div className="relative rounded-xl bg-white/5 p-4" key={idx}>
                  <div className="aspect-[9/16] overflow-hidden rounded-lg bg-white/10">
                    {shot ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={shot.image_url}
                        alt={`Screenshot ${idx + 1}`}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-gray-500">
                        <span className="text-sm">Screenshot placeholder</span>
                      </div>
                    )}
                  </div>
                  <p className="mt-2 text-center text-sm text-gray-400">
                    {['Mock score progression', "312 in JAMB — founder's result", 'Before / after study plan'][idx]}
                  </p>
                  {isAdmin && (
                    <div className="mt-2 flex justify-center gap-2">
                      <input
                        ref={slotFileRefs[idx]}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={e => handleSlotFile(idx, e.target.files?.[0])}
                      />
                      <button
                        onClick={() => slotFileRefs[idx].current?.click()}
                        disabled={busy}
                        className="rounded-full bg-black/50 px-3 py-1 text-xs text-white hover:bg-black/70"
                      >
                        {busy ? '...' : shot ? 'Replace' : 'Add'}
                      </button>
                      {shot && (
                        <button
                          onClick={() => handleSlotRemove(idx)}
                          className="rounded-full bg-red-500/50 px-3 py-1 text-xs text-white hover:bg-red-500/70"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
