'use client';
import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase';

export default function EditBook() {
  const router = useRouter();
  const params = useParams();
  const id = params.id;
  const supabase = createBrowserClient();

  const [form, setForm] = useState({
    title: '',
    author: '',
    description: '',
    price: 0,
    cover_url: '',      // renamed
    pdf_url: '',        // renamed
  });
  const [coverFile, setCoverFile] = useState(null);
  const [fileFile, setFileFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (id) {
      supabase
        .from('books')
        .select('*')
        .eq('id', id)
        .single()
        .then(({ data }) => {
          if (data) setForm(data);
          setLoading(false);
        });
    }
  }, [id]);

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
      let coverUrl = form.cover_url;
      let fileUrl = form.pdf_url;
      if (coverFile) coverUrl = await handleUpload(coverFile, 'covers');
      if (fileFile) fileUrl = await handleUpload(fileFile, 'files');

      // Build update object; do NOT change is_published – keep existing value
      const updateData = {
        title: form.title,
        author: form.author,
        description: form.description,
        price: form.price,
        cover_url: coverUrl,
        pdf_url: fileUrl,
        // is_published is NOT included – it stays as it is in the DB
      };

      const { error } = await supabase
        .from('books')
        .update(updateData)
        .eq('id', id);
      if (error) throw error;
      router.push('/admin/library');
    } catch (err) {
      alert(err.message);
    } finally {
      setUploading(false);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="p-6 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Edit Book</h1>
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

        {/* Current Cover */}
        {form.cover_url && (
          <div>
            <p className="text-sm font-medium">Current Cover</p>
            <img
              src={form.cover_url}
              alt="Cover"
              className="h-24 w-auto object-cover"
            />
          </div>
        )}
        <div>
          <label className="block text-sm font-medium mb-1">
            Replace Cover (optional)
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setCoverFile(e.target.files[0])}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
        </div>

        {/* Current File */}
        {form.pdf_url && (
          <div>
            <p className="text-sm font-medium">Current File</p>
            <a
              href={form.pdf_url}
              target="_blank"
              className="text-blue-600 underline text-sm"
            >
              Download
            </a>
          </div>
        )}
        <div>
          <label className="block text-sm font-medium mb-1">
            Replace PDF/eBook (optional)
          </label>
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
          disabled={uploading}
        >
          {uploading ? 'Updating...' : 'Update Book'}
        </button>
      </form>
    </div>
  );
}