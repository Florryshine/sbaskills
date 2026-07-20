'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@/lib/supabase';

const PLATFORMS = ['instagram', 'facebook', 'telegram', 'linkedin', 'x', 'pinterest', 'youtube', 'tiktok'];

export default function SocialEnginePage() {
  const [assets, setAssets] = useState([]);
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [platformFilter, setPlatformFilter] = useState('all');
  const [expandedId, setExpandedId] = useState(null);
  const [error, setError] = useState(null);
  // knowledge_assets has an anon-readable policy elsewhere in the app, so
  // this one still goes through the browser client — only content_assets /
  // media_files / video_scripts are service_role-only.
  const supabase = createBrowserClient();

  useEffect(() => {
    loadAssets();
    loadDrafts();
  }, []);

  const loadAssets = async () => {
    const { data } = await supabase
      .from('knowledge_assets')
      .select('id, keyword, subject')
      .order('created_at', { ascending: false })
      .limit(100);
    setAssets(data || []);
  };

  // content_assets/media_files/video_scripts are locked to service_role by
  // RLS (see supabase/migrations/20260718_social_engine_v2.sql) — the
  // anon/browser client gets an empty result back, silently. This must go
  // through /api/admin/content-assets, which uses createAdminClient().
  const loadDrafts = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/content-assets');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load drafts');
      setDrafts(json.data || []);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  const togglePlatform = (p) => {
    setSelectedPlatforms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  };

  const runGenerate = async () => {
    if (!selectedAssetId) { alert('Pick a knowledge asset first.'); return; }
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch('/api/content-factory/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          knowledgeAssetId: selectedAssetId,
          platforms: selectedPlatforms.length > 0 ? selectedPlatforms : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed');
      await loadDrafts();
    } catch (e) {
      setError(e.message);
    }
    setGenerating(false);
  };

  const updateStatus = async (id, status) => {
    const res = await fetch('/api/admin/content-assets', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      alert(json.error || 'Failed to update status');
      return;
    }
    loadDrafts();
  };

  const deleteDraft = async (id) => {
    if (!confirm('Delete this social engine draft (and its media)?')) return;
    const res = await fetch(`/api/admin/content-assets?id=${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      alert(json.error || 'Failed to delete');
      return;
    }
    loadDrafts();
  };

  const filtered = platformFilter === 'all' ? drafts : drafts.filter((d) => d.platform === platformFilter);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-brand-blue mb-2">🚀 Social Engine</h1>
      <p className="text-sm text-gray-500 mb-6">
        Generates per-platform posts from a knowledge asset — Instagram carousels and
        TikTok/YouTube video scripts are rendered/queued automatically as part of this run.
      </p>

      {/* ── Generate ── */}
      <div className="bg-white rounded-2xl shadow-sm border p-4 mb-8">
        <h2 className="font-bold mb-3">Generate</h2>
        <div className="flex flex-col md:flex-row gap-3 md:items-center mb-3">
          <select
            value={selectedAssetId}
            onChange={(e) => setSelectedAssetId(e.target.value)}
            className="border rounded-xl px-3 py-2 text-sm flex-1"
          >
            <option value="">Select a knowledge asset…</option>
            {assets.map((a) => (
              <option key={a.id} value={a.id}>{a.keyword} {a.subject ? `(${a.subject})` : ''}</option>
            ))}
          </select>
          <button
            onClick={runGenerate}
            disabled={generating}
            className="bg-brand-blue text-white px-5 py-2 rounded-xl text-sm font-bold disabled:opacity-50"
          >
            {generating ? 'Generating…' : 'Generate'}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {PLATFORMS.map((p) => (
            <button
              key={p}
              onClick={() => togglePlatform(p)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                selectedPlatforms.includes(p)
                  ? 'bg-brand-blue text-white border-brand-blue'
                  : 'text-gray-600 border-gray-300 hover:bg-gray-50'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Leave all unchecked to generate every platform.
        </p>
        {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
      </div>

      {/* ── Filter ── */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => setPlatformFilter('all')}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold ${platformFilter === 'all' ? 'bg-brand-blue text-white' : 'bg-gray-100 text-gray-600'}`}
        >
          All
        </button>
        {PLATFORMS.map((p) => (
          <button
            key={p}
            onClick={() => setPlatformFilter(p)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold ${platformFilter === p ? 'bg-brand-blue text-white' : 'bg-gray-100 text-gray-600'}`}
          >
            {p}
          </button>
        ))}
      </div>

      {/* ── Drafts ── */}
      {loading ? (
        <div className="text-center py-8">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No social engine drafts found.</div>
      ) : (
        <div className="grid gap-4">
          {filtered.map((draft) => {
            const carouselSlides = (draft.media_files || [])
              .filter((m) => m.role === 'carousel_slide')
              .sort((a, b) => a.position - b.position);
            const heroImage = (draft.media_files || []).find((m) => m.role === 'hero_image' || m.role === 'primary');
            const videoScript = (draft.video_scripts || [])[0];

            return (
              <div key={draft.id} className="bg-white rounded-2xl shadow-sm border p-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div>
                    <span className="inline-block text-xs font-bold uppercase tracking-wide text-brand-blue bg-blue-50 rounded-full px-2 py-0.5 mr-2">
                      {draft.platform || draft.asset_type}
                    </span>
                    <span className="font-bold">{draft.title || draft.knowledge_assets?.keyword}</span>
                    <p className="text-sm text-gray-500 mt-1">
                      Status: <span className={`font-semibold ${draft.status === 'approved' ? 'text-green-600' : 'text-yellow-600'}`}>{draft.status}</span>
                      {carouselSlides.length > 0 && <> • {carouselSlides.length} carousel slide(s)</>}
                      {videoScript && <> • video script: {videoScript.render_status}</>}
                      {heroImage && <> • hero image attached</>}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <button onClick={() => setExpandedId(expandedId === draft.id ? null : draft.id)} className="text-brand-blue px-4 py-2 rounded-xl text-sm font-bold hover:bg-blue-50">
                      {expandedId === draft.id ? 'Hide' : 'Preview'}
                    </button>
                    {draft.status !== 'approved' ? (
                      <button onClick={() => updateStatus(draft.id, 'approved')} className="bg-green-100 text-green-700 px-4 py-2 rounded-xl text-sm font-bold hover:bg-green-200">Approve</button>
                    ) : (
                      <button onClick={() => updateStatus(draft.id, 'draft')} className="bg-yellow-100 text-yellow-700 px-4 py-2 rounded-xl text-sm font-bold hover:bg-yellow-200">Unapprove</button>
                    )}
                    <button onClick={() => deleteDraft(draft.id)} className="bg-red-100 text-red-600 px-4 py-2 rounded-xl text-sm font-bold hover:bg-red-200">Delete</button>
                  </div>
                </div>

                {expandedId === draft.id && (
                  <div className="mt-4 bg-slate-50 p-4 rounded-xl space-y-4">
                    {draft.body && (
                      <p className="text-sm whitespace-pre-wrap">{draft.body}</p>
                    )}
                    {heroImage && (
                      <img src={heroImage.url} alt={draft.title} className="rounded-lg max-h-64 object-cover" />
                    )}
                    {carouselSlides.length > 0 && (
                      <div className="flex gap-2 overflow-x-auto pb-2">
                        {carouselSlides.map((s) => (
                          <img key={s.id} src={s.url} alt={`Slide ${s.position + 1}`} className="h-48 rounded-lg border" />
                        ))}
                      </div>
                    )}
                    {videoScript && (
                      <div>
                        <p className="text-xs font-bold text-gray-500 mb-1 uppercase">
                          Video Script ({videoScript.format}) — {videoScript.render_status}
                        </p>
                        <div className="text-xs space-y-1 max-h-48 overflow-y-auto">
                          {(videoScript.script_segments || []).map((seg, i) => (
                            <p key={i}><span className="font-semibold">#{i + 1}:</span> {seg.text}</p>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
