'use client';

import Script from 'next/script';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatAmountToKobo } from '@/lib/paystack';

export default function EnrollButton({ courseId, courseTitle, amount, email, isLoggedIn }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const paystackPublicKey = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY;
  const paymentReference = useMemo(
    () => `SBA-${courseId}-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    [courseId]
  );

  const verifyEnrollment = async (payload) => {
    const response = await fetch('/api/verify-payment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Unable to complete enrollment.');
    }

    router.push(`/courses/${courseId}`);
    router.refresh();
  };

  const handleFreeEnrollment = async () => {
    if (!isLoggedIn) {
      router.push(`/login?next=/courses/${courseId}`);
      return;
    }

    try {
      setLoading(true);
      await verifyEnrollment({ courseId, free: true });
    } catch (error) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePaidEnrollment = async () => {
    if (!isLoggedIn) {
      router.push(`/login?next=/courses/${courseId}`);
      return;
    }

    if (!window.PaystackPop) {
      alert('Paystack failed to load. Please refresh and try again.');
      return;
    }

    const handler = window.PaystackPop.setup({
      key: paystackPublicKey,
      email,
      amount: formatAmountToKobo(amount),
      ref: paymentReference,
      metadata: {
        custom_fields: [
          {
            display_name: 'Course',
            variable_name: 'course_title',
            value: courseTitle
          }
        ]
      },
      callback: async function (response) {
        try {
          setLoading(true);
          await verifyEnrollment({ courseId, reference: response.reference });
        } catch (error) {
          alert(error.message);
          setLoading(false);
        }
      },
      onClose: function () {
        setLoading(false);
      }
    });

    handler.openIframe();
  };

  return (
    <>
      <Script src="https://js.paystack.co/v1/inline.js" strategy="lazyOnload" />
      <button
        onClick={Number(amount) === 0 ? handleFreeEnrollment : handlePaidEnrollment}
        disabled={loading}
        className="rounded-full bg-brand-yellow px-6 py-3 text-sm font-bold text-brand-dark transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {loading ? 'Processing...' : Number(amount) === 0 ? 'Enroll for Free' : 'Enroll / Pay'}
      </button>
    </>
  );
}
