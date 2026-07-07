'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@/lib/supabase';

export default function StudyNoteDraftsPage() {
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
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

  const updateStatus = async (id, status) => {
    await supabase.from('study_note_drafts').update({ status }).eq('id', id);
    loadDrafts();
  };

  const toggleExpand = (id) => setExpandedId(expandedId === id ? null : id);

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
                    Content: {draft.content?.length || 0} characters • Status: <span className={`font-semibold ${draft.status === 'published' ? 'text-green-600' : 'text-yellow-600'}`}>{draft.status}</span>
                  </p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button onClick={() => toggleExpand(draft.id)} className="text-brand-blue px-4 py-2 rounded-xl text-sm font-bold hover:bg-blue-50">
                    {expandedId === draft.id ? 'Hide Content' : 'Preview Content'}
                  </button>
                  {draft.status === 'draft' ? (
                    <button onClick={() => updateStatus(draft.id, 'published')} className="bg-green-100 text-green-700 px-4 py-2 rounded-xl text-sm font-bold hover:bg-green-200">Publish</button>
                  ) : (
                    <button onClick={() => updateStatus(draft.id, 'draft')} className="bg-yellow-100 text-yellow-700 px-4 py-2 rounded-xl text-sm font-bold hover:bg-yellow-200">Unpublish</button>
                  )}
                  <button onClick={() => deleteDraft(draft.id)} className="bg-red-100 text-red-600 px-4 py-2 rounded-xl text-sm font-bold hover:bg-red-200">Delete</button>
                </div>
              </div>
              {expandedId === draft.id && (
                <div className="mt-4 max-h-96 overflow-y-auto bg-slate-50 p-4 rounded-xl prose prose-sm">
                  <div dangerouslySetInnerHTML={{ __html: draft.content?.replace(/\n/g, '<br />') || '' }} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}