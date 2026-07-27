import { createServerClient } from '@/lib/supabase-server';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Link from 'next/link';
import Image from 'next/image';

export const metadata = {
  title: 'Library | Shiney Brain Academy',
  description: 'Download exam prep books, past questions, and study guides for JAMB, WAEC, and NECO.',
  alternates: { canonical: 'https://shineybrainacademy.vercel.app/library' },
};

export default async function LibraryPage() {
  const supabase = createServerClient();
  const { data: books } = await supabase
    .from('books')
    .select('*')
    .eq('is_published', true)
    .order('created_at', { ascending: false });

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gray-50">
        <section className="bg-brand-blue py-16 text-center text-white">
          <h1 className="text-4xl font-extrabold mb-3">📚 Shiney Library</h1>
          <p className="text-blue-100 text-lg">Download exam prep books, past questions, and study guides</p>
        </section>
        <section className="max-w-6xl mx-auto px-4 py-12">
          {!books || books.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-5xl mb-4">📖</p>
              <h2 className="text-2xl font-bold text-gray-700 mb-2">No books yet</h2>
              <p className="text-gray-500">Check back soon for resources.</p>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {books.map((book) => (
                <Link key={book.id} href={`/library/${book.id}`}
                  className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition group">
                  {book.cover_url ? (
                    <div className="relative w-full h-48">
                      <Image src={book.cover_url} alt={book.title} fill className="object-cover" sizes="(max-width: 768px) 100vw, 33vw" />
                    </div>
                  ) : (
                    <div className="w-full h-48 bg-brand-blue flex items-center justify-center text-5xl">📘</div>
                  )}
                  <div className="p-5">
                    <h2 className="text-lg font-bold text-gray-800 group-hover:text-brand-blue">{book.title}</h2>
                    {book.author && <p className="text-sm text-gray-500 mt-1">by {book.author}</p>}
                    <p className="text-sm text-gray-500 line-clamp-2 mt-2">{book.description}</p>
                    <div className="mt-4 flex items-center justify-between">
                      <span className="font-extrabold text-brand-blue text-lg">
                        {book.price === 0 ? 'FREE' : `₦${book.price.toLocaleString()}`}
                      </span>
                      <span className="text-sm font-bold text-brand-yellow group-hover:underline">View →</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}