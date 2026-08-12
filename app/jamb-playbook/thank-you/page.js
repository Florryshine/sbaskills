'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

// Students land here right after Paystack. We verify the transaction
// server-side (never trust the redirect alone), then send them to the
// Telegram group only once payment is confirmed. If verification fails,
// they see a support message instead of being dropped into the group
// unpaid or left on a blank page.
const TELEGRAM_URL = 'https://t.me/+rtQ4PBtFxCtkYWNk';

export default function ThankYouPage() {
  const searchParams = useSearchParams();
  const reference = searchParams.get('reference') || searchParams.get('trxref');
  const [status, setStatus] = useState('checking'); // checking | success | failed

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
          // Small delay so the confirmation is visible before the jump.
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
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: 24,
        gap: 16,
        background: '#0b0f1a',
        color: '#fff',
      }}
    >
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
          <a
            href={TELEGRAM_URL}
            style={{ color: '#5eead4', textDecoration: 'underline', fontSize: 14 }}
          >
            Tap here if it doesn't open automatically
          </a>
        </>
      )}

      {status === 'failed' && (
        <>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>We couldn't confirm that payment</h1>
          <p style={{ color: '#9aa4bb', maxWidth: 420 }}>
            If money left your account, don't worry — message us with your payment reference
            and we'll sort it out right away.
          </p>
        </>
      )}
    </div>
  );
}
