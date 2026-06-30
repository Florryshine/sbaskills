'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createBrowserClient } from '@/lib/supabase';

export default function LibraryPage() {
  const supabase = createBrowserClient();
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBooks();
  }, []);

  const fetchBooks = async () => {
    const { data, error } = await supabase
      .from('books')
      .select('*')
      .order('title');
    if (!error) setBooks(data);
    setLoading(false);
  };

  const deleteBook = async (id) => {
    if (!confirm('Delete this book?')) return;
    await supabase.from('books').delete().eq('id', id);
    fetchBooks();
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">📚 Library</h1>
        <Link href="/admin/library/add" className="btn-primary">
          + Add Book
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {books.map((book) => (
          <div key={book.id} className="border p-4 rounded shadow">
            <h3 className="font-bold">{book.title}</h3>
            <p className="text-sm text-gray-600">{book.author}</p>
            <p className="text-sm">₦{book.price?.toFixed(2) || '0.00'}</p>
            <div className="mt-2 flex gap-2">
              <Link href={`/admin/library/${book.id}/edit`} className="text-blue-600 text-sm">
                Edit
              </Link>
              <button onClick={() => deleteBook(book.id)} className="text-red-600 text-sm">
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}