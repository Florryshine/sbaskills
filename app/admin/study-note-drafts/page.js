'use client';

import { useState, useEffect, useRef } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import ImagePicker from '@/components/ImagePicker';

export default function StudyNoteDraftsPage() {
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [editText, setEditText] = useState('');
  const [saving, setSaving] = useState(false);
  const [publishingId, setPublishingId] = useState(null);
  const [themeByDraft, setThemeByDraft] = useState({});
  const THEME_OPTIONS = [
    { key: 'brand', label: 'Shiney Brain Brand' },
    { key: 'modern', label: 'Modern' },
    { key: 'workbook', label: 'Student Workbook' },
    { key: 'premium', label: 'Premium Ebook' },
    { key: 'minimal', label: 'Minimal' },
    { key: 'dark', label: 'Dark Mode' },
  ];
  
  // Image picker
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [pickerAssetId, setPickerAssetId] = useState(null);
  const textareaRef = useRef(null);

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
      // Store asset id for image picker
      setPickerAssetId(draft.knowledge_asset_id || null);
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
      const res = await fetch(`/api/study-notes/${id}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ themeKey: themeByDraft[id] || 'brand' })
      });
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

  // Insert image into the editText at cursor position
  const insertImageIntoNote = (url) => {
    const textarea = textareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const before = editText.substring(0, start);
      const after = editText.substring(end);
      const newContent = before + `\n\n![Image](${url})\n\n` + after;
      setEditText(newContent);
      // Update cursor position after the inserted text
      setTimeout(() => {
        textarea.focus();
        const newPos = start + `\n\n![Image](${url})\n\n`.length;
        textarea.setSelectionRange(newPos, newPos);
      }, 0);
    } else {
      // Fallback append
      setEditText(prev => prev + `\n\n![Image](${url})\n`);
    }
    setShowImagePicker(false);
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
                <div className="flex gap-2 flex-wrap items-center">
                  <button onClick={() => toggleExpand(draft)} className="text-brand-blue px-4 py-2 rounded-xl text-sm font-bold hover:bg-blue-50">
                    {expandedId === draft.id ? 'Close Editor' : 'Edit / Preview'}
                  </button>
                  <select
                    value={themeByDraft[draft.id] || 'brand'}
                    onChange={(e) => setThemeByDraft(prev => ({ ...prev, [draft.id]: e.target.value }))}
                    className="border rounded-xl text-sm px-2 py-2"
                    title="PDF style"
                  >
                    {THEME_OPTIONS.map(t => (
                      <option key={t.key} value={t.key}>{t.label}</option>
                    ))}
                  </select>
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
                  <div className="flex justify-end mb-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (!draft.knowledge_asset_id) {
                          alert('This draft is not linked to a knowledge asset. Cannot fetch saved images.');
                          return;
                        }
                        setPickerAssetId(draft.knowledge_asset_id);
                        setShowImagePicker(true);
                      }}
                      className="bg-green-500 text-white px-3 py-1 rounded text-sm hover:bg-green-600"
                    >
                      🖼️ Add Image
                    </button>
                  </div>
                  <textarea
                    ref={textareaRef}
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

      {/* Image Picker Modal */}
      {showImagePicker && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-4xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">📸 Saved Images</h2>
              <button
                onClick={() => setShowImagePicker(false)}
                className="text-gray-500 hover:text-gray-700 text-xl"
              >
                ✕
              </button>
            </div>
            <ImagePicker
              knowledgeAssetId={pickerAssetId}
              onSelect={insertImageIntoNote}
              onClose={() => setShowImagePicker(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}