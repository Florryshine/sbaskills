'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase';
import { 
  Loader2, CheckCircle, AlertCircle, Image as ImageIcon 
} from 'lucide-react';

export default function GenerateContentPage() {
  const router = useRouter();
  const supabase = createBrowserClient();

  const [assets, setAssets] = useState([]);
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [selectedContent, setSelectedContent] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [logs, setLogs] = useState([]);

  // Available content types
  const contentTypes = [
    { id: 'blog', label: 'Blog Post', icon: '📝' },
    { id: 'podcast', label: 'Podcast Episode', icon: '🎙️' },
    { id: 'quiz', label: 'Quiz (20 MCQs)', icon: '🧠' },
    { id: 'boss_battle', label: 'Boss Battle (10 hard)', icon: '👹' },
    { id: 'flashcards', label: 'Flashcards (20-30)', icon: '🃏' },
    { id: 'study_notes', label: 'Study Notes', icon: '📖' },
    { id: 'images', label: 'Images (10 per asset)', icon: '🖼️' }, // NEW
  ];

  useEffect(() => {
    loadAssets();
  }, []);

  const loadAssets = async () => {
    const { data } = await supabase
      .from('knowledge_assets')
      .select('id, keyword, subject')
      .order('created_at', { ascending: false })
      .limit(100);
    setAssets(data || []);
  };

  const toggleContent = (id) => {
    setSelectedContent(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const addLog = (message, type = 'info') => {
    setLogs(prev => [...prev, { message, type, time: new Date().toLocaleTimeString() }]);
  };

  const handleGenerate = async () => {
    if (!selectedAssetId) {
      alert('Please select a knowledge asset first.');
      return;
    }
    if (selectedContent.length === 0) {
      alert('Please select at least one content type to generate.');
      return;
    }

    setGenerating(true);
    setLogs([]);
    addLog(`🚀 Starting generation for asset: ${selectedAssetId}`);

    try {
      // 1. Generate all selected content types (except images)
      const contentPromises = selectedContent
        .filter(type => type !== 'images')
        .map(async (type) => {
          addLog(`⏳ Generating ${type}...`);
          const res = await fetch('/api/content-engine/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              knowledgeAssetId: selectedAssetId, 
              contentType: type 
            }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(`${type} failed: ${data.error || 'Unknown error'}`);
          addLog(`✅ ${type} generated successfully`, 'success');
          return data;
        });

      // Wait for all content generation to finish (they run in parallel)
      await Promise.all(contentPromises);

      // 2. If Images is selected, generate visual blueprint and fetch images
      if (selectedContent.includes('images')) {
        addLog('🖼️ Generating visual blueprint...');
        const blueprintRes = await fetch('/api/engines/visual-blueprint', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ knowledgeAssetId: selectedAssetId }),
        });
        const blueprintData = await blueprintRes.json();
        if (!blueprintRes.ok) throw new Error(`Blueprint failed: ${blueprintData.error}`);
        addLog(`✅ Blueprint generated (${blueprintData.count || 0} sections)`, 'success');

        addLog('📸 Fetching images from Pixabay/Pexels/Wikimedia...');
        const imagesRes = await fetch('/api/engines/images', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ knowledgeAssetId: selectedAssetId }),
        });
        const imagesData = await imagesRes.json();
        if (!imagesRes.ok) throw new Error(`Image fetch failed: ${imagesData.error}`);
        addLog(`✅ ${imagesData.savedCount || 0} images fetched (previews)`, 'success');

        // 3. Redirect to Image Engine page to review & select
        addLog(`🔗 Redirecting to Image Engine...`);
        setTimeout(() => {
          router.push(`/admin/asset-images?asset=${selectedAssetId}`);
        }, 1000);
        return; // stop here, we'll redirect
      }

      // If no images selected, just show success and stay
      addLog('🎉 All selected content generated successfully!', 'success');

    } catch (error) {
      addLog(`❌ Error: ${error.message}`, 'error');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">🚀 Generate Content</h1>

        {/* Step 1: Pick Asset */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">1️⃣</span>
            <h2 className="text-lg font-bold text-gray-900">Pick a Knowledge Asset</h2>
          </div>
          <select
            value={selectedAssetId}
            onChange={(e) => setSelectedAssetId(e.target.value)}
            className="w-full border rounded-xl p-3 bg-gray-50 focus:ring-2 focus:ring-brand-blue focus:border-transparent"
          >
            <option value="">Select an asset...</option>
            {assets.map((asset) => (
              <option key={asset.id} value={asset.id}>
                {asset.subject ? `${asset.subject} — ` : ''}{asset.keyword}
              </option>
            ))}
          </select>
          {selectedAssetId && (
            <div className="mt-2 text-sm text-green-600">
              ✅ Asset loaded: {assets.find(a => a.id === selectedAssetId)?.keyword}
            </div>
          )}
        </div>

        {/* Step 2: Select Content */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">2️⃣</span>
            <h2 className="text-lg font-bold text-gray-900">Select Content to Generate</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {contentTypes.map((type) => (
              <label
                key={type.id}
                className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition ${
                  selectedContent.includes(type.id)
                    ? 'border-brand-blue bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedContent.includes(type.id)}
                  onChange={() => toggleContent(type.id)}
                  className="w-4 h-4 text-brand-blue focus:ring-brand-blue"
                />
                <span className="text-lg">{type.icon}</span>
                <span className="font-medium text-gray-700">{type.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Generate Button */}
        <button
          onClick={handleGenerate}
          disabled={generating || !selectedAssetId || selectedContent.length === 0}
          className="w-full bg-brand-blue text-white py-4 rounded-2xl font-bold text-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
        >
          {generating ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Generating...
            </>
          ) : (
            '⚡ Generate Selected'
          )}
        </button>

        {/* Logs */}
        {logs.length > 0 && (
          <div className="mt-6 bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <h3 className="font-bold text-gray-700 mb-2">📋 Generation Log</h3>
            <div className="space-y-1 max-h-60 overflow-y-auto text-sm">
              {logs.map((log, i) => (
                <div key={i} className="flex items-center gap-2">
                  {log.type === 'success' && <CheckCircle className="w-4 h-4 text-green-500" />}
                  {log.type === 'error' && <AlertCircle className="w-4 h-4 text-red-500" />}
                  {log.type === 'info' && <span className="w-4 h-4 text-gray-400">•</span>}
                  <span className="text-gray-600">
                    <span className="text-gray-400 text-xs mr-2">{log.time}</span>
                    {log.message}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}