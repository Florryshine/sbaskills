'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import { notFound, useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Link from 'next/link';
import ShareButtons from '@/components/ShareButtons';
import MarkDoneButton from '@/components/MarkDoneButton';
import Comments from '@/components/Comments';

export default function BlogPostPage({ params }) {
  const [post, setPost] = useState(null);
  const [author, setAuthor] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createBrowserClient();

  useEffect(() => {
    async function loadPost() {
      const { data, error } = await supabase
  .from('content_drafts')
  .select('*')
  .eq('url_slug', params.slug)
  .eq('status', 'published')
  .maybeSingle();

      if (!data || error) {
        setLoading(false);
        return;
      }
      setPost(data);
      setAuthor(data.profiles);
      setLoading(false);
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
        {/* Cover image */}
        {post.cover_image && (
          <div className="w-full h-64 md:h-96 overflow-hidden relative">
            <img
              src={post.cover_image}
              alt={post.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/30" />
            <div className="absolute bottom-0 left-0 right-0 p-8 text-white">
              <h1 className="text-3xl md:text-4xl font-extrabold">{post.title}</h1>
            </div>
          </div>
        )}

        <article className="max-w-4xl mx-auto px-4 py-8">
          {!post.cover_image && (
            <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-4">
              {post.title}
            </h1>
          )}

          {/* Author & Date */}
          <div className="flex items-center gap-4 mb-6 text-sm text-gray-500 border-b pb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-brand-blue flex items-center justify-center text-white font-bold text-xs">
                {(author?.full_name || 'S')[0].toUpperCase()}
              </div>
              <span className="font-semibold text-gray-700">
                {author?.full_name || 'Shiney Brain Academy'}
              </span>
            </div>
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

          <ShareButtons
            title={post.title}
            url={`/blog/${post.url_slug}`}
            targetType="blog"
            targetId={post.id}
            description={post.meta_description || 'Read this blog post on Shiney Brain Academy!'}
          />

          <div
            className="prose prose-lg max-w-none text-gray-700 leading-relaxed mt-6"
            dangerouslySetInnerHTML={{ __html: post.content }}
          />

          {/* Mark as Done */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <MarkDoneButton
              activityType="blog"
              activityId={post.id}
              points={10}
              label="📚 Mark as Read (Earn 10 Points)"
            />
          </div>

          {/* Comments */}
          <Comments postId={post.id} />
        </article>
      </main>
      <Footer />
    </>
  );
}