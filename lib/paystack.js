export function initializePayment(email, amount, metadata = {}) {
  return new Promise((resolve, reject) => {
    // Check if PaystackPop is available
    if (typeof window === 'undefined' || !window.PaystackPop) {
      reject(new Error('Paystack library not loaded. Please try again.'));
      return;
    }

    const paystack = new window.PaystackPop();
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