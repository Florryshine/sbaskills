'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import dynamic from 'next/dynamic';
import Image from 'next/image';

// Load interactive components only on client
const ShareButtons = dynamic(() => import('@/components/ShareButtons'), { ssr: false });
const MarkDoneButton = dynamic(() => import('@/components/MarkDoneButton'), { ssr: false });
const Comments = dynamic(() => import('@/components/Comments'), { ssr: false });

export default function BlogPostPage({ params }) {
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

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
        console.error('Error loading post:', err);
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

  // Parse image prompts if they exist
  const images = post.image_prompts ? JSON.parse(post.image_prompts) : [];
  const heroImage = images.find(img => img.type === 'hero')?.description || null;

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gray-50">
        <article className="max-w-4xl mx-auto px-4 py-8">
          {/* Hero Image placeholder */}
          {heroImage && (
            <div className="w-full h-64 md:h-80 bg-gray-200 rounded-lg mb-6 overflow-hidden relative">
              <div className="w-full h-full flex items-center justify-center bg-gray-100">
                <span className="text-gray-400 text-sm">📷 {heroImage}</span>
              </div>
            </div>
          )}

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

          {/* Interactive components (client-only) */}
          {isClient && (
            <>
              <ShareButtons
                title={post.title}
                url={`/blog/${post.url_slug}`}
                targetType="blog"
                targetId={post.id}
                description={post.meta_description || 'Read this blog post on Shiney Brain Academy!'}
              />
            </>
          )}

          {/* Blog Content */}
          <div
            className="prose prose-lg max-w-none text-gray-700 leading-relaxed mt-6"
            dangerouslySetInnerHTML={{ __html: post.content || 'No content yet.' }}
          />

          {/* FAQ Section */}
          {post.schemas && JSON.parse(post.schemas).length > 0 && (
            <div className="mt-8 border-t pt-6">
              <h3 className="text-xl font-bold mb-4">Frequently Asked Questions</h3>
              {JSON.parse(post.schemas).map((item, i) => (
                <div key={i} className="mb-4 border-b pb-4">
                  <p className="font-semibold text-gray-800">{item.question}</p>
                  <p className="text-gray-600">{item.answer}</p>
                </div>
              ))}
            </div>
          )}

          {/* Internal Links */}
          {post.internal_links && post.internal_links.length > 0 && (
            <div className="mt-8 border-t pt-6">
              <h3 className="text-xl font-bold mb-4">Related Tools</h3>
              <ul className="list-disc pl-5">
                {post.internal_links.map((link, i) => (
                  <li key={i} className="text-blue-600">{link}</li>
                ))}
              </ul>
            </div>
          )}

          {/* CTA */}
          {post.cta && (
            <div className="mt-8 p-6 bg-brand-yellow/10 rounded-lg border border-brand-yellow">
              <p className="text-lg font-medium">{post.cta}</p>
            </div>
          )}

          {/* Interactive components (client-only) */}
          {isClient && (
            <>
              <div className="mt-8 pt-6 border-t border-gray-200">
                <MarkDoneButton
                  activityType="blog"
                  activityId={post.id}
                  points={10}
                  label="📚 Mark as Read (Earn 10 Points)"
                />
              </div>
              <Comments postId={post.id} />
            </>
          )}
        </article>
      </main>
      <Footer />
    </>
  );
}