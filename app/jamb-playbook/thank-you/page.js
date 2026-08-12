'use client';

import { Suspense } from 'react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

const TELEGRAM_URL = 'https://t.me/+rtQ4PBtFxCtkYWNk';

// Separate component that uses useSearchParams
function ThankYouContent() {
  const searchParams = useSearchParams();
  const reference = searchParams.get('reference') || searchParams.get('trxref');
  const [status, setStatus] = useState('checking');

  useEffect(() => {
    if (!reference) {
      setStatus('failed');
      return;
    }
    fetch(`/api/landing/verify?reference=${encodeURIComponent(reference)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setStatus('success');
          setTimeout(() => {
            window.location.href = TELEGRAM_URL;
          }, 1500);
        } else {
          setStatus('failed');
        }
      })
      .catch(() => setStatus('failed'));
  }, [reference]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 24, gap: 16, background: '#0b0f1a', color: '#fff' }}>
      {status === 'checking' && (
        <>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>Confirming your payment…</h1>
          <p style={{ color: '#9aa4bb' }}>This takes a few seconds. Please don't close this tab.</p>
        </>
      )}
      {status === 'success' && (
        <>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>Payment confirmed 🎉</h1>
          <p style={{ color: '#9aa4bb' }}>Taking you to the Telegram group now…</p>
          <a href={TELEGRAM_URL} style={{ color: '#5eead4', textDecoration: 'underline', fontSize: 14 }}>Tap here if it doesn't open automatically</a>
        </>
      )}
      {status === 'failed' && (
        <>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>We couldn't confirm that payment</h1>
          <p style={{ color: '#9aa4bb', maxWidth: 420 }}>If money left your account, don't worry — message us with your payment reference and we'll sort it out right away.</p>
        </>
      )}
    </div>
  );
}

// Main page component with Suspense boundary
export default function ThankYouPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0b0f1a', color: '#fff' }}>
        <p>Loading...</p>
      </div>
    }>
      <ThankYouContent />
    </Suspense>
  );
}
