import { createServerClient } from '@/lib/supabase-server';
import { notFound } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Link from 'next/link';
import ShareButtons from '@/components/ShareButtons';

export default async function BlogPostPage({ params }) {
  const supabase = createServerClient();
  const { slug } = params;

  // Fetch the post by slug
  const { data: post, error } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('slug', slug)
    .eq('published', true)
    .single();

  // If no post or error, show 404
  if (!post || error) {
    notFound();
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gray-50">
        {/* Cover image */}
        {post.cover_image && (
          <div className="w-full h-64 overflow-hidden">
            <img
              src={post.cover_image}
              alt={post.title}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        <article className="max-w-3xl mx-auto px-4 py-12">
          <Link
            href="/blog"
            className="text-sm text-brand-blue hover:underline mb-6 inline-block"
          >
            ← Back to Blog
          </Link>

          <h1 className="text-3xl font-extrabold text-gray-900 mb-3">
            {post.title}
          </h1>

          <p className="text-sm text-gray-400 mb-8">
            {new Date(post.published_at || post.created_at).toLocaleDateString(
              'en-NG',
              { day: 'numeric', month: 'long', year: 'numeric' }
            )}
          </p>

          {post.excerpt && (
            <p className="text-lg text-gray-600 font-medium mb-8 border-l-4 border-brand-yellow pl-4 italic">
              {post.excerpt}
            </p>
          )}

          <ShareButtons 
            title={post.title}
            url={`/blog/${post.slug}`}
            targetType="blog"
            targetId={post.id}
            description={post.excerpt || 'Read this blog post on Shiney Brain Academy!'}
          />

          <div
            className="prose prose-lg max-w-none text-gray-700 leading-relaxed mt-6"
            dangerouslySetInnerHTML={{ __html: post.content }}
          />
        </article>
      </main>
      <Footer />
    </>
  );
}

{/* Mark as Done button */}
{user && (
  <button
    onClick={async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const result = await completeActivity(user.id, 'blog', post.id, 10);
        if (result.success) {
          alert('✅ You earned 10 points for reading this blog!');
        } else {
          alert(result.message);
        }
      }
    }}
    className="mt-6 bg-brand-yellow text-brand-dark px-6 py-3 rounded-full font-bold hover:opacity-90"
  >
    📚 Mark as Done (Earn 10 Points)
  </button>
)}