import { createServerClient } from '@/lib/supabase-server';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Link from 'next/link';
import { notFound } from 'next/navigation';

// Generate metadata dynamically
export async function generateMetadata({ params }) {
  const supabase = createServerClient();
  const { data: post } = await supabase
    .from('blog_posts')
    .select('title, excerpt, slug, cover_image')
    .eq('slug', params.slug)
    .eq('is_published', true)
    .single();

  if (!post) {
    return {
      title: 'Post Not Found',
    };
  }

  return {
    title: `${post.title} | Shiney Brain Academy`,
    description: post.excerpt || `Read about ${post.title} on Shiney Brain Academy`,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      url: `https://sbaskills.vercel.app/blog/${post.slug}`,
      type: 'article',
      images: post.cover_image ? [{ url: post.cover_image }] : undefined,
    },
  };
}

function getReadingTime(content) {
  const wordsPerMinute = 200;
  const wordCount = content?.split(/\s+/).filter(Boolean).length || 0;
  const minutes = Math.max(1, Math.ceil(wordCount / wordsPerMinute));
  return `${minutes} min read`;
}

export default async function BlogPostPage({ params }) {
  const supabase = createServerClient();

  const { data: post } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('slug', params.slug)
    .eq('is_published', true)
    .single();

  if (!post) notFound();

  const { data: relatedPosts } = await supabase
    .from('blog_posts')
    .select('id, title, slug, excerpt')
    .eq('is_published', true)
    .neq('id', post.id)
    .limit(3);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.excerpt,
    image: post.cover_image || undefined,
    author: {
      '@type': 'Organization',
      name: 'Shiney Brain Academy',
    },
    datePublished: post.created_at,
    dateModified: post.updated_at || post.created_at,
    publisher: {
      '@type': 'Organization',
      name: 'Shiney Brain Academy',
      logo: {
        '@type': 'ImageObject',
        url: 'https://sbaskills.vercel.app/logo.png',
      },
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Navbar />
      <main className="min-h-screen bg-gray-50">
        {post.cover_image ? (
          <div className="w-full h-72 overflow-hidden">
            <img
              src={post.cover_image}
              alt={post.title}
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div className="w-full h-48 bg-brand-blue flex items-center justify-center text-6xl">
            📖
          </div>
        )}

        <article className="max-w-3xl mx-auto px-4 py-12">
          <Link
            href="/blog"
            className="text-sm text-brand-blue hover:underline mb-6 inline-block"
          >
            ← Back to Blog
          </Link>

          <h1 className="text-3xl font-extrabold text-gray-900 mb-3">{post.title}</h1>

          <p className="text-sm text-gray-400 mb-8">
            {new Date(post.created_at).toLocaleDateString('en-NG', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
            {' · '}
            {getReadingTime(post.content)}
          </p>

          {post.excerpt && (
            <p className="text-lg text-gray-600 font-medium mb-8 border-l-4 border-brand-yellow pl-4 italic">
              {post.excerpt}
            </p>
          )}

          <div className="prose prose-lg max-w-none text-gray-700 leading-relaxed whitespace-pre-wrap">
            {post.content}
          </div>

          {relatedPosts?.length > 0 && (
            <div className="mt-12 pt-8 border-t">
              <h3 className="text-xl font-bold mb-4">Related Posts</h3>
              <div className="grid gap-4 sm:grid-cols-3">
                {relatedPosts.map((related) => (
                  <Link
                    key={related.id}
                    href={`/blog/${related.slug}`}
                    className="border rounded-lg p-4 hover:shadow-md transition"
                  >
                    <p className="font-semibold text-sm">{related.title}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {related.excerpt?.slice(0, 80)}...
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </article>
      </main>
      <Footer />
    </>
  );
}