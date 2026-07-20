'use client';

import { useState, useEffect } from 'react';

const STATUS_COLORS = {
  pending: 'text-yellow-600',
  rendering: 'text-blue-600',
  completed: 'text-green-600',
  ready: 'text-green-600',
  failed: 'text-red-600',
};

// video_scripts is service_role-only by RLS (see
// supabase/migrations/20260719_video_scripts.sql) — must go through
// /api/admin/video-scripts (createAdminClient()), never the browser client.
export default function VideoScriptsPage() {
  const [scripts, setScripts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [error, setError] = useState(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/video-scripts');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load video scripts');
      setScripts(json.data || []);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  const deleteScript = async (id) => {
    if (!confirm('Delete this video script?')) return;
    const res = await fetch(`/api/admin/video-scripts?id=${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      alert(json.error || 'Failed to delete');
      return;
    }
    load();
  };

  const filtered = statusFilter === 'all' ? scripts : scripts.filter((s) => s.render_status === statusFilter);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-brand-blue mb-2">🎬 Video Scripts</h1>
      <p className="text-sm text-gray-500 mb-6">
        Scripts queued by the Social Engine for TikTok/YouTube. Rendering itself happens out-of-band
        via local-video-renderer/worker.js, which updates render_status here as it progresses.
      </p>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      <div className="flex flex-wrap gap-2 mb-4">
        {['all', 'pending', 'rendering', 'completed', 'failed'].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold ${statusFilter === s ? 'bg-brand-blue text-white' : 'bg-gray-100 text-gray-600'}`}
          >
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-8">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No video scripts yet. Generate one from <a href="/admin/social-engine" className="text-brand-blue underline">Social Engine</a>.
        </div>
      ) : (
        <div className="grid gap-4">
          {filtered.map((script) => (
            <div key={script.id} className="bg-white rounded-2xl shadow-sm border p-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold">{script.title || script.content_assets?.knowledge_assets?.keyword}</h3>
                  <p className="text-sm text-gray-500">
                    {script.format} • {script.content_assets?.platform || '—'} •{' '}
                    <span className={`font-semibold ${STATUS_COLORS[script.render_status] || ''}`}>
                      {script.render_status}
                    </span>
                    {' • '}{(script.script_segments || []).length} segment(s)
                  </p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button onClick={() => setExpandedId(expandedId === script.id ? null : script.id)} className="text-brand-blue px-4 py-2 rounded-xl text-sm font-bold hover:bg-blue-50">
                    {expandedId === script.id ? 'Hide Script' : 'View Script'}
                  </button>
                  <button onClick={() => deleteScript(script.id)} className="bg-red-100 text-red-600 px-4 py-2 rounded-xl text-sm font-bold hover:bg-red-200">
                    Delete
                  </button>
                </div>
              </div>
              {expandedId === script.id && (
                <div className="mt-4 max-h-96 overflow-y-auto bg-slate-50 p-4 rounded-xl space-y-3">
                  {(script.script_segments || []).map((seg, i) => (
                    <div key={i} className="border-b border-slate-200 pb-2 last:border-0">
                      <p className="text-sm font-semibold">Segment {i + 1} {seg.durationSeconds ? `(${seg.durationSeconds}s)` : ''}</p>
                      <p className="text-sm">{seg.text}</p>
                      {seg.visual_cue && <p className="text-xs text-gray-500">Visual: {seg.visual_cue}</p>}
                      {seg.stock_search && <p className="text-xs text-brand-blue">Stock search: {seg.stock_search}</p>}
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
