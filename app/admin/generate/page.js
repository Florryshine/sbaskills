'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase';
import Link from 'next/link';

// Component that uses useSearchParams — wrapped in Suspense below
function GenerateContent() {
  const searchParams = useSearchParams();
  const assetIdFromUrl = searchParams.get('assetId');

  const [keyword, setKeyword] = useState('');
  const [assetId, setAssetId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [engines, setEngines] = useState({
    blog: false,
    podcast: false,
    quiz: false,
    boss_battle: false,
    flashcard: false,
    study_note: false,
    social: false,
  });

  const supabase = createBrowserClient();

  // Load asset from URL parameter
  useEffect(() => {
    if (assetIdFromUrl) {
      setAssetId(assetIdFromUrl);
      supabase
        .from('knowledge_assets')
        .select('keyword')
        .eq('id', assetIdFromUrl)
        .single()
        .then(({ data, error }) => {
          if (data) {
            setKeyword(data.keyword);
          } else if (error) {
            setError('Could not load asset details: ' + error.message);
          }
        });
    }
  }, [assetIdFromUrl]);

  const handleGenerateKnowledge = async () => {
    if (!keyword.trim()) {
      alert('Please enter a keyword');
      return;
    }

    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const response = await fetch('/api/learning-core/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: keyword.trim() }),
      });

      const data = await response.json();
      if (data.success) {
        setAssetId(data.knowledgeAssetId);
        setResult({ type: 'knowledge', data });
        const url = new URL(window.location);
        url.searchParams.set('assetId', data.knowledgeAssetId);
        window.history.replaceState({}, '', url);
      } else {
        setError(data.error || 'Failed to generate knowledge');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateSelected = async () => {
    const selected = Object.keys(engines).filter(key => engines[key]);
    if (selected.length === 0) {
      alert('Please select at least one engine');
      return;
    }

    setGenerating(true);
    setResult(null);
    setError(null);

    try {
      const response = await fetch('/api/content-engine/generate-selected', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          knowledgeAssetId: assetId,
          engines: selected,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setResult({ type: 'job', data });
      } else {
        setError(data.error || 'Generation failed');
        setResult({ type: 'job', data });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const engineLabels = {
    blog: '📝 Blog Post',
    podcast: '🎙️ Podcast Episode',
    quiz: '❓ Quiz (20 MCQs)',
    boss_battle: '👹 Boss Battle (10 hard)',
    flashcard: '🃏 Flashcards (20-30)',
    study_note: '📝 Study Notes',
    social: '📱 Social Posts (5 platforms)',
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-brand-blue mb-2">🚀 Generate Content</h1>
      <p className="text-gray-500 mb-8">Create a Learning Core, then generate any combination of content.</p>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
          ❌ {error}
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border p-6 mb-6">
        <h2 className="font-bold text-lg mb-4">Step 1: 🧠 Generate Learning Core</h2>
        <div className="flex gap-3">
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="e.g. JAMB Biology Photosynthesis"
            className="flex-1 rounded-xl border border-slate-200 px-4 py-3"
            disabled={!!assetId}
          />
          <button
            onClick={handleGenerateKnowledge}
            disabled={loading || !!assetId}
            className="bg-brand-yellow px-6 py-3 rounded-xl font-bold hover:opacity-90 disabled:opacity-50"
          >
            {loading ? 'Generating...' : assetId ? 'Asset Loaded' : 'Generate Knowledge'}
          </button>
        </div>
        {assetId && (
          <div className="mt-4 p-3 bg-green-50 rounded-xl border border-green-200 flex items-center justify-between">
            <div>
              ✅ <span className="font-medium">Knowledge Asset Ready</span>
              <span className="ml-2 text-sm text-gray-600">“{keyword}”</span>
            </div>
            <Link href="/admin/knowledge-assets" className="text-sm text-brand-blue hover:underline">
              View All Assets →
            </Link>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border p-6 mb-6">
        <h2 className="font-bold text-lg mb-4">Step 2: 📦 Select Content to Generate</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {Object.keys(engineLabels).map((key) => (
            <label
              key={key}
              className={`flex items-center gap-2 p-3 border rounded-xl cursor-pointer transition ${
                assetId ? 'hover:bg-slate-50' : 'opacity-50 cursor-not-allowed'
              }`}
            >
              <input
                type="checkbox"
                checked={engines[key]}
                onChange={() => setEngines({ ...engines, [key]: !engines[key] })}
                disabled={!assetId}
                className="w-4 h-4"
              />
              <span className="text-sm">{engineLabels[key]}</span>
            </label>
          ))}
        </div>
        <button
          onClick={handleGenerateSelected}
          disabled={!assetId || generating}
          className="mt-4 w-full bg-brand-blue text-white py-3 rounded-xl font-bold hover:opacity-90 disabled:opacity-50 transition"
        >
          {generating ? '⏳ Generating...' : '🚀 Generate Selected'}
        </button>
        {generating && (
          <p className="mt-2 text-sm text-gray-500 text-center">
            This may take up to a minute. Check the Generation Jobs page for progress.
          </p>
        )}
      </div>

      {result && (
        <div className="bg-white rounded-2xl shadow-sm border p-6">
          <h3 className="font-bold text-lg mb-2">
            {result.type === 'knowledge' ? '🧠 Knowledge Asset Created' : '✅ Generation Results'}
          </h3>
          <pre className="bg-slate-50 p-4 rounded-xl text-sm overflow-auto max-h-96 whitespace-pre-wrap">
            {JSON.stringify(result.data, null, 2)}
          </pre>
          {result.type === 'job' && result.data.jobId && (
            <div className="mt-4">
              <Link href="/admin/generation-jobs" className="text-brand-blue hover:underline text-sm">
                View Job Details →
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Main page with Suspense boundary — this fixes the build error
export default function GeneratePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Loading...</div>}>
      <GenerateContent />
    </Suspense>
  );
}