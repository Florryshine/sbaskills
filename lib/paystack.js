const PAYSTACK_BASE_URL = 'https://api.paystack.co';

export async function verifyPaystackTransaction(reference) {
  if (!reference) {
    throw new Error('Payment reference is required.');
  }

  const secretKey = process.env.PAYSTACK_SECRET_KEY;

  if (!secretKey) {
    throw new Error('PAYSTACK_SECRET_KEY is missing.');
  }

  const response = await fetch(`${PAYSTACK_BASE_URL}/transaction/verify/${reference}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json'
    },
    cache: 'no-store'
  });

  const payload = await response.json();

  if (!response.ok || !payload.status) {
    throw new Error(payload.message || 'Unable to verify payment.');
  }

  return payload.data;
}

export function initializePayment(email, amount, metadata = {}) {
  return new Promise((resolve, reject) => {
    const paystack = new PaystackPop();
    paystack.newTransaction({
      key: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY,
      email: email,
      amount: amount * 100, // Paystack uses kobo
      metadata: metadata,
      onSuccess: (transaction) => resolve(transaction),
      onCancel: () => reject(new Error('Payment cancelled')),
    });
  });
}