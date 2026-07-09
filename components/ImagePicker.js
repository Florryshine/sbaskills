'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@/lib/supabase';

export default function ImagePicker({ knowledgeAssetId, onSelect, onClose }) {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const supabase = createBrowserClient();

  useEffect(() => {
    if (knowledgeAssetId) {
      loadImages();
    }
  }, [knowledgeAssetId]);

  const loadImages = async () => {
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

  if (loading) {
    return <div className="text-center py-8 text-gray-500">Loading saved images...</div>;
  }

  if (images.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No saved images found for this asset.</p>
        <p className="text-sm text-gray-400 mt-2">
          Go to <strong>Image Library</strong> → select an asset → fetch images → click <strong>Select</strong> on the ones you like.
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm text-gray-500 mb-4">Click an image to insert it into your content:</p>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {images.map((img) => (
          <div
            key={img.id}
            className="border rounded-xl overflow-hidden cursor-pointer hover:border-brand-blue hover:shadow-lg transition-all"
            onClick={() => onSelect(img.url)}
          >
            <img src={img.url} alt="" className="w-full h-40 object-cover" />
            <div className="p-2 text-xs text-gray-500 text-center truncate">
              {img.section_title || 'Image'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}