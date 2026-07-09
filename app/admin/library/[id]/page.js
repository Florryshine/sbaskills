'use client';
import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase-client';
import Link from 'next/link';
import MediaPicker from '@/components/MediaPicker';

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
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [coverFile, setCoverFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [knowledgeAssetId, setKnowledgeAssetId] = useState(null);

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
            setForm({
              title: data.title || '',
              url_slug: data.url_slug || '',
              meta_description: data.meta_description || '',
              content: data.content || '',
              tags: data.tags || [],
              category: data.category || '',
            });
            setCoverImageUrl(data.cover_image || '');
            if (data.knowledge_asset_id) {
              setKnowledgeAssetId(data.knowledge_asset_id);
            }
          }
          setLoading(false);
        });
    }
  }, [id]);

  async function uploadCoverImage(file) {
    const fileExt = file.name.split('.').pop();
    const fileName = `cover-${Date.now()}.${fileExt}`;
    const filePath = `blog-images/${fileName}`;

    const { data, error } = await supabase.storage
      .from('blog-images')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) throw error;

    const { data: urlData } = supabase.storage
      .from('blog-images')
      .getPublicUrl(filePath);

    return urlData.publicUrl;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setUploading(true);

    try {
      let coverUrl = coverImageUrl;
      if (coverFile) {
        coverUrl = await uploadCoverImage(coverFile);
      }

      const slug = form.url_slug || form.title
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
          cover_image: coverUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;

      alert('✅ Post updated successfully!');
      router.push('/admin/blog');
    } catch (err) {
      alert('❌ Error: ' + err.message);
    } finally {
      setSaving(false);
      setUploading(false);
    }
  }

  const insertImage = (url) => {
    const textarea = document.getElementById('content-editor');
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const before = form.content.substring(0, start);
      const after = form.content.substring(end);
      const newContent = before + `\n\n![Image](${url})\n\n` + after;
      setForm({ ...form, content: newContent });
      setTimeout(() => {
        textarea.focus();
        const newPos = start + `\n\n![Image](${url})\n\n`.length;
        textarea.setSelectionRange(newPos, newPos);
      }, 0);
    } else {
      setForm({ ...form, content: form.content + `\n\n![Image](${url})\n` });
    }
    setShowMediaPicker(false);
  };

  if (loading) return <div className="p-6 text-center">Loading...</div>;

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/admin/blog" className="text-blue-600 hover:underline text-sm">
          ← Back to Blog
        </Link>
        <h1 className="text-2xl font-bold">Edit Blog Post</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 bg-white p-6 rounded-lg shadow">
        <div>
          <label className="block text-sm font-medium mb-1">Title *</label>
          <input
            type="text"
            className="w-full border p-2 rounded"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Slug (leave blank to auto-generate)</label>
          <input
            type="text"
            className="w-full border p-2 rounded"
            value={form.url_slug}
            onChange={(e) => setForm({ ...form, url_slug: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Meta Description</label>
          <textarea
            className="w-full border p-2 rounded"
            rows="2"
            value={form.meta_description}
            onChange={(e) => setForm({ ...form, meta_description: e.target.value })}
          />
        </div>

        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="block text-sm font-medium">Content (HTML/Markdown) *</label>
            <button
              type="button"
              onClick={() => {
                if (!knowledgeAssetId) {
                  alert('This post is not linked to a knowledge asset. Please link it first to use saved images.');
                  return;
                }
                setShowMediaPicker(true);
              }}
              className="bg-green-500 text-white px-3 py-1 rounded text-sm hover:bg-green-600"
            >
              🖼️ Add Image
            </button>
          </div>
          <textarea
            id="content-editor"
            className="w-full border p-2 rounded font-mono text-sm"
            rows="12"
            value={form.content}
            onChange={(e) => setForm({ ...form, content: e.target.value })}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Tags (comma separated)</label>
          <input
            type="text"
            className="w-full border p-2 rounded"
            value={form.tags?.join(', ') || ''}
            onChange={(e) =>
              setForm({
                ...form,
                tags: e.target.value.split(',').map((s) => s.trim()),
              })
            }
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Category</label>
          <input
            type="text"
            className="w-full border p-2 rounded"
            value={form.category || ''}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          />
        </div>

        <div className="border-t pt-4">
          <label className="block text-sm font-medium mb-2">Cover Image</label>
          {coverImageUrl && !coverFile && (
            <div className="mb-3">
              <p className="text-xs text-gray-500 mb-1">Current image:</p>
              <img
                src={coverImageUrl}
                alt="Cover"
                className="max-h-48 w-auto rounded border object-cover"
              />
            </div>
          )}
          {coverFile && (
            <div className="mb-3">
              <p className="text-xs text-gray-500 mb-1">New image (to be uploaded):</p>
              <img
                src={URL.createObjectURL(coverFile)}
                alt="New cover preview"
                className="max-h-48 w-auto rounded border object-cover"
              />
            </div>
          )}
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files[0];
              if (file) setCoverFile(file);
            }}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
          {coverFile && (
            <button
              type="button"
              onClick={() => {
                setCoverFile(null);
                document.querySelector('input[type="file"]').value = '';
              }}
              className="mt-2 text-sm text-red-500 hover:underline"
            >
              Remove selected file
            </button>
          )}
          {!coverFile && !coverImageUrl && (
            <p className="text-xs text-gray-400 mt-2">No cover image set. Upload one to display on the blog.</p>
          )}
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Update Post'}
          </button>
          <button
            type="button"
            onClick={() => router.push('/admin/blog')}
            className="bg-gray-200 text-gray-700 px-6 py-2 rounded hover:bg-gray-300"
          >
            Cancel
          </button>
        </div>
      </form>

      {showMediaPicker && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <MediaPicker
            knowledgeAssetId={knowledgeAssetId}
            onSelect={insertImage}
            onClose={() => setShowMediaPicker(false)}
          />
        </div>
      )}
    </div>
  );
}