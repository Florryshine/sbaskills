'use client';

import { useState } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function NewMaterial() {
  const [form, setForm] = useState({ title: '', description: '', subject: '' });
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const supabase = createBrowserClient();

  const handleSave = async () => {
    if (!form.title || !file) {
      alert('Please enter a title and choose a file.');
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const ext = file.name.split('.').pop();
      const path = `${user.id}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('tutor-materials')
        .upload(path, file, { contentType: file.type });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('tutor-materials').getPublicUrl(path);

      const { error: insertError } = await supabase.from('tutor_materials').insert({
        tutor_id: user.id,
        title: form.title,
        description: form.description,
        subject: form.subject || null,
        file_url: urlData.publicUrl,
        file_type: file.type,
      });
      if (insertError) throw insertError;

      alert('✅ Material uploaded!');
      router.push('/tutor');
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 shadow-sm border">
        <Link href="/tutor" className="text-sm text-brand-blue underline">← Back to Tutor Dashboard</Link>
        <h1 className="text-2xl font-extrabold text-brand-blue mt-2">📁 Upload Material</h1>
        <p className="text-sm text-gray-500">Upload notes, recordings, or any file for your students.</p>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm border space-y-4">
        <div>
          <label className="block text-sm font-semibold mb-1">Title *</label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full rounded-xl border border-slate-200 px-4 py-2"
            placeholder="e.g. Week 3 Physics Recording"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold mb-1">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full rounded-xl border border-slate-200 px-4 py-2 h-24"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold mb-1">Subject</label>
          <input
            type="text"
            value={form.subject}
            onChange={(e) => setForm({ ...form, subject: e.target.value })}
            className="w-full rounded-xl border border-slate-200 px-4 py-2"
            placeholder="e.g. Physics"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold mb-1">File *</label>
          <input
            type="file"
            onChange={(e) => setFile(e.target.files[0])}
            className="w-full rounded-xl border border-slate-200 px-4 py-2"
          />
          <p className="text-xs text-gray-400 mt-1">PDF, audio, video, or any document.</p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-brand-blue text-white py-3 rounded-xl font-bold hover:opacity-90 disabled:opacity-50"
        >
          {saving ? 'Uploading...' : 'Upload Material'}
        </button>
      </div>
    </div>
  );
}