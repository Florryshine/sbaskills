'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@/lib/supabase';

export default function StudyNoteDraftsPage() {
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [editText, setEditText] = useState('');
  const [saving, setSaving] = useState(false);
  const [publishingId, setPublishingId] = useState(null);
  const supabase = createBrowserClient();

  useEffect(() => { loadDrafts(); }, []);

  const loadDrafts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('study_note_drafts')
      .select('*, knowledge_assets(keyword)')
      .order('created_at', { ascending: false });
    if (!error) setDrafts(data || []);
    setLoading(false);
  };

  const deleteDraft = async (id) => {
    if (!confirm('Delete this study note draft?')) return;
    await supabase.from('study_note_drafts').delete().eq('id', id);
    loadDrafts();
  };

  const toggleExpand = (draft) => {
    if (expandedId === draft.id) {
      setExpandedId(null);
    } else {
      setExpandedId(draft.id);
      setEditText(draft.content || '');
    }
  };

  const saveEdit = async (id) => {
    setSaving(true);
    const { error } = await supabase
      .from('study_note_drafts')
      .update({ content: editText })
      .eq('id', id);
    setSaving(false);
    if (error) { alert(error.message); return; }
    loadDrafts();
  };

  const publishToLibrary = async (id) => {
    setPublishingId(id);
    try {
      const res = await fetch(`/api/study-notes/${id}/publish`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Publish failed');
      alert('Published! It should now appear in the Library.');
      loadDrafts();
    } catch (err) {
      alert(err.message);
    } finally {
      setPublishingId(null);
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-brand-blue mb-6">📝 Study Note Drafts</h1>
      {loading ? <div className="text-center py-8">Loading...</div> : drafts.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No study note drafts found.</div>
      ) : (
        <div className="grid gap-4">
          {drafts.map((draft) => (
            <div key={draft.id} className="bg-white rounded-2xl shadow-sm border p-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold">{draft.title || draft.keyword}</h3>
                  <p className="text-sm text-gray-500">
                    Content: {draft.content?.length || 0} characters • Status:{' '}
                    <span className={`font-semibold ${draft.status === 'published' ? 'text-green-600' : 'text-yellow-600'}`}>
                      {draft.status}
                    </span>
                    {draft.book_id && <span className="ml-2 text-blue-600">• In Library</span>}
                  </p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button onClick={() => toggleExpand(draft)} className="text-brand-blue px-4 py-2 rounded-xl text-sm font-bold hover:bg-blue-50">
                    {expandedId === draft.id ? 'Close Editor' : 'Edit / Preview'}
                  </button>
                  <button
                    onClick={() => publishToLibrary(draft.id)}
                    disabled={publishingId === draft.id}
                    className="bg-brand-blue text-white px-4 py-2 rounded-xl text-sm font-bold hover:opacity-90 disabled:opacity-50"
                  >
                    {publishingId === draft.id ? 'Publishing PDF...' : draft.book_id ? 'Re-publish PDF' : 'Publish to Library (PDF)'}
                  </button>
                  <button onClick={() => deleteDraft(draft.id)} className="bg-red-100 text-red-600 px-4 py-2 rounded-xl text-sm font-bold hover:bg-red-200">Delete</button>
                </div>
              </div>

              {expandedId === draft.id && (
                <div className="mt-4">
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    className="w-full h-96 font-mono text-sm border rounded-xl p-3 bg-slate-50"
                    placeholder="Markdown content..."
                  />
                  <div className="mt-2 flex justify-end">
                    <button
                      onClick={() => saveEdit(draft.id)}
                      disabled={saving}
                      className="bg-green-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-green-700 disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
