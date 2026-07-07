'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@/lib/supabase';

export default function SocialPostDraftsPage() {
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);
  const supabase = createBrowserClient();

  useEffect(() => { loadDrafts(); }, []);

  const loadDrafts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('social_post_drafts')
      .select('*, knowledge_assets(keyword)')
      .order('created_at', { ascending: false });
    if (!error) setDrafts(data || []);
    setLoading(false);
  };

  const deleteDraft = async (id) => {
    if (!confirm('Delete this social post draft?')) return;
    await supabase.from('social_post_drafts').delete().eq('id', id);
    loadDrafts();
  };

  const updateStatus = async (id, status) => {
    await supabase.from('social_post_drafts').update({ status }).eq('id', id);
    loadDrafts();
  };

  const platformEmoji = {
    facebook: '📘',
    whatsapp: '💬',
    instagram: '📸',
    x: '🐦',
    telegram: '✈️',
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-brand-blue mb-6">📱 Social Post Drafts</h1>
      {loading ? <div className="text-center py-8">Loading...</div> : drafts.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No social post drafts found.</div>
      ) : (
        <div className="grid gap-4">
          {drafts.map((draft) => (
            <div key={draft.id} className="bg-white rounded-2xl shadow-sm border p-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold">{draft.keyword}</h3>
                  <p className="text-sm text-gray-500">
                    Platform: {platformEmoji[draft.platform] || '📱'} {draft.platform} • Status: <span className={`font-semibold ${draft.status === 'published' ? 'text-green-600' : 'text-yellow-600'}`}>{draft.status}</span>
                  </p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button onClick={() => { navigator.clipboard.writeText(draft.caption); alert('Copied!'); }} className="text-brand-blue px-4 py-2 rounded-xl text-sm font-bold hover:bg-blue-50">Copy Caption</button>
                  {draft.status === 'draft' ? (
                    <button onClick={() => updateStatus(draft.id, 'published')} className="bg-green-100 text-green-700 px-4 py-2 rounded-xl text-sm font-bold hover:bg-green-200">Publish</button>
                  ) : (
                    <button onClick={() => updateStatus(draft.id, 'draft')} className="bg-yellow-100 text-yellow-700 px-4 py-2 rounded-xl text-sm font-bold hover:bg-yellow-200">Unpublish</button>
                  )}
                  <button onClick={() => deleteDraft(draft.id)} className="bg-red-100 text-red-600 px-4 py-2 rounded-xl text-sm font-bold hover:bg-red-200">Delete</button>
                </div>
              </div>
              <div className="mt-3 bg-slate-50 p-3 rounded-xl text-sm whitespace-pre-wrap">
                {draft.caption}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}