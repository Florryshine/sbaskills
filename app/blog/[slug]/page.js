'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import { notFound, useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Link from 'next/link';
import ShareButtons from '@/components/ShareButtons';
import MarkDoneButton from '@/components/MarkDoneButton';

export default function BlogPostPage({ params }) {
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createBrowserClient();

  useEffect(() => {
    async function loadPost() {
      const { data, error } = await supabase
        .from('blog_posts')
        .select('*')
        .eq('slug', params.slug)
        .eq('published', true)
        .single();

      if (!data || error) {
        setLoading(false);
        return;
      }
      setPost(data);
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
        {post.cover_image && (
          <div className="w-full h-64 overflow-hidden">
            <img src={post.cover_image} alt={post.title} className="w-full h-full object-cover" />
          </div>
        )}

        <article className="max-w-3xl mx-auto px-4 py-12">
          <Link href="/blog" className="text-sm text-brand-blue hover:underline mb-6 inline-block">
            ← Back to Blog
          </Link>

          <h1 className="text-3xl font-extrabold text-gray-900 mb-3">{post.title}</h1>

          <p className="text-sm text-gray-400 mb-8">
            {new Date(post.published_at || post.created_at).toLocaleDateString('en-NG', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
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

          {/* Mark as Done button */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <MarkDoneButton 
              activityType="blog" 
              activityId={post.id} 
              points={10} 
              label="📚 Mark as Read (Earn 10 Points)" 
            />
          </div>
        </article>
      </main>
      <Footer />
    </>
  );
}