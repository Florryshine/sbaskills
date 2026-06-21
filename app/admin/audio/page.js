'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function AdminAudioPage() {
  const [audios, setAudios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    audio_url: '',
    cover_image: '',
  });
  const router = useRouter();
  const supabase = createBrowserClient();

  useEffect(() => {
    async function loadAudios() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/admin/login'); return; }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profile?.role !== 'admin') { router.push('/login'); return; }

      const { data } = await supabase
        .from('audio_library')
        .select('*')
        .order('created_at', { ascending: false });

      setAudios(data || []);
      setLoading(false);
    }
    loadAudios();
  }, [router, supabase]);

  async function uploadAudio(file) {
    setUploading(true);
    const fileName = ${Date.now()}_;
    
    const { error: uploadError } = await supabase.storage
      .from('audio')
      .upload(fileName, file);

    if (uploadError) {
      alert('Upload failed: ' + uploadError.message);
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage
      .from('audio')
      .getPublicUrl(fileName);

    setFormData({ ...formData, audio_url: urlData.publicUrl });
    setUploading(false);
    alert('Audio uploaded!');
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!formData.title || !formData.audio_url) {
      alert('Title and audio file are required');
      return;
    }

    const { error } = await supabase
      .from('audio_library')
      .insert({
        title: formData.title,
        description: formData.description,
        audio_url: formData.audio_url,
        cover_image: formData.cover_image,
      });

    if (error) {
      alert('Error: ' + error.message);
    } else {
      alert('Audio added!');
      setFormData({ title: '', description: '', audio_url: '', cover_image: '' });
      // Refresh list
      const { data } = await supabase
        .from('audio_library')
        .select('*')
        .order('created_at', { ascending: false });
      setAudios(data || []);
    }
  }

  async function deleteAudio(id) {
    if (!confirm('Delete this audio?')) return;
    await supabase.from('audio_library').delete().eq('id', id);
    setAudios(audios.filter(a => a.id !== id));
  }

  if (loading) return <div className="p-8 text-center">Loading audio...</div>;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100">
        <p className="text-xs font-bold uppercase tracking-widest text-brand-yellow">Audio</p>
        <h1 className="text-2xl font-extrabold text-brand-blue">Manage Audio Library</h1>
        <p className="text-sm text-slate-500">{audios.length} audio files</p>
      </section>

      {/* Add Audio Form */}
      <section className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100">
        <h2 className="font-bold text-lg mb-4">Add New Audio</h2>
        <form onSubmit={handleSave} className="space-y-4">
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
            <label className="block text-sm font-semibold mb-1">Description</label>
            <input
              type="text"
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              className="w-full rounded-xl border border-slate-200 px-4 py-2"
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

          <div>
            <label className="block text-sm font-semibold mb-1">Audio File</label>
            <div className="flex items-center gap-3">
              <input
                type="file"
                accept="audio/*"
                onChange={(e) => {
                  if (e.target.files?.[0]) uploadAudio(e.target.files[0]);
                  e.target.value = '';
                }}
                disabled={uploading}
                className="flex-1"
              />
              {uploading && <span className="text-sm text-blue-600">Uploading...</span>}
            </div>
            {formData.audio_url && (
              <p className="text-xs text-green-600 mt-1">✅ File uploaded</p>
            )}
          </div>

          <button
            type="submit"
            disabled={uploading}
            className="rounded-full bg-brand-yellow px-6 py-2.5 font-bold text-brand-dark hover:opacity-90"
          >
            Add Audio
          </button>
        </form>
      </section>

      {/* Audio List */}
      <section className="rounded-2xl bg-white shadow-sm border border-slate-100 overflow-hidden">
        {audios.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-4xl mb-4">🎵</p>
            <p className="text-gray-500">No audio files yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {audios.map((audio) => (
              <div key={audio.id} className="flex items-center gap-4 p-4 hover:bg-slate-50 transition">
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-800">{audio.title}</p>
                  <p className="text-sm text-slate-500 truncate">{audio.description || 'No description'}</p>
                  <p className="text-xs text-slate-400">🎧 {audio.plays || 0} plays</p>
                </div>
                <button
                  onClick={() => deleteAudio(audio.id)}
                  className="text-red-500 text-sm font-bold hover:underline"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
