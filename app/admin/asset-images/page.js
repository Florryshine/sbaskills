'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import ImageEditorModal from '@/components/ImageEditorModal';

export default function AssetImagesPage() {
  const [assets, setAssets] = useState([]);
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [images, setImages] = useState([]);
  const [plan, setPlan] = useState([]);
  const [loading, setLoading] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [busyImageId, setBusyImageId] = useState(null);
  const [editingImage, setEditingImage] = useState(null);
  const [viewMode, setViewMode] = useState('all'); // 'all' | 'saved'
  const supabase = createBrowserClient();

  useEffect(() => { loadAssets(); }, []);
  useEffect(() => { if (selectedAssetId) { loadImages(selectedAssetId); loadPlan(selectedAssetId); } }, [selectedAssetId]);

  const loadAssets = async () => {
    const { data } = await supabase
      .from('knowledge_assets')
      .select('id, keyword, subject')
      .order('created_at', { ascending: false })
      .limit(100);
    setAssets(data || []);
  };

  const loadImages = async (assetId) => {
    setLoading(true);
    const { data } = await supabase
      .from('asset_images')
      .select('*')
      .eq('knowledge_asset_id', assetId)
      .order('created_at', { ascending: false });
    setImages(data || []);
    setLoading(false);
  };

  const loadPlan = async (assetId) => {
    const { data } = await supabase
      .from('visual_requests')
      .select('*')
      .eq('knowledge_asset_id', assetId)
      .order('created_at', { ascending: true });
    setPlan(data || []);
  };

  const generateBlueprint = async () => {
    if (!selectedAssetId) return;
    setPlanning(true);
    try {
      const res = await fetch('/api/engines/visual-blueprint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ knowledgeAssetId: selectedAssetId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Blueprint generation failed');
      loadPlan(selectedAssetId);
    } catch (err) {
      alert(err.message);
    } finally {
      setPlanning(false);
    }
  };

  const fetchNewImages = async () => {
    if (!selectedAssetId) return;
    setFetching(true);
    try {
      const res = await fetch('/api/engines/images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ knowledgeAssetId: selectedAssetId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Fetch failed');
      if (data.savedCount === 0) alert(data.message || 'No images found.');
      loadImages(selectedAssetId);
      loadPlan(selectedAssetId);
    } catch (err) {
      alert(err.message);
    } finally {
      setFetching(false);
    }
  };

  const ensureHosted = async (image) => {
    if (image.hosted) return image;
    setBusyImageId(image.id);
    try {
      const res = await fetch(`/api/asset-images/${image.id}/host`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Hosting failed');
      return data.image;
    } finally {
      setBusyImageId(null);
    }
  };

  const toggleSelected = async (image) => {
    try {
      const hostedImage = image.selected ? image : await ensureHosted(image);
      await supabase.from('asset_images').update({ selected: !image.selected }).eq('id', hostedImage.id);
      loadImages(selectedAssetId);
    } catch (err) {
      alert(err.message);
    }
  };

  const openEditor = async (image) => {
    try {
      const hostedImage = await ensureHosted(image);
      setEditingImage(hostedImage);
    } catch (err) {
      alert(err.message);
    }
  };

  const deleteImage = async (image) => {
    if (!confirm('Delete this image?')) return;
    await supabase.from('asset_images').delete().eq('id', image.id);
    loadImages(selectedAssetId);
  };

  const copyUrl = (url) => {
    navigator.clipboard.writeText(url);
    alert('✅ Image URL copied to clipboard!');
  };

  // Filter images based on view mode
  const filteredImages = viewMode === 'saved' 
    ? images.filter(img => img.hosted === true && img.selected === true)
    : images;

  const grouped = filteredImages.reduce((acc, img) => {
    const key = img.section_title || 'General';
    if (!acc[key]) acc[key] = [];
    acc[key].push(img);
    return acc;
  }, {});

  const savedCount = images.filter(img => img.hosted && img.selected).length;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-brand-blue mb-6">🖼️ Image Library</h1>

      {/* Asset selector and action buttons */}
      <div className="flex flex-col md:flex-row gap-3 mb-4">
        <select
          value={selectedAssetId}
          onChange={(e) => setSelectedAssetId(e.target.value)}
          className="border rounded-xl p-2 flex-1"
        >
          <option value="">Select a knowledge asset...</option>
          {assets.map((a) => (
            <option key={a.id} value={a.id}>{a.subject ? `${a.subject} — ` : ''}{a.keyword}</option>
          ))}
        </select>
        <button onClick={generateBlueprint} disabled={!selectedAssetId || planning} className="bg-yellow-500 text-white px-5 py-2 rounded-xl font-bold hover:opacity-90 disabled:opacity-50">
          {planning ? 'Planning...' : '1. Generate Visual Blueprint'}
        </button>
        <button onClick={fetchNewImages} disabled={!selectedAssetId || fetching} className="bg-brand-blue text-white px-5 py-2 rounded-xl font-bold hover:opacity-90 disabled:opacity-50">
          {fetching ? 'Fetching...' : '2. Fetch Images'}
        </button>
      </div>

      {/* View Mode Toggle + Saved count */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex rounded-xl overflow-hidden border border-gray-200">
          <button 
            onClick={() => setViewMode('all')}
            className={`px-4 py-2 text-sm font-bold transition ${
              viewMode === 'all' 
                ? 'bg-brand-blue text-white' 
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            📸 All Images
          </button>
          <button 
            onClick={() => setViewMode('saved')}
            className={`px-4 py-2 text-sm font-bold transition ${
              viewMode === 'saved' 
                ? 'bg-green-600 text-white' 
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            ✅ Saved Images {savedCount > 0 && `(${savedCount})`}
          </button>
        </div>
        {viewMode === 'saved' && savedCount === 0 && (
          <span className="text-sm text-gray-400">No saved images yet. Go to "All Images" and click Select on the ones you like.</span>
        )}
        {viewMode === 'saved' && savedCount > 0 && (
          <span className="text-sm text-green-600">✨ {savedCount} saved image{savedCount > 1 ? 's' : ''} – click Copy URL to paste into blog/notes</span>
        )}
      </div>

      <p className="text-xs text-gray-400 mb-4">
        Previews below are pulled live from Pixabay/Pexels/Wikimedia and cost no storage. An image is only downloaded into your library when you click <strong>Select</strong> or <strong>Edit</strong>.
      </p>

      {/* Visual Plan */}
      {plan.length > 0 && (
        <div className="bg-slate-50 border rounded-xl p-4 mb-6 text-sm">
          <p className="font-bold mb-2 text-gray-700">Visual Plan ({plan.length} sections):</p>
          <div className="grid gap-1">
            {plan.map((p) => (
              <div key={p.id} className="flex gap-2 items-start">
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${p.status === 'fulfilled' ? 'bg-green-100 text-green-700' : p.status === 'failed' ? 'bg-red-100 text-red-600' : 'bg-yellow-100 text-yellow-700'}`}>
                  {p.status}
                </span>
                <span className="text-gray-600"><strong>{p.section_title}</strong> ({p.image_type}) — "{p.search_query}"</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Image Grid */}
      {loading ? (
        <div className="text-center py-8">Loading...</div>
      ) : !selectedAssetId ? (
        <div className="text-center py-8 text-gray-500">Pick a knowledge asset to plan or fetch images.</div>
      ) : filteredImages.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          {viewMode === 'saved' 
            ? 'No saved images yet. Switch to "All Images" and click Select on the ones you like.' 
            : 'No images yet. Run the two buttons above.'}
        </div>
      ) : (
        Object.entries(grouped).map(([section, imgs]) => (
          <div key={section} className="mb-8">
            <h2 className="font-bold text-brand-blue mb-3">{section}</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {imgs.map((img) => (
                <div key={img.id} className={`rounded-xl overflow-hidden border-2 ${img.selected ? 'border-green-500' : 'border-transparent'} bg-white shadow-sm`}>
                  <img src={img.url} alt="" className="w-full h-32 object-cover" />
                  <div className="p-2 text-xs text-gray-500">
                    <div className="flex justify-between items-center mb-1">
                      <span className="uppercase font-bold text-gray-600">{img.source}</span>
                      {img.hosted ? (
                        <span className="text-green-600 font-bold">✅ Saved</span>
                      ) : (
                        <span className="text-gray-400">Preview</span>
                      )}
                    </div>
                    <div className="truncate mb-2">{img.purpose || img.photographer || ''}</div>
                    <div className="flex flex-wrap gap-1">
                      <button
                        onClick={() => toggleSelected(img)}
                        disabled={busyImageId === img.id}
                        className={`flex-1 rounded px-2 py-1 font-bold transition disabled:opacity-50 ${
                          img.selected 
                            ? 'bg-red-50 text-red-600 hover:bg-red-100' 
                            : 'bg-blue-50 text-brand-blue hover:bg-blue-100'
                        }`}
                      >
                        {busyImageId === img.id ? 'Saving...' : img.selected ? 'Unselect' : 'Select'}
                      </button>
                      <button
                        onClick={() => openEditor(img)}
                        disabled={busyImageId === img.id}
                        className="flex-1 bg-yellow-50 text-yellow-700 rounded px-2 py-1 font-bold hover:bg-yellow-100 disabled:opacity-50"
                      >
                        {busyImageId === img.id ? '...' : 'Edit'}
                      </button>
                      {img.hosted && img.selected && (
                        <button
                          onClick={() => copyUrl(img.url)}
                          className="flex-1 bg-green-50 text-green-700 rounded px-2 py-1 font-bold hover:bg-green-100"
                        >
                          📋 Copy URL
                        </button>
                      )}
                      <button onClick={() => deleteImage(img)} className="flex-1 bg-red-50 text-red-600 rounded px-2 py-1 font-bold hover:bg-red-100">
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {editingImage && (
        <ImageEditorModal
          image={editingImage}
          knowledgeAssetId={selectedAssetId}
          onClose={() => setEditingImage(null)}
          onSaved={() => { setEditingImage(null); loadImages(selectedAssetId); }}
        />
      )}
    </div>
  );
}