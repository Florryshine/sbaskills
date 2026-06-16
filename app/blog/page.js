import Link from 'next/link';
import { createServerClient } from '@/lib/supabase-server';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export const metadata = {
  title: 'Blog | Shiney Brain Academy',
  description: 'Tips, guides and insights for Nigerian students'
};

export default async function BlogPage() {
  const supabase = createServerClient();
  
  const { data: posts } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('is_published', true)
    .order('created_at', { ascending: false });

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gray-50">
        <section className="bg-brand-blue py-16 text-center text-white">
          <h1 className="text-4xl font-extrabold mb-3">📚 Shiney Brain Blog</h1>
          <p className="text-blue-100 text-lg">
            Tips, study guides and insights to help you ace JAMB and beyond
          </p>
        </section>

        <section className="max-w-6xl mx-auto px-4 py-12">
          {!posts || posts.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-5xl mb-4">✍️</p>
              <h2 className="text-2xl font-bold text-gray-700 mb-2">No posts yet</h2>
              <p className="text-gray-500">Check back soon — great content is coming!</p>
            </div>
          ) : (
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {posts.map((post) => (
                <Link
                  key={post.id}
                  href={`/blog/${post.slug}`}
                  className="group bg-white rounded-2xl shadow-sm hover:shadow-md 
                             transition overflow-hidden border border-gray-100"
                >
                  {post.cover_image ? (
                    <img src={post.cover_image} alt={post.title}
                      className="w-full h-48 object-cover" />
                  ) : (
                    <div className="w-full h-48 bg-brand-blue flex items-center 
                                    justify-center text-5xl">📖</div>
                  )}
                  <div className="p-5">
                    <h2 className="text-lg font-bold text-gray-800 mb-2 
                                   group-hover:text-brand-blue transition line-clamp-2">
                      {post.title}
                    </h2>
                    {post.excerpt && (
                      <p className="text-sm text-gray-500 line-clamp-3 mb-4">
                        {post.excerpt}
                      </p>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400">
                        {new Date(post.created_at).toLocaleDateString('en-NG', {
                          day: 'numeric', month: 'short', year: 'numeric'
                        })}
                      </span>
                      <span className="text-xs font-bold text-brand-blue 
                                       group-hover:underline">Read more →</span>
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