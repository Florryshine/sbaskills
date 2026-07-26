'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import Link from 'next/link';

const EXAM_TYPES = ['JAMB', 'WAEC', 'NECO', 'POST_UTME'];

export default function KnowledgeAssetsPage() {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // all, learning, advice, news
  const [examFilter, setExamFilter] = useState('all');
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const supabase = createBrowserClient();

  useEffect(() => {
    loadAssets();
  }, [search, filter, examFilter]);

  const loadAssets = async () => {
    setLoading(true);
    let query = supabase.from('knowledge_assets').select('*').order('created_at', { ascending: false });

    if (search) {
      query = query.ilike('keyword', `%${search}%`);
    }
    if (filter !== 'all') {
      query = query.eq('topic_type', filter);
    }
    if (examFilter !== 'all') {
      query = query.contains('exam_type', [examFilter]);
    }

    const { data, error } = await query;
    if (error) {
      console.error(error);
    } else {
      setAssets(data || []);
    }
    setLoading(false);
  };

  const deleteAsset = async (id) => {
    if (!confirm('Delete this knowledge asset and all its generated content?')) return;
    const { error } = await supabase.from('knowledge_assets').delete().eq('id', id);
    if (error) alert(error.message);
    else loadAssets();
  };

  const startEdit = (asset) => {
    setEditingId(asset.id);
    setEditDraft({
      learning_objectives: (asset.learning_objectives || []).join('\n'),
      exam_type: asset.exam_type || [],
      estimated_duration_minutes: asset.estimated_duration_minutes ?? '',
      prerequisite_ids: asset.prerequisite_ids || [],
      related_asset_ids: asset.related_asset_ids || [],
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft(null);
  };

  const toggleExamType = (code) => {
    setEditDraft((prev) => ({
      ...prev,
      exam_type: prev.exam_type.includes(code)
        ? prev.exam_type.filter((c) => c !== code)
        : [...prev.exam_type, code],
    }));
  };

  const toggleMultiSelect = (field, id) => {
    setEditDraft((prev) => ({
      ...prev,
      [field]: prev[field].includes(id) ? prev[field].filter((x) => x !== id) : [...prev[field], id],
    }));
  };

  const saveEdit = async (id) => {
    setSaving(true);
    const payload = {
      learning_objectives: editDraft.learning_objectives
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
      exam_type: editDraft.exam_type,
      estimated_duration_minutes: editDraft.estimated_duration_minutes === '' ? null : Number(editDraft.estimated_duration_minutes),
      prerequisite_ids: editDraft.prerequisite_ids,
      related_asset_ids: editDraft.related_asset_ids,
    };
    const { error } = await supabase.from('knowledge_assets').update(payload).eq('id', id);
    setSaving(false);
    if (error) {
      alert(error.message);
      return;
    }
    setEditingId(null);
    setEditDraft(null);
    loadAssets();
  };

  const keywordById = (id) => assets.find((a) => a.id === id)?.keyword || id;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-brand-blue">🧠 Knowledge Assets</h1>
        <Link
          href="/admin/generate"
          className="bg-brand-yellow px-4 py-2 rounded-xl font-bold hover:opacity-90"
        >
          + Generate New
        </Link>
      </div>

      <div className="flex gap-4 mb-6 flex-wrap">
        <input
          type="text"
          placeholder="Search by keyword..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] rounded-xl border border-slate-200 px-4 py-2"
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="rounded-xl border border-slate-200 px-4 py-2"
        >
          <option value="all">All Types</option>
          <option value="learning">Learning</option>
          <option value="advice">Advice</option>
          <option value="news">News</option>
        </select>
        <select
          value={examFilter}
          onChange={(e) => setExamFilter(e.target.value)}
          className="rounded-xl border border-slate-200 px-4 py-2"
        >
          <option value="all">All Exams</option>
          {EXAM_TYPES.map((code) => (
            <option key={code} value={code}>{code.replace('_', '-')}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="text-center py-8">Loading...</div>
      ) : assets.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No knowledge assets found.</div>
      ) : (
        <div className="grid gap-4">
          {assets.map((asset) => (
            <div key={asset.id} className="bg-white rounded-2xl shadow-sm border p-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex-1">
                  <h3 className="font-bold text-lg">{asset.keyword}</h3>
                  <p className="text-sm text-gray-500">
                    Type: {asset.topic_type} • Difficulty: {asset.difficulty}/5 • Concepts: {asset.key_concepts?.length || 0}
                    {asset.sub_topics?.length > 0 && <> • Sub-topics: {asset.sub_topics.length}</>}
                    {asset.estimated_duration_minutes ? <> • ~{asset.estimated_duration_minutes} min</> : null}
                  </p>
                  <p className="text-sm text-gray-600 mt-1 line-clamp-2">{asset.summary}</p>

                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {(asset.exam_type || []).map((code) => (
                      <span key={code} className="text-xs font-bold bg-brand-blue/10 text-brand-blue px-2 py-0.5 rounded-full">
                        {code.replace('_', '-')}
                      </span>
                    ))}
                    {(!asset.exam_type || asset.exam_type.length === 0) && (
                      <span className="text-xs text-gray-400 italic">No exam type set</span>
                    )}
                  </div>

                  {asset.learning_objectives?.length > 0 && (
                    <ul className="mt-2 text-xs text-gray-600 list-disc list-inside space-y-0.5">
                      {asset.learning_objectives.slice(0, 3).map((obj, i) => (
                        <li key={i}>{obj}</li>
                      ))}
                      {asset.learning_objectives.length > 3 && (
                        <li className="text-gray-400">+{asset.learning_objectives.length - 3} more</li>
                      )}
                    </ul>
                  )}

                  {(asset.prerequisite_ids?.length > 0 || asset.related_asset_ids?.length > 0) && (
                    <div className="mt-2 text-xs text-gray-500 space-y-0.5">
                      {asset.prerequisite_ids?.length > 0 && (
                        <p>Prerequisites: {asset.prerequisite_ids.map(keywordById).join(', ')}</p>
                      )}
                      {asset.related_asset_ids?.length > 0 && (
                        <p>Related: {asset.related_asset_ids.map(keywordById).join(', ')}</p>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => (editingId === asset.id ? cancelEdit() : startEdit(asset))}
                    className="bg-gray-100 text-gray-700 px-4 py-2 rounded-xl text-sm font-bold hover:bg-gray-200"
                  >
                    {editingId === asset.id ? 'Close' : 'Edit'}
                  </button>
                  <Link
                    href={`/admin/generate?assetId=${asset.id}`}
                    className="bg-brand-blue text-white px-4 py-2 rounded-xl text-sm font-bold hover:opacity-90"
                  >
                    Generate Content
                  </Link>
                  <button
                    onClick={() => deleteAsset(asset.id)}
                    className="bg-red-100 text-red-600 px-4 py-2 rounded-xl text-sm font-bold hover:bg-red-200"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {editingId === asset.id && editDraft && (
                <div className="mt-4 border-t pt-4 space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Exam Type</label>
                    <div className="flex gap-2 flex-wrap">
                      {EXAM_TYPES.map((code) => (
                        <button
                          key={code}
                          type="button"
                          onClick={() => toggleExamType(code)}
                          className={`text-xs font-bold px-3 py-1.5 rounded-full border ${
                            editDraft.exam_type.includes(code)
                              ? 'bg-brand-blue text-white border-brand-blue'
                              : 'bg-white text-gray-600 border-gray-200'
                          }`}
                        >
                          {code.replace('_', '-')}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Estimated Duration (minutes)</label>
                    <input
                      type="number"
                      min="0"
                      value={editDraft.estimated_duration_minutes}
                      onChange={(e) => setEditDraft((prev) => ({ ...prev, estimated_duration_minutes: e.target.value }))}
                      className="rounded-xl border border-slate-200 px-4 py-2 w-40"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">
                      Learning Objectives (one per line)
                    </label>
                    <textarea
                      value={editDraft.learning_objectives}
                      onChange={(e) => setEditDraft((prev) => ({ ...prev, learning_objectives: e.target.value }))}
                      rows={4}
                      className="w-full rounded-xl border border-slate-200 px-4 py-2"
                      placeholder="Define isotopes.&#10;Differentiate isotopes from isobars."
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Prerequisites</label>
                    <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-xl p-2 space-y-1">
                      {assets.filter((a) => a.id !== asset.id).map((a) => (
                        <label key={a.id} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={editDraft.prerequisite_ids.includes(a.id)}
                            onChange={() => toggleMultiSelect('prerequisite_ids', a.id)}
                          />
                          {a.keyword}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Related Topics</label>
                    <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-xl p-2 space-y-1">
                      {assets.filter((a) => a.id !== asset.id).map((a) => (
                        <label key={a.id} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={editDraft.related_asset_ids.includes(a.id)}
                            onChange={() => toggleMultiSelect('related_asset_ids', a.id)}
                          />
                          {a.keyword}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => saveEdit(asset.id)}
                      disabled={saving}
                      className="bg-brand-yellow px-4 py-2 rounded-xl font-bold hover:opacity-90 disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="bg-gray-100 text-gray-700 px-4 py-2 rounded-xl font-bold hover:bg-gray-200"
                    >
                      Cancel
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
