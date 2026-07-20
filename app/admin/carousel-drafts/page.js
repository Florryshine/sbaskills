'use client';

import { useState, useEffect } from 'react';

// media_files is service_role-only by RLS (see
// supabase/migrations/20260718_social_engine_v2.sql) — must go through
// /api/admin/carousel-drafts (createAdminClient()), never the browser client.
export default function CarouselDraftsPage() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/carousel-drafts');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load carousels');

      const byAsset = {};
      (json.data || []).forEach((row) => {
        const key = row.content_asset_id;
        if (!byAsset[key]) byAsset[key] = { asset: row.content_assets, slides: [] };
        byAsset[key].slides.push(row);
      });
      setGroups(Object.values(byAsset));
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  const deleteCarousel = async (contentAssetId) => {
    if (!confirm('Delete this entire carousel (all slides)?')) return;
    const res = await fetch(`/api/admin/carousel-drafts?contentAssetId=${contentAssetId}`, { method: 'DELETE' });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      alert(json.error || 'Failed to delete');
      return;
    }
    load();
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-brand-blue mb-2">🎠 Carousel Drafts</h1>
      <p className="text-sm text-gray-500 mb-6">
        Instagram carousels rendered by the carousel-engine as part of a Social Engine run.
      </p>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      {loading ? (
        <div className="text-center py-8">Loading…</div>
      ) : groups.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No carousel drafts yet. Generate one from <a href="/admin/social-engine" className="text-brand-blue underline">Social Engine</a>.
        </div>
      ) : (
        <div className="grid gap-4">
          {groups.map(({ asset, slides }) => (
            <div key={asset?.id || slides[0].content_asset_id} className="bg-white rounded-2xl shadow-sm border p-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3">
                <div>
                  <h3 className="font-bold">{asset?.title || asset?.knowledge_assets?.keyword || 'Untitled'}</h3>
                  <p className="text-sm text-gray-500">
                    {asset?.platform || 'instagram'} • {slides.length} slide(s) • Status: {asset?.status || 'unknown'}
                  </p>
                </div>
                <button
                  onClick={() => deleteCarousel(slides[0].content_asset_id)}
                  className="bg-red-100 text-red-600 px-4 py-2 rounded-xl text-sm font-bold hover:bg-red-200 self-start"
                >
                  Delete
                </button>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {slides.map((s) => (
                  <img key={s.id} src={s.url} alt={`Slide ${s.position + 1}`} className="h-56 rounded-lg border" />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
