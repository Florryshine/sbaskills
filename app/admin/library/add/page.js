'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase-client';

export default function AddBook() {
  const router = useRouter();
  const [form, setForm] = useState({
    title: '',
    author: '',
    description: '',
    price: 0,
  });
  const [coverFile, setCoverFile] = useState(null);
  const [fileFile, setFileFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Upload a file to Supabase Storage
  const handleUpload = async (file, folder) => {
    if (!file) return null;
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}.${fileExt}`;
    const path = `${folder}/${fileName}`;
    const { data, error } = await supabase.storage
      .from('books')
      .upload(path, file);
    if (error) throw error;
    const { data: urlData } = supabase.storage
      .from('books')
      .getPublicUrl(path);
    return urlData.publicUrl;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setUploading(true);
    try {
      let coverUrl = null;
      let fileUrl = null;
      if (coverFile) coverUrl = await handleUpload(coverFile, 'covers');
      if (fileFile) fileUrl = await handleUpload(fileFile, 'files');

      const { error } = await supabase.from('books').insert([
        {
          ...form,
          cover_image_url: coverUrl,
          file_url: fileUrl,
        },
      ]);
      if (error) throw error;
      router.push('/admin/library');
    } catch (err) {
      alert(err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-6 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Add Book</h1>
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
          placeholder="Author"
          className="w-full border p-2 rounded"
          value={form.author}
          onChange={(e) => setForm({ ...form, author: e.target.value })}
          required
        />
        <textarea
          placeholder="Description"
          className="w-full border p-2 rounded"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
        <input
          type="number"
          step="0.01"
          placeholder="Price (₦)"
          className="w-full border p-2 rounded"
          value={form.price}
          onChange={(e) =>
            setForm({ ...form, price: parseFloat(e.target.value) || 0 })
          }
        />

        {/* Cover Image Upload */}
        <div>
          <label className="block text-sm font-medium mb-1">Book Cover</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setCoverFile(e.target.files[0])}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
        </div>

        {/* PDF / eBook Upload */}
        <div>
          <label className="block text-sm font-medium mb-1">PDF / eBook</label>
          <input
            type="file"
            accept=".pdf,.epub,.mobi"
            onChange={(e) => setFileFile(e.target.files[0])}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
        </div>

        <button
          type="submit"
          className="btn-primary w-full"
          disabled={uploading || loading}
        >
          {uploading ? 'Uploading...' : loading ? 'Saving...' : 'Save Book'}
        </button>
      </form>
    </div>
  );
}