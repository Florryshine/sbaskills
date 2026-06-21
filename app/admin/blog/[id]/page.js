'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

export default function EditBlogPost() {
  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    content: '',
    excerpt: '',
    cover_image: '',
    published: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const params = useParams();
  const postId = params.id;
  const supabase = createBrowserClient();

  useEffect(() => {
    async function loadPost() {
      const { data } = await supabase
        .from('blog_posts')
        .select('*')
        .eq('id', postId)
        .single();

      if (data) {
        setFormData({
          title: data.title || '',
          slug: data.slug || '',
          content: data.content || '',
          excerpt: data.excerpt || '',
          cover_image: data.cover_image || '',
          published: data.published || false,
        });
      }
      setLoading(false);
    }
    loadPost();
  }, [postId, supabase]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    const { error } = await supabase
      .from('blog_posts')
      .update({
        title: formData.title,
        slug: formData.slug,
        content: formData.content,
        excerpt: formData.excerpt,
        cover_image: formData.cover_image,
        published: formData.published,
        updated_at: new Date(),
      })
      .eq('id', postId);

    if (error) {
      alert('Error: ' + error.message);
    } else {
      alert('Post updated!');
      router.push('/admin/blog');
    }
    setSaving(false);
  };

  if (loading) return <div className="p-8 text-center">Loading post...</div>;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100">
        <Link href="/admin/blog" className="text-sm text-brand-blue underline">← Back to Blog</Link>
        <h1 className="text-2xl font-extrabold text-brand-blue mt-2">Edit Post</h1>
      </section>

      <form onSubmit={handleSubmit} className="space-y-6 bg-white rounded-2xl p-6 shadow-sm border">
        <div>
          <label className="block text-sm font-semibold mb-1">Title *</label>
          <input
            type="text"
            required
            value={formData.title}
            onChange={e => setFormData({ ...formData, title: e.target.value })}
            className="w-full rounded-xl border border-slate-200 px-4 py-2"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold mb-1">Slug</label>
          <input
            type="text"
            value={formData.slug}
            onChange={e => setFormData({ ...formData, slug: e.target.value })}
            className="w-full rounded-xl border border-slate-200 px-4 py-2"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold mb-1">Excerpt</label>
          <textarea
            rows="2"
            value={formData.excerpt}
            onChange={e => setFormData({ ...formData, excerpt: e.target.value })}
            className="w-full rounded-xl border border-slate-200 px-4 py-2"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold mb-1">Content *</label>
          <textarea
            rows="10"
            required
            value={formData.content}
            onChange={e => setFormData({ ...formData, content: e.target.value })}
            className="w-full rounded-xl border border-slate-200 px-4 py-2 font-mono text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold mb-1">Cover Image URL</label>
          <input
            type="url"
            value={formData.cover_image}
            onChange={e => setFormData({ ...formData, cover_image: e.target.value })}
            className="w-full rounded-xl border border-slate-200 px-4 py-2"
            placeholder="https://..."
          />
        </div>

        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={formData.published}
            onChange={e => setFormData({ ...formData, published: e.target.checked })}
            className="w-5 h-5"
          />
          <label className="text-sm font-semibold">Published</label>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="rounded-full bg-brand-yellow px-6 py-3 font-bold text-brand-dark hover:opacity-90"
        >
          {saving ? 'Saving...' : 'Update Post'}
        </button>
      </form>
    </div>
  );
}
