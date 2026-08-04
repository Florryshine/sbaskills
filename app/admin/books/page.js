'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createBrowserClient } from '@/lib/supabase';

// This file did not exist before — clicking "Books" in the admin sidebar
// (which links to /admin/books) 404'd, because only /admin/books/new and
// /admin/books/[id] existed, with nothing at the base route to list books
// or link into them. Modeled on the same list pattern already used by
// /admin/library (which reads the same `books` table).
export default function AdminBooksPage() {
  const supabase = createBrowserClient();
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBooks();
  }, []);

  const fetchBooks = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('books')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error) setBooks(data || []);
    setLoading(false);
  };

  const deleteBook = async (id) => {
    if (!confirm('Delete this book?')) return;
    await supabase.from('books').delete().eq('id', id);
    fetchBooks();
  };

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-brand-blue">📕 Books</h1>
          <p className="text-sm text-slate-500 mt-1">{books.length} book{books.length === 1 ? '' : 's'}</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/books/from-text"
            className="rounded-full bg-brand-blue px-5 py-2.5 text-sm font-bold text-white hover:opacity-90"
          >
            ✨ Generate from Text
          </Link>
          <Link
            href="/admin/books/new"
            className="rounded-full bg-brand-yellow px-5 py-2.5 text-sm font-bold text-brand-dark hover:opacity-90"
          >
            + Add Book
          </Link>
        </div>
      </section>

      {books.length === 0 ? (
        <div className="rounded-2xl bg-white p-8 shadow-sm border border-slate-100 text-center text-slate-500">
          No books yet.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {books.map((book) => (
            <div key={book.id} className="rounded-2xl bg-white p-4 shadow-sm border border-slate-100">
              {book.cover_url && (
                <img
                  src={book.cover_url}
                  alt={book.title}
                  className="w-full h-40 object-cover rounded-xl mb-3"
                />
              )}
              <h3 className="font-bold text-slate-800">{book.title}</h3>
              <p className="text-sm text-slate-500">{book.author}</p>
              <div className="flex items-center justify-between mt-2">
                <span className="text-sm font-semibold text-brand-blue">
                  {book.price > 0 ? `₦${book.price.toLocaleString()}` : 'Free'}
                </span>
                <span className={`text-xs font-bold px-2 py-1 rounded-full ${book.is_published ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                  {book.is_published ? 'Published' : 'Draft'}
                </span>
              </div>
              <div className="mt-3 flex gap-3">
                <Link href={`/admin/books/${book.id}`} className="text-sm font-semibold text-brand-blue hover:underline">
                  Edit
                </Link>
                <button onClick={() => deleteBook(book.id)} className="text-sm font-semibold text-red-600 hover:underline">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
