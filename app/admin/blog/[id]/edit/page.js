'use client';
import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase-client';

export default function EditBlogPost() {
  const router = useRouter();
  const params = useParams();
  const id = params.id;

  const [form, setForm] = useState({
    title: '',
    url_slug: '',
    meta_description: '',
    content: '',
    tags: [],
    category: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (id) {
      supabase
        .from('content_drafts')
        .select('*')
        .eq('id', id)
        .single()
        .then(({ data, error }) => {
          if (error) {
            alert('Post not found: ' + error.message);
            router.push('/admin/blog');
          } else if (data) {
            setForm(data);
          }
          setLoading(false);
        });
    }
  }, [id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const slug =
      form.url_slug ||
      form.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
    const { error } = await supabase
      .from('content_drafts')
      .update({
        title: form.title,
        url_slug: slug,
        meta_description: form.meta_description,
        content: form.content,
        tags: form.tags || [],
        category: form.category,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
    if (error) {
      alert('Error: ' + error.message);
    } else {
      alert('Post updated!');
      router.push('/admin/blog');
    }
    setSaving(false);
  };

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Edit Blog Post</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="text"
          placeholder="Title"
          className="w-full border p-2 rounded"
          value={form.title || ''}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          required
        />
        <input
          type="text"
          placeholder="Slug (URL) – leave blank to auto-generate"
          className="w-full border p-2 rounded"
          value={form.url_slug || ''}
          onChange={(e) => setForm({ ...form, url_slug: e.target.value })}
        />
        <textarea
          placeholder="Meta Description"
          className="w-full border p-2 rounded"
          rows="2"
          value={form.meta_description || ''}
          onChange={(e) => setForm({ ...form, meta_description: e.target.value })}
        />
        <textarea
          placeholder="Content (HTML or plain text)"
          className="w-full border p-2 rounded"
          rows="12"
          value={form.content || ''}
          onChange={(e) => setForm({ ...form, content: e.target.value })}
          required
        />
        <input
          type="text"
          placeholder="Tags (comma separated, e.g. JAMB, Exam, Tips)"
          className="w-full border p-2 rounded"
          value={form.tags?.join(', ') || ''}
          onChange={(e) =>
            setForm({
              ...form,
              tags: e.target.value.split(',').map((s) => s.trim()),
            })
          }
        />
        <input
          type="text"
          placeholder="Category"
          className="w-full border p-2 rounded"
          value={form.category || ''}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
        />
        <button
          type="submit"
          disabled={saving}
          className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Update Post'}
        </button>
      </form>
    </div>
  );
}