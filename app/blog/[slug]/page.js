'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import ShareButtons from '@/components/ShareButtons';
import MarkDoneButton from '@/components/MarkDoneButton';
import Comments from '@/components/Comments';

export default function BlogPostPage({ params }) {
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadPost() {
      try {
        const supabase = createBrowserClient();
        const { data, error } = await supabase
          .from('content_drafts')
          .select('*')
          .eq('url_slug', params.slug)
          .eq('status', 'published')
          .maybeSingle();

        if (error) throw new Error(error.message);
        if (!data) throw new Error('Post not found');
        setPost(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadPost();
  }, [params.slug]);

  // Loading state
  if (loading) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen flex items-center justify-center">Loading...</div>
        <Footer />
      </>
    );
  }

  // Error state
  if (error) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen flex items-center justify-center flex-col p-6">
          <h2 className="text-xl font-bold text-red-600">Error loading post</h2>
          <p className="text-gray-700 mt-2">{error}</p>
          <p className="text-sm text-gray-500 mt-1">Please try again later.</p>
        </div>
        <Footer />
      </>
    );
  }

  if (!post) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen flex items-center justify-center">Post not found</div>
        <Footer />
      </>
    );
  }

  // Extract cover image from image_prompts (if any)
  const coverImage = post.image_prompts?.[0]?.description || null;
  // Or if you have a cover_image_url column:
  // const coverImage = post.cover_image_url || null;

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gray-50">
        {/* Cover image – if available */}
        {coverImage && (
          <div className="w-full h-64 md:h-96 overflow-hidden relative">
            <img
              src={coverImage}
              alt={post.title}
              className="w-full h-full object-cover"
              onError={(e) => (e.target.style.display = 'none')} // hide on error
            />
            <div className="absolute inset-0 bg-black/30" />
            <div className="absolute bottom-0 left-0 right-0 p-8 text-white">
              <h1 className="text-3xl md:text-4xl font-extrabold">{post.title}</h1>
            </div>
          </div>
        )}

        <article className="max-w-4xl mx-auto px-4 py-8">
          {!coverImage && (
            <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-4">
              {post.title}
            </h1>
          )}

          {/* Author & Date */}
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

          {/* ShareButtons – safe render */}
          <ErrorBoundary fallback={null}>
            <ShareButtons
              title={post.title}
              url={`/blog/${post.url_slug}`}
              targetType="blog"
              targetId={post.id}
              description={post.meta_description || 'Read this blog post on Shiney Brain Academy!'}
            />
          </ErrorBoundary>

          {/* Blog content */}
          <div
            className="prose prose-lg max-w-none text-gray-700 leading-relaxed mt-6"
            dangerouslySetInnerHTML={{ __html: post.content }}
          />

          {/* Mark as Done – safe render */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <ErrorBoundary fallback={null}>
              <MarkDoneButton
                activityType="blog"
                activityId={post.id}
                points={10}
                label="📚 Mark as Read (Earn 10 Points)"
              />
            </ErrorBoundary>
          </div>

          {/* Comments – safe render */}
          <ErrorBoundary fallback={null}>
            <Comments postId={post.id} />
          </ErrorBoundary>
        </article>
      </main>
      <Footer />
    </>
  );
}

// Simple ErrorBoundary component (client-side only)
function ErrorBoundary({ children, fallback }) {
  const [hasError, setHasError] = useState(false);
  useEffect(() => {
    const handler = () => setHasError(true);
    window.addEventListener('error', handler);
    return () => window.removeEventListener('error', handler);
  }, []);
  if (hasError) return fallback || null;
  return children;
}