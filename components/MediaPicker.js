'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import ImageEditorModal from '@/components/ImageEditorModal';

export default function MediaPicker({ knowledgeAssetId, onSelect, onClose }) {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState('saved'); // 'saved' | 'upload'
  const [editingImage, setEditingImage] = useState(null);
  const supabase = createBrowserClient();

  useEffect(() => {
    if (knowledgeAssetId) {
      loadSavedImages();
    }
  }, [knowledgeAssetId]);

  const loadSavedImages = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('asset_images')
      .select('*')
      .eq('knowledge_asset_id', knowledgeAssetId)
      .eq('selected', true)
      .eq('hosted', true)
      .order('created_at', { ascending: false });
    setImages(data || []);
    setLoading(false);
  };

  // Upload a new image from local device
  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);

    try {
      // 1. Upload to storage
      const fileExt = file.name.split('.').pop();
      const fileName = `media-${Date.now()}.${fileExt}`;
      const filePath = `asset-images/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('asset-images')
        .upload(filePath, file, { cacheControl: '3600', upsert: false });

      if (uploadError) throw uploadError;

      // 2. Get public URL
      const { data: urlData } = supabase.storage
        .from('asset-images')
        .getPublicUrl(filePath);

      const publicUrl = urlData.publicUrl;

      // 3. Insert into asset_images (so it becomes a saved image)
      const { error: insertError } = await supabase
        .from('asset_images')
        .insert({
          knowledge_asset_id: knowledgeAssetId,
          source: 'upload',
          url: publicUrl,
          original_url: publicUrl,
          hosted: true,
          storage_path: filePath,
          selected: true,
          purpose: 'user_upload',
        });

      if (insertError) throw insertError;

      // 4. Reload saved images
      await loadSavedImages();

      // 5. Return the URL to the caller
      onSelect(publicUrl);
      onClose();

    } catch (err) {
      alert('Upload failed: ' + err.message);
    } finally {
      setUploading(false);
      e.target.value = ''; // reset file input
    }
  };

  // Open editor for an image
  const openEditor = (image) => {
    setEditingImage(image);
  };

  // After editing, refresh the list and pass the new URL
  const handleEditorSaved = async (newImage) => {
    setEditingImage(null);
    await loadSavedImages();
    // Optionally pass the updated URL back
    onSelect(newImage.url);
    onClose();
  };

  return (
    <div className="bg-white rounded-2xl p-6 max-w-4xl w-full max-h-[80vh] overflow-y-auto">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">📸 Media Library</h2>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-xl">✕</button>
      </div>

      {/* Tabs */}
      <div className="flex border-b mb-4">
        <button
          className={`px-4 py-2 text-sm font-bold ${activeTab === 'saved' ? 'border-b-2 border-brand-blue text-brand-blue' : 'text-gray-500'}`}
          onClick={() => setActiveTab('saved')}
        >
          📸 Saved Images
        </button>
        <button
          className={`px-4 py-2 text-sm font-bold ${activeTab === 'upload' ? 'border-b-2 border-brand-blue text-brand-blue' : 'text-gray-500'}`}
          onClick={() => setActiveTab('upload')}
        >
          📤 Upload New
        </button>
      </div>

      {/* Saved Images Tab */}
      {activeTab === 'saved' && (
        <div>
          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading saved images...</div>
          ) : images.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No saved images found for this asset.</p>
              <p className="text-sm text-gray-400 mt-2">
                Go to <strong>Image Library</strong> → select an asset → fetch images → click <strong>Select</strong> on the ones you like.
              </p>
              <p className="text-sm text-gray-400 mt-1">Or upload a new image from the "Upload New" tab.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {images.map((img) => (
                <div key={img.id} className="border rounded-xl overflow-hidden bg-white shadow-sm hover:shadow-md transition">
                  <img src={img.url} alt="" className="w-full h-40 object-cover" />
                  <div className="p-2 text-xs text-gray-500">
                    <div className="truncate">{img.section_title || 'Image'}</div>
                    <div className="flex gap-1 mt-1">
                      <button
                        onClick={() => onSelect(img.url)}
                        className="flex-1 bg-brand-blue text-white rounded px-2 py-1 text-xs font-bold hover:bg-blue-600"
                      >
                        Insert
                      </button>
                      <button
                        onClick={() => openEditor(img)}
                        className="flex-1 bg-yellow-500 text-white rounded px-2 py-1 text-xs font-bold hover:bg-yellow-600"
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Upload Tab */}
      {activeTab === 'upload' && (
        <div className="py-8 text-center">
          <div className="border-2 border-dashed border-gray-300 rounded-xl p-8">
            <p className="text-gray-500 mb-2">Click to select an image from your device</p>
            <input
              type="file"
              accept="image/*"
              onChange={handleUpload}
              disabled={uploading}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            {uploading && <p className="mt-2 text-blue-500">Uploading...</p>}
            <p className="text-xs text-gray-400 mt-2">
              Uploaded images will be saved to your library and available in the "Saved Images" tab.
            </p>
          </div>
        </div>
      )}

      {/* Image Editor Modal */}
      {editingImage && (
        <ImageEditorModal
          image={editingImage}
          knowledgeAssetId={knowledgeAssetId}
          onClose={() => setEditingImage(null)}
          onSaved={handleEditorSaved}
        />
      )}
    </div>
  );
}