// lib/paystack.js
export function loadPaystackScript() {
  return new Promise((resolve, reject) => {
    if (window.PaystackPop && typeof window.PaystackPop === 'function') {
      return resolve();
    }

    // Remove any broken existing script first
    const existing = document.querySelector('script[src="https://js.paystack.co/v1/inline.js"]');
    if (existing) existing.remove();

    const script = document.createElement('script');
    script.src = 'https://js.paystack.co/v1/inline.js';
    script.async = false; // ← KEY CHANGE: false ensures it loads synchronously
    
    script.onload = () => {
      // Extra safety: wait a tick for PaystackPop to register
      setTimeout(() => {
        if (typeof window.PaystackPop === 'function') {
          resolve();
        } else {
          reject(new Error('PaystackPop not available after script load'));
        }
      }, 500);
    };

    script.onerror = () => reject(new Error('Failed to load Paystack script'));
    document.head.appendChild(script);
  });
}

export async function initializePayment(email, amount, metadata = {}) {
  await loadPaystackScript();

  const paystack = new window.PaystackPop();

  return new Promise((resolve, reject) => {
    paystack.newTransaction({
      key: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY,
      email,
      amount: amount * 100,
      metadata,
      onSuccess: (transaction) => resolve(transaction),
      onCancel: () => reject(new Error('Payment cancelled')),
      onError: (error) => reject(new Error(error.message || 'Payment failed')),
    });
  });
}