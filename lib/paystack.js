// lib/paystack.js
export function loadPaystackScript() {
  return new Promise((resolve, reject) => {
    if (window.PaystackPop && typeof window.PaystackPop === 'function') {
      return resolve();
    }
    document.querySelectorAll('script[src*="paystack"]').forEach(s => s.remove());
    const script = document.createElement('script');
    script.src = 'https://js.paystack.co/v2/inline.js';
    script.async = true;
    script.onload = () => {
      let attempts = 0;
      const check = setInterval(() => {
        attempts++;
        if (typeof window.PaystackPop === 'function') {
          clearInterval(check);
          resolve();
        } else if (attempts > 20) {
          clearInterval(check);
          reject(new Error('Paystack failed to initialize. Check your internet or disable ad blocker.'));
        }
      }, 500);
    };
    script.onerror = () => reject(new Error('Paystack script blocked. Check your internet connection.'));
    document.head.appendChild(script);
  });
}

export async function initializePayment(email, amount, metadata = {}) {
  await loadPaystackScript();
  return new Promise((resolve, reject) => {
    const paystack = new window.PaystackPop();
    paystack.newTransaction({
      key: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY,
      email,
      amount: amount * 100,
      metadata,
      channels: ['card', 'bank', 'ussd', 'bank_transfer'], // ← only change
      onSuccess: (transaction) => resolve(transaction),
      onCancel: () => reject(new Error('Payment cancelled')),
      onError: (error) => reject(new Error(error.message || 'Payment failed')),
    });
  });
}