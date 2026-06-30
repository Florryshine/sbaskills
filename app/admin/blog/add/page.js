'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase';

export default function AddBlogPost() {
  const router = useRouter();
  const supabase = createBrowserClient();
  const [form, setForm] = useState({
    title: '',
    url_slug: '',
    meta_description: '',
    content: '',
    tags: [],
    category: 'General',
    cover_image: '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const slug = form.url_slug || form.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const { error } = await supabase.from('content_drafts').insert({
      title: form.title,
      url_slug: slug,
      meta_description: form.meta_description,
      content: form.content,
      tags: form.tags,
      category: form.category,
      cover_image: form.cover_image || null,
      status: 'published',
      published_at: new Date().toISOString(),
    });
    if (error) {
      alert('Error: ' + error.message);
    } else {
      router.push('/admin/blog');
    }
    setLoading(false);
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Write New Blog Post</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="text"
          placeholder="Title"
          className="w-full border p-2 rounded"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          required
        />
        <input
          type="text"
          placeholder="Slug (URL) – leave blank to auto-generate"
          className="w-full border p-2 rounded"
          value={form.url_slug}
          onChange={(e) => setForm({ ...form, url_slug: e.target.value })}
        />
        <textarea
          placeholder="Meta Description"
          className="w-full border p-2 rounded"
          rows="2"
          value={form.meta_description}
          onChange={(e) => setForm({ ...form, meta_description: e.target.value })}
        />
        <textarea
          placeholder="Content (HTML or plain text)"
          className="w-full border p-2 rounded"
          rows="12"
          value={form.content}
          onChange={(e) => setForm({ ...form, content: e.target.value })}
          required
        />
        <input
          type="text"
          placeholder="Tags (comma separated, e.g. JAMB, Exam, Tips)"
          className="w-full border p-2 rounded"
          value={form.tags.join(', ')}
          onChange={(e) => setForm({ ...form, tags: e.target.value.split(',').map(s => s.trim()) })}
        />
        <input
          type="text"
          placeholder="Category"
          className="w-full border p-2 rounded"
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
        />
        <input
          type="text"
          placeholder="Cover image URL (optional)"
          className="w-full border p-2 rounded"
          value={form.cover_image}
          onChange={(e) => setForm({ ...form, cover_image: e.target.value })}
        />
        {form.cover_image && (
          <img src={form.cover_image} alt="Cover preview" className="h-32 rounded-lg object-cover" />
        )}
        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Publishing...' : 'Publish'}
        </button>
      </form>
    </div>
  );
}