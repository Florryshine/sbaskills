'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import { useParams, useRouter } from 'next/navigation';
import { initializePayment } from '@/lib/paystack';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export default function BookPage() {
  const [book, setBook] = useState(null);
  const [purchase, setPurchase] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const { id } = useParams();
  const router = useRouter();
  const supabase = createBrowserClient();

  useEffect(() => {
    async function loadBook() {
      const { data } = await supabase
        .from('books')
        .select('*')
        .eq('id', id)
        .single();
      setBook(data);

      const { data: { user } } = await supabase.auth.getUser();
      if (user && data && data.price > 0) {
        const { data: purchaseData } = await supabase
          .from('book_purchases')
          .select('*')
          .eq('student_id', user.id)
          .eq('book_id', id)
          .eq('status', 'active')
          .maybeSingle();
        setPurchase(purchaseData);
      }

      setLoading(false);
    }
    loadBook();
  }, [id, supabase]);

  const handleBuy = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push(`/login?next=/library/${id}`);
      return;
    }

    setProcessing(true);
    try {
      const amount = parseInt(book.price);
      if (isNaN(amount) || amount <= 0) {
        alert('Invalid book price.');
        setProcessing(false);
        return;
      }

      const transaction = await initializePayment(user.email, amount, {
        book_id: book.id,
        student_id: user.id,
      });

      const response = await fetch('/api/verify-book-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reference: transaction.reference,
          book_id: book.id,
          student_id: user.id,
          amount: amount,
        }),
      });

      const result = await response.json();
      if (result.success) {
        alert('✅ Payment successful! You can now download this book.');
        const { data: newPurchase } = await supabase
          .from('book_purchases')
          .select('*')
          .eq('student_id', user.id)
          .eq('book_id', id)
          .single();
        setPurchase(newPurchase);
      } else {
        alert('Payment verification failed. Please contact admin.');
      }
    } catch (error) {
      console.error('Book purchase error:', error);
      alert(error.message || 'Payment cancelled or failed.');
    }
    setProcessing(false);
  };

  if (loading) return (
    <>
      <Navbar />
      <div className="min-h-screen flex items-center justify-center">Loading...</div>
      <Footer />
    </>
  );

  if (!book) return (
    <>
      <Navbar />
      <div className="min-h-screen text-center py-20">Book not found</div>
      <Footer />
    </>
  );

  const isFree = book.price === 0 || book.price === '0';
  const isUnlocked = isFree || !!purchase;
  const downloadUrl = book.pdf_url || book.file_url;

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {book.cover_url && <img src={book.cover_url} alt={book.title} className="w-full max-h-96 object-cover" />}
            <div className="p-8">
              <h1 className="text-3xl font-extrabold text-gray-900">{book.title}</h1>
              {book.author && <p className="text-gray-500 mt-1">by {book.author}</p>}
              <p className="text-gray-700 mt-4 whitespace-pre-wrap">{book.description}</p>
              <div className="mt-6">
                <span className="text-2xl font-extrabold text-brand-blue">
                  {isFree ? 'FREE' : `₦${Number(book.price).toLocaleString()}`}
                </span>

                {downloadUrl && isUnlocked && (
                  <a href={downloadUrl} target="_blank" rel="noopener noreferrer"
                    className="ml-4 inline-block bg-brand-blue text-white px-6 py-3 rounded-full font-bold hover:opacity-90 transition">
                    📥 Download PDF
                  </a>
                )}

                {downloadUrl && !isUnlocked && (
                  <button
                    onClick={handleBuy}
                    disabled={processing}
                    className="ml-4 inline-block bg-brand-yellow text-brand-dark px-6 py-3 rounded-full font-bold hover:opacity-90 transition"
                  >
                    {processing ? 'Processing...' : `🔒 Buy for ₦${Number(book.price).toLocaleString()}`}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
