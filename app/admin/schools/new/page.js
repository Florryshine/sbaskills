'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export default function NewSchoolPage() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({
    name: '',
    slug: '',
    slugEdited: false,
    logo_url: '',
    address: '',
    principal_name: '',
    contact_phone: '',
    contact_email: '',
    about: '',
  });

  useEffect(() => {
    const supabase = createBrowserClient();
    async function check() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/admin/login'); return; }
      const { data: profile } = await supabase
        .from('profiles').select('role').eq('id', user.id).single();
      if (profile?.role !== 'admin') { router.push('/login'); return; }
      setCheckingAuth(false);
    }
    check();
  }, [router]);

  function handleNameChange(name) {
    setForm(prev => ({
      ...prev,
      name,
      slug: prev.slugEdited ? prev.slug : slugify(name),
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (!form.name.trim() || !form.slug.trim()) {
      setError('School name and slug are required.');
      return;
    }

    setSaving(true);
    const supabase = createBrowserClient();

    const { data, error: insertError } = await supabase
      .from('schools')
      .insert({
        name: form.name.trim(),
        slug: slugify(form.slug),
        logo_url: form.logo_url.trim() || null,
        address: form.address.trim() || null,
        principal_name: form.principal_name.trim() || null,
        contact_phone: form.contact_phone.trim() || null,
        contact_email: form.contact_email.trim() || null,
        about: form.about.trim() || null,
      })
      .select()
      .single();

    setSaving(false);

    if (insertError) {
      setError(
        insertError.code === '23505'
          ? 'That slug is already taken — try a different one.'
          : insertError.message
      );
      return;
    }

    router.push(`/admin/schools/${data.id}`);
  }

  if (checkingAuth) return (
    <div className="flex items-center justify-center py-20">
      <p className="text-gray-500">Loading...</p>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <section className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100">
        <p className="text-xs font-bold uppercase tracking-widest text-brand-yellow">
          New
        </p>
        <h1 className="mt-1 text-2xl font-extrabold text-brand-blue">Add School</h1>
        <p className="mt-1 text-sm text-slate-500">
          Creates the school's page automatically at /school/&lt;slug&gt;
        </p>
      </section>

      <form onSubmit={handleSubmit} className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100 space-y-5">
        {error && (
          <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-semibold mb-1">School Name *</label>
          <input
            type="text"
            required
            value={form.name}
            onChange={e => handleNameChange(e.target.value)}
            placeholder="e.g., Royal College"
            className="w-full rounded-xl border border-slate-200 px-4 py-2 outline-none focus:border-brand-blue"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold mb-1">Page URL (slug) *</label>
          <div className="flex items-center rounded-xl border border-slate-200 px-4 py-2 focus-within:border-brand-blue">
            <span className="text-slate-400 text-sm shrink-0">shineybrainacademy.com/school/</span>
            <input
              type="text"
              required
              value={form.slug}
              onChange={e => setForm(prev => ({ ...prev, slug: e.target.value, slugEdited: true }))}
              className="flex-1 outline-none text-sm min-w-0"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold mb-1">Logo URL</label>
          <input
            type="text"
            value={form.logo_url}
            onChange={e => setForm(prev => ({ ...prev, logo_url: e.target.value }))}
            placeholder="https://..."
            className="w-full rounded-xl border border-slate-200 px-4 py-2 outline-none focus:border-brand-blue"
          />
          <p className="mt-1 text-xs text-slate-400">
            Paste an image link for now — upload support can be added later.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold mb-1">Principal Name</label>
            <input
              type="text"
              value={form.principal_name}
              onChange={e => setForm(prev => ({ ...prev, principal_name: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 px-4 py-2 outline-none focus:border-brand-blue"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Phone</label>
            <input
              type="text"
              value={form.contact_phone}
              onChange={e => setForm(prev => ({ ...prev, contact_phone: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 px-4 py-2 outline-none focus:border-brand-blue"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold mb-1">Email</label>
          <input
            type="email"
            value={form.contact_email}
            onChange={e => setForm(prev => ({ ...prev, contact_email: e.target.value }))}
            className="w-full rounded-xl border border-slate-200 px-4 py-2 outline-none focus:border-brand-blue"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold mb-1">Address</label>
          <input
            type="text"
            value={form.address}
            onChange={e => setForm(prev => ({ ...prev, address: e.target.value }))}
            className="w-full rounded-xl border border-slate-200 px-4 py-2 outline-none focus:border-brand-blue"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold mb-1">About (optional)</label>
          <textarea
            rows={3}
            value={form.about}
            onChange={e => setForm(prev => ({ ...prev, about: e.target.value }))}
            placeholder="A short description shown on the school's public page."
            className="w-full rounded-xl border border-slate-200 px-4 py-2 outline-none focus:border-brand-blue"
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-brand-yellow text-brand-dark px-6 py-3 rounded-full font-bold hover:opacity-90 disabled:opacity-50"
        >
          {saving ? 'Creating...' : 'Create School'}
        </button>
      </form>
    </div>
  );
}
