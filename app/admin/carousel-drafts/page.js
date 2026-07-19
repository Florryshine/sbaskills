'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@/lib/supabase';

// Carousels aren't their own table — attachCarouselMedia() (in
// lib/content-factory/media-attach.js) writes one media_files row per slide
// (role='carousel_slide') against a content_assets row. This page groups
// those rows back up by content_asset_id for review.
export default function CarouselDraftsPage() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const supabase = createBrowserClient();

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('media_files')
      .select('*, content_assets(id, title, platform, status, knowledge_assets(keyword))')
      .eq('role', 'carousel_slide')
      .order('content_asset_id', { ascending: true })
      .order('position', { ascending: true });

    if (!error) {
      const byAsset = {};
      (data || []).forEach((row) => {
        const key = row.content_asset_id;
        if (!byAsset[key]) byAsset[key] = { asset: row.content_assets, slides: [] };
        byAsset[key].slides.push(row);
      });
      setGroups(Object.values(byAsset));
    }
    setLoading(false);
  };

  const deleteCarousel = async (contentAssetId) => {
    if (!confirm('Delete this entire carousel (all slides)?')) return;
    await supabase.from('media_files').delete().eq('content_asset_id', contentAssetId).eq('role', 'carousel_slide');
    load();
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-brand-blue mb-2">🎠 Carousel Drafts</h1>
      <p className="text-sm text-gray-500 mb-6">
        Instagram carousels rendered by the carousel-engine as part of a Social Engine run.
      </p>

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
