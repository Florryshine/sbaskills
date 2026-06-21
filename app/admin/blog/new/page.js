'use client';

import { useState } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function NewBlogPost() {
  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    content: '',
    excerpt: '',
    cover_image: '',
    published: false,
  });
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const supabase = createBrowserClient();

  const generateSlug = (text) => {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert('Please login as admin');
      setSaving(false);
      return;
    }

    const { error } = await supabase
      .from('blog_posts')
      .insert({
        title: formData.title,
        slug: formData.slug || generateSlug(formData.title),
        content: formData.content,
        excerpt: formData.excerpt,
        cover_image: formData.cover_image,
        published: formData.published,
        author_id: user.id,
        published_at: formData.published ? new Date() : null,
      });

    if (error) {
      alert('Error: ' + error.message);
    } else {
      router.push('/admin/blog');
    }
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100">
        <Link href="/admin/blog" className="text-sm text-brand-blue underline">← Back to Blog</Link>
        <h1 className="text-2xl font-extrabold text-brand-blue mt-2">New Blog Post</h1>
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
          <label className="block text-sm font-semibold mb-1">Slug (URL) – leave blank to auto-generate</label>
          <input
            type="text"
            value={formData.slug}
            onChange={e => setFormData({ ...formData, slug: e.target.value })}
            className="w-full rounded-xl border border-slate-200 px-4 py-2"
            placeholder="e.g., my-blog-post"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold mb-1">Excerpt (short summary)</label>
          <textarea
            rows="2"
            value={formData.excerpt}
            onChange={e => setFormData({ ...formData, excerpt: e.target.value })}
            className="w-full rounded-xl border border-slate-200 px-4 py-2"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold mb-1">Content * (HTML supported)</label>
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
          <label className="text-sm font-semibold">Publish immediately</label>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="rounded-full bg-brand-yellow px-6 py-3 font-bold text-brand-dark hover:opacity-90"
        >
          {saving ? 'Saving...' : 'Save Post'}
        </button>
      </form>
    </div>
  );
}
