'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function AdminBlogPage() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createBrowserClient();

  useEffect(() => {
    async function loadPosts() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/admin/login'); return; }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profile?.role !== 'admin') { router.push('/login'); return; }

      const { data } = await supabase
        .from('blog_posts')
        .select('*')
        .order('created_at', { ascending: false });

      setPosts(data || []);
      setLoading(false);
    }
    loadPosts();
  }, [router, supabase]);

  async function deletePost(id) {
    if (!confirm('Delete this post?')) return;
    await supabase.from('blog_posts').delete().eq('id', id);
    setPosts(posts.filter(p => p.id !== id));
  }

  async function togglePublish(post) {
    await supabase
      .from('blog_posts')
      .update({ 
        published: !post.published,
        published_at: !post.published ? new Date() : null
      })
      .eq('id', post.id);
    setPosts(posts.map(p => 
      p.id === post.id ? { ...p, published: !p.published } : p
    ));
  }

  if (loading) return <div className="p-8 text-center">Loading posts...</div>;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-brand-yellow">Blog</p>
            <h1 className="text-2xl font-extrabold text-brand-blue">Manage Blog Posts</h1>
            <p className="text-sm text-slate-500">{posts.length} posts total</p>
          </div>
          <Link href="/admin/blog/new" className="rounded-full bg-brand-yellow px-5 py-2.5 text-sm font-bold text-brand-dark">
            + New Post
          </Link>
        </div>
      </section>

      <section className="rounded-2xl bg-white shadow-sm border border-slate-100 overflow-hidden">
        {posts.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-4xl mb-4">✍️</p>
            <p className="text-gray-500">No blog posts yet. Create your first post!</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {posts.map((post) => (
              <div key={post.id} className="flex items-center gap-4 p-4 hover:bg-slate-50 transition">
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-800 truncate">{post.title}</p>
                  <p className="text-sm text-slate-500 truncate">{post.slug}</p>
                  <span className={	ext-xs px-2 py-0.5 rounded-full }>
                    {post.published ? 'Published' : 'Draft'}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Link href={/admin/blog/} className="text-brand-blue text-sm font-bold hover:underline">
                    Edit
                  </Link>
                  <button onClick={() => togglePublish(post)} className={	ext-sm font-bold  hover:underline}>
                    {post.published ? 'Unpublish' : 'Publish'}
                  </button>
                  <button onClick={() => deletePost(post.id)} className="text-red-500 text-sm font-bold hover:underline">
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
