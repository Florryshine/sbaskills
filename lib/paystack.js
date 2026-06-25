// lib/paystack.js
export function loadPaystackScript() {
  return new Promise((resolve, reject) => {
    // Check if already loaded
    if (window.PaystackPop && typeof window.PaystackPop === 'function') {
      return resolve();
    }

    // Remove any old/broken Paystack scripts
    document.querySelectorAll('script[src*="paystack"]').forEach(s => s.remove());

    const script = document.createElement('script');
    script.src = 'https://js.paystack.co/v2/inline.js'; // ← switched to v2
    script.async = true;

    script.onload = () => {
      let attempts = 0;
      const check = setInterval(() => {
        attempts++;
        if (typeof window.PaystackPop === 'function') {
          clearInterval(check);
          resolve();
        } else if (attempts > 20) { // 10 seconds max
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
      onSuccess: (transaction) => resolve(transaction),
      onCancel: () => reject(new Error('Payment cancelled')),
      onError: (error) => reject(new Error(error.message || 'Payment failed')),
    });
  });
}