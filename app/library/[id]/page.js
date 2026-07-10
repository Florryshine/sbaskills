'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import { useParams, useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export default function BookPage() {
  const [book, setBook] = useState(null);
  const [loading, setLoading] = useState(true);
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
      setLoading(false);
    }
    loadBook();
  }, [id, supabase]);

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
                  {book.price === 0 ? 'FREE' : `₦${book.price.toLocaleString()}`}
                </span>
                {(book.file_url || book.pdf_url) && (
                  <a href={book.file_url || book.pdf_url} target="_blank" rel="noopener noreferrer"
                    className="ml-4 inline-block bg-brand-blue text-white px-6 py-3 rounded-full font-bold hover:opacity-90 transition">
                    📥 Download PDF
                  </a>
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