import { createClient } from '@/lib/supabase-server';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export default async function BlogPostPage({ params }) {
  const supabase = createClient();

  const { data: post } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('slug', params.slug)
    .eq('is_published', true)
    .single();

  if (!post) notFound();

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gray-50">
        {/* Hero */}
        {post.cover_image ? (
          <div className="w-full h-72 overflow-hidden">
            <img
              src={post.cover_image}
              alt={post.title}
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div className="w-full h-48 bg-brand-blue flex items-center 
                          justify-center text-6xl">
            📖
          </div>
        )}

        {/* Article */}
        <article className="max-w-3xl mx-auto px-4 py-12">
          <Link
            href="/blog"
            className="text-sm text-brand-blue hover:underline mb-6 
                       inline-block"
          >
            ← Back to Blog
          </Link>

          <h1 className="text-3xl font-extrabold text-gray-900 mb-3">
            {post.title}
          </h1>

          <p className="text-sm text-gray-400 mb-8">
            {new Date(post.created_at).toLocaleDateString('en-NG', {
              day: 'numeric',
              month: 'long',
              year: 'numeric'
            })}
          </p>

          {post.excerpt && (
            <p className="text-lg text-gray-600 font-medium mb-8 
                           border-l-4 border-brand-yellow pl-4 italic">
              {post.excerpt}
            </p>
          )}

          <div className="prose prose-lg max-w-none text-gray-700 
                          leading-relaxed whitespace-pre-wrap">
            {post.content}
          </div>
        </article>
      </main>
      <Footer />
    </>
  );
}