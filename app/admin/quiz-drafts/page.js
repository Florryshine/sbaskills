'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@/lib/supabase';

export default function QuizDraftsPage() {
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const supabase = createBrowserClient();

  useEffect(() => {
    loadDrafts();
  }, []);

  const loadDrafts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('quiz_drafts')
      .select('*, knowledge_assets(keyword)')
      .order('created_at', { ascending: false });
    if (error) {
      console.error(error);
    } else {
      setDrafts(data || []);
    }
    setLoading(false);
  };

  const deleteDraft = async (id) => {
    if (!confirm('Delete this quiz draft?')) return;
    const { error } = await supabase.from('quiz_drafts').delete().eq('id', id);
    if (error) alert(error.message);
    else loadDrafts();
  };

  const updateStatus = async (id, status) => {
    const { error } = await supabase
      .from('quiz_drafts')
      .update({ status })
      .eq('id', id);
    if (error) alert(error.message);
    else loadDrafts();
  };

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-brand-blue mb-6">❓ Quiz Drafts</h1>

      {loading ? (
        <div className="text-center py-8">Loading...</div>
      ) : drafts.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No quiz drafts found.</div>
      ) : (
        <div className="grid gap-4">
          {drafts.map((draft) => (
            <div
              key={draft.id}
              className="bg-white rounded-2xl shadow-sm border p-4"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold">{draft.keyword}</h3>
                  <p className="text-sm text-gray-500">
                    Questions: {draft.questions?.length || 0} • Status: <span className={`font-semibold ${draft.status === 'published' ? 'text-green-600' : 'text-yellow-600'}`}>{draft.status}</span>
                  </p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => toggleExpand(draft.id)}
                    className="text-brand-blue px-4 py-2 rounded-xl text-sm font-bold hover:bg-blue-50"
                  >
                    {expandedId === draft.id ? 'Hide Questions' : 'Preview Questions'}
                  </button>
                  {draft.status === 'draft' ? (
                    <button
                      onClick={() => updateStatus(draft.id, 'published')}
                      className="bg-green-100 text-green-700 px-4 py-2 rounded-xl text-sm font-bold hover:bg-green-200"
                    >
                      Publish
                    </button>
                  ) : (
                    <button
                      onClick={() => updateStatus(draft.id, 'draft')}
                      className="bg-yellow-100 text-yellow-700 px-4 py-2 rounded-xl text-sm font-bold hover:bg-yellow-200"
                    >
                      Unpublish
                    </button>
                  )}
                  <button
                    onClick={() => deleteDraft(draft.id)}
                    className="bg-red-100 text-red-600 px-4 py-2 rounded-xl text-sm font-bold hover:bg-red-200"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {expandedId === draft.id && (
                <div className="mt-4 max-h-96 overflow-y-auto bg-slate-50 p-4 rounded-xl">
                  {draft.questions?.map((q, idx) => (
                    <div key={idx} className="mb-4 border-b border-slate-200 pb-3 last:border-0">
                      <p className="font-semibold">Q{idx+1}: {q.question}</p>
                      <ul className="ml-4 text-sm">
                        {q.options?.map((opt, oi) => (
                          <li key={oi} className={opt === q.correct_answer ? 'text-green-700 font-bold' : ''}>
                            {opt} {opt === q.correct_answer && '✅'}
                          </li>
                        ))}
                      </ul>
                      <p className="text-sm text-gray-600 mt-1">Difficulty: {q.difficulty}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}