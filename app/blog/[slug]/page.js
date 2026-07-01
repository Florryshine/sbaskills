'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export default function BlogPostPage({ params }) {
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadPost() {
      try {
        console.log('🔍 Fetching post with slug:', params.slug);
        const supabase = createBrowserClient();
        
        // Add a timeout to catch hanging requests
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Request timed out after 10 seconds')), 10000)
        );

        const queryPromise = supabase
          .from('content_drafts')
          .select('*')
          .eq('url_slug', params.slug)
          .eq('status', 'published')
          .maybeSingle();

        const { data, error } = await Promise.race([queryPromise, timeoutPromise]);

        if (error) {
          console.error('❌ Supabase error:', error);
          throw new Error(error.message);
        }
        if (!data) {
          console.warn('⚠️ No post found for slug:', params.slug);
          throw new Error('Post not found');
        }
        console.log('✅ Post loaded:', data.title);
        setPost(data);
      } catch (err) {
        console.error('🔥 Error loading post:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadPost();
  }, [params.slug]);

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen flex items-center justify-center">Loading...</div>
        <Footer />
      </>
    );
  }

  if (error) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen flex items-center justify-center flex-col p-6">
          <h2 className="text-xl font-bold text-red-600">Error loading post</h2>
          <p className="text-gray-700 mt-2">{error}</p>
          <p className="text-sm text-gray-500 mt-1">Check console for details.</p>
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
}