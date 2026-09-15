'use client';

import { useEffect, useState } from 'react';

export default function SchoolFeeReceiptPage() {
  const [payment, setPayment] = useState(null);
  const [error, setError] = useState(null);
  const reference = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('reference') : null;

  useEffect(() => {
    if (!reference) { setError('Missing payment reference.'); return undefined; }
    let cancelled = false;
    let timer;
    async function poll() {
      const response = await fetch(`/api/school/fees/payment-status?reference=${encodeURIComponent(reference)}`);
      const json = await response.json();
      if (cancelled) return;
      if (!response.ok) { setError(json.error || 'Could not load payment status.'); return; }
      setPayment(json);
      if (json.status === 'pending') timer = setTimeout(poll, 2500);
    }
    poll();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [reference]);

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <section className="w-full max-w-lg rounded-2xl bg-white border border-slate-100 shadow-sm p-8 text-center">
        <p className="text-xs uppercase tracking-widest font-bold text-brand-yellow">School fee payment</p>
        <h1 className="mt-2 text-2xl font-extrabold text-brand-blue">{payment?.status === 'confirmed' ? 'Payment confirmed' : 'Confirming payment'}</h1>
        {error && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}
        {!error && !payment && <p className="mt-4 text-slate-500">Loading payment status…</p>}
        {payment?.status === 'pending' && <p className="mt-4 text-slate-500">Paystack has received your payment. We are waiting for the school confirmation webhook.</p>}
        {payment?.status === 'confirmed' && (
          <div className="mt-6 space-y-3 text-left rounded-xl bg-emerald-50 border border-emerald-100 p-5">
            <div className="flex justify-between gap-4"><span className="text-slate-500">Amount</span><strong>₦{Number(payment.amount).toLocaleString('en-NG', { minimumFractionDigits: 2 })}</strong></div>
            <div className="flex justify-between gap-4"><span className="text-slate-500">Receipt number</span><strong>{payment.receipt_number}</strong></div>
            <div className="flex justify-between gap-4"><span className="text-slate-500">Paid at</span><strong>{payment.paid_at ? new Date(payment.paid_at).toLocaleString('en-NG') : 'Confirmed'}</strong></div>
          </div>
        )}
        <a className="inline-block mt-6 text-sm font-bold text-brand-blue" href={`/school/${window.location.pathname.split('/')[2]}/parent`}>Back to parent dashboard</a>
      </section>
    </main>
  );
}
