'use client';

import { useState } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function NewBookPage() {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    author: '',
    price: '',
    cover_url: '',
    pdf_url: '',
    is_published: false,
  });
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const supabase = createBrowserClient();
    const { error } = await supabase.from('books').insert({
      title: formData.title,
      description: formData.description,
      author: formData.author,
      price: parseInt(formData.price) || 0,
      cover_url: formData.cover_url,
      pdf_url: formData.pdf_url,
      is_published: formData.is_published,
    });
    if (error) alert(error.message);
    else router.push('/admin/books');
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100">
        <Link href="/admin/books" className="text-sm text-brand-blue underline">← Back to Books</Link>
        <h1 className="text-2xl font-extrabold text-brand-blue mt-2">Add New Book</h1>
      </section>

      <form onSubmit={handleSubmit} className="space-y-6 bg-white rounded-2xl p-6 shadow-sm border">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-semibold mb-1">Title *</label>
            <input type="text" required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})}
              className="w-full rounded-xl border border-slate-200 px-4 py-2" />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Author</label>
            <input type="text" value={formData.author} onChange={e => setFormData({...formData, author: e.target.value})}
              className="w-full rounded-xl border border-slate-200 px-4 py-2" />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Price (₦) - 0 for free</label>
            <input type="number" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})}
              className="w-full rounded-xl border border-slate-200 px-4 py-2" />
          </div>
          <div className="flex items-center gap-3">
            <input type="checkbox" checked={formData.is_published} onChange={e => setFormData({...formData, is_published: e.target.checked})}
              className="w-5 h-5" />
            <label className="text-sm font-semibold">Publish immediately</label>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-semibold mb-1">Description</label>
            <textarea rows="3" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})}
              className="w-full rounded-xl border border-slate-200 px-4 py-2" />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Cover Image URL</label>
            <input type="url" value={formData.cover_url} onChange={e => setFormData({...formData, cover_url: e.target.value})}
              className="w-full rounded-xl border border-slate-200 px-4 py-2" placeholder="https://..." />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">PDF File URL</label>
            <input type="url" value={formData.pdf_url} onChange={e => setFormData({...formData, pdf_url: e.target.value})}
              className="w-full rounded-xl border border-slate-200 px-4 py-2" placeholder="https://..." />
          </div>
        </div>
        <button type="submit" disabled={saving}
          className="rounded-full bg-brand-yellow px-6 py-3 font-bold text-brand-dark hover:opacity-90">
          {saving ? 'Creating...' : 'Create Book'}
        </button>
      </form>
    </div>
  );
}