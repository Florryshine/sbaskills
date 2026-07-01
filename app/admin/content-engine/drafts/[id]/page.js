'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase-client';
import { ArrowLeft, Save, CheckCircle, RefreshCw } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default function DraftPreviewPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id;

  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editedContent, setEditedContent] = useState('');

  useEffect(() => {
    if (id) fetchDraft();
  }, [id]);

  async function fetchDraft() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('content_drafts')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error || !data) {
        alert('Draft not found: ' + (error?.message || 'No data'));
        router.push('/admin/content-engine/drafts');
        return;
      }
      setDraft(data);
      setEditedContent(data.content || '');
    } catch (err) {
      alert('Error: ' + err.message);
      router.push('/admin/content-engine/drafts');
    } finally {
      setLoading(false);
    }
  }

  async function saveDraft() {
    setSaving(true);
    const { error } = await supabase
      .from('content_drafts')
      .update({ content: editedContent })
      .eq('id', id);
    if (error) {
      alert('Save failed: ' + error.message);
    } else {
      setDraft({ ...draft, content: editedContent });
      alert('Draft saved!');
      setEditMode(false);
    }
    setSaving(false);
  }

  async function publishDraft() {
    if (!confirm('Publish this draft?')) return;
    setPublishing(true);
    try {
      const res = await fetch('/api/content-engine/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draftId: id }),
      });
      const data = await res.json();
      if (res.ok) {
        alert('Published successfully!');
        router.push('/admin/content-engine/drafts');
      } else {
        alert('Publish failed: ' + (data.error || 'Unknown error'));
      }
    } catch (e) {
      alert('Error: ' + e.message);
    } finally {
      setPublishing(false);
    }
  }

  if (loading) return <div className="p-6">Loading draft...</div>;
  if (!draft) return <div className="p-6">Draft not found.</div>;

  // Parse JSON fields
  const faq = draft.schemas ? JSON.parse(draft.schemas) : [];
  const images = draft.image_prompts ? JSON.parse(draft.image_prompts) : [];
  const tags = draft.tags || [];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Link
            href="/admin/content-engine/drafts"
            className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Drafts
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 flex-1 truncate">
            {draft.title || 'Untitled Draft'}
          </h1>
          <div className="flex gap-2">
            <button
              onClick={() => setEditMode(!editMode)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-300 transition-colors"
            >
              {editMode ? 'Preview' : 'Edit'}
            </button>
            {editMode && (
              <button
                onClick={saveDraft}
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? 'Saving...' : 'Save'}
              </button>
            )}
            <button
              onClick={publishDraft}
              disabled={publishing}
              className="inline-flex items-center gap-2 bg-[#FFCC00] text-gray-900 px-4 py-2 rounded-xl text-sm font-medium hover:bg-[#e5b800] transition-colors disabled:opacity-50"
            >
              {publishing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              {publishing ? 'Publishing...' : 'Publish'}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
          {/* Title */}
          <div>
            <h2 className="text-sm font-medium text-gray-500">Title</h2>
            <p className="text-lg font-semibold">{draft.title}</p>
          </div>

          {/* Meta Description */}
          <div>
            <h2 className="text-sm font-medium text-gray-500">Meta Description</h2>
            <p>{draft.meta_description}</p>
          </div>

          {/* Slug */}
          <div>
            <h2 className="text-sm font-medium text-gray-500">Slug</h2>
            <p className="text-sm text-blue-600">/blog/{draft.url_slug}</p>
          </div>

          {/* Category */}
          <div>
            <h2 className="text-sm font-medium text-gray-500">Category</h2>
            <p>{draft.category || 'Uncategorized'}</p>
          </div>

          {/* Tags */}
          <div>
            <h2 className="text-sm font-medium text-gray-500">Tags</h2>
            <div className="flex flex-wrap gap-2 mt-1">
              {tags.map((tag, i) => (
                <span key={i} className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs">
                  #{tag}
                </span>
              ))}
            </div>
          </div>

          {/* Content */}
          <div>
            <h2 className="text-sm font-medium text-gray-500 mb-2">Content</h2>
            {editMode ? (
              <textarea
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                className="w-full h-96 border rounded p-3 font-mono text-sm"
              />
            ) : (
              <div
                className="prose prose-sm max-w-none text-gray-700"
                dangerouslySetInnerHTML={{ __html: draft.content || 'No content yet.' }}
              />
            )}
          </div>

          {/* FAQ Section */}
          {faq.length > 0 && (
            <div>
              <h2 className="text-sm font-medium text-gray-500 mb-2">FAQ</h2>
              {faq.map((item, i) => (
                <div key={i} className="mb-2 border-b pb-2">
                  <p className="font-semibold text-sm">{item.question}</p>
                  <p className="text-sm text-gray-600">{item.answer}</p>
                </div>
              ))}
            </div>
          )}

          {/* Internal Links */}
          {draft.internal_links && draft.internal_links.length > 0 && (
            <div>
              <h2 className="text-sm font-medium text-gray-500">Internal Links</h2>
              <ul className="list-disc pl-5 text-sm text-blue-600">
                {draft.internal_links.map((link, i) => (
                  <li key={i}>{link}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Images */}
          {images.length > 0 && (
            <div>
              <h2 className="text-sm font-medium text-gray-500">Image Suggestions</h2>
              <ul className="list-disc pl-5 text-sm text-gray-600">
                {images.map((img, i) => (
                  <li key={i}>{img.type}: {img.description}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="text-xs text-gray-400 pt-4 border-t">
            Created: {new Date(draft.created_at).toLocaleString()}
            {draft.published_at && ` | Published: ${new Date(draft.published_at).toLocaleString()}`}
          </div>
        </div>
      </div>
    </div>
  );
}