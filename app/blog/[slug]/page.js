import { createClient } from '@supabase/supabase-js';
import { notFound } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export const dynamic = 'force-dynamic';

export default async function BlogPostPage({ params }) {
  try {
    // Create a Supabase client with the service role key (no cookies, no auth)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const { data: post, error } = await supabase
      .from('content_drafts')
      .select('*')
      .eq('url_slug', params.slug)
      .eq('status', 'published')
      .maybeSingle();

    if (error) {
      console.error('Supabase error:', error);
      throw new Error(error.message);
    }

    if (!post) {
      notFound();
    }

    return (
      <>
        <Navbar />
        <main className="min-h-screen bg-gray-50">
          <article className="max-w-4xl mx-auto px-4 py-8">
            <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-4">
              {post.title}
            </h1>
            <div className="flex items-center gap-4 mb-6 text-sm text-gray-500 border-b pb-4">
              <span className="font-semibold text-gray-700">Shiney Brain Academy</span>
              <span>•</span>
              <span>
                {new Date(post.published_at || post.created_at).toLocaleDateString('en-NG', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </span>
              <span>•</span>
              <span>{Math.ceil((post.content?.split(/\s+/).length || 0) / 200)} min read</span>
            </div>
            {post.meta_description && (
              <p className="text-lg text-gray-600 font-medium mb-6 border-l-4 border-brand-yellow pl-4 italic">
                {post.meta_description}
              </p>
            )}
            <div
              className="prose prose-lg max-w-none text-gray-700 leading-relaxed mt-6"
              dangerouslySetInnerHTML={{ __html: post.content || 'No content yet.' }}
            />
          </article>
        </main>
        <Footer />
      </>
    );
  } catch (err) {
    console.error('Blog post error:', err);
    return (
      <>
        <Navbar />
        <main className="min-h-screen flex items-center justify-center flex-col p-6">
          <h2 className="text-xl font-bold text-red-600">Error loading post</h2>
          <p className="text-gray-700 mt-2">{err.message}</p>
          <p className="text-sm text-gray-500 mt-1">Please try again later.</p>
        </main>
        <Footer />
      </>
    );
  }
}