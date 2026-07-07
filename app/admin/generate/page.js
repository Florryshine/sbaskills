'use client';

import { useState } from 'react';
import { createBrowserClient } from '@/lib/supabase';

export default function GeneratePage() {
  const [keyword, setKeyword] = useState('');
  const [assetId, setAssetId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState(null);
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

  const handleGenerateKnowledge = async () => {
    if (!keyword.trim()) {
      alert('Please enter a keyword');
      return;
    }

    setLoading(true);
    setResult(null);

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
      } else {
        alert(data.error || 'Failed to generate knowledge');
      }
    } catch (error) {
      alert(error.message);
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
      setResult({ type: 'job', data });
    } catch (error) {
      alert(error.message);
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

      {/* Step 1: Generate Knowledge */}
      <div className="bg-white rounded-2xl shadow-sm border p-6 mb-6">
        <h2 className="font-bold text-lg mb-4">Step 1: 🧠 Generate Learning Core</h2>
        <div className="flex gap-3">
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="e.g. JAMB Biology Photosynthesis"
            className="flex-1 rounded-xl border border-slate-200 px-4 py-3"
          />
          <button
            onClick={handleGenerateKnowledge}
            disabled={loading}
            className="bg-brand-yellow px-6 py-3 rounded-xl font-bold hover:opacity-90 disabled:opacity-50"
          >
            {loading ? 'Generating...' : 'Generate Knowledge'}
          </button>
        </div>
        {assetId && (
          <div className="mt-4 p-3 bg-green-50 rounded-xl border border-green-200">
            ✅ Knowledge Asset Ready: <code className="text-sm">{assetId}</code>
          </div>
        )}
      </div>

      {/* Step 2: Select Engines */}
      <div className="bg-white rounded-2xl shadow-sm border p-6 mb-6">
        <h2 className="font-bold text-lg mb-4">Step 2: 📦 Select Content to Generate</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {Object.keys(engineLabels).map((key) => (
            <label key={key} className="flex items-center gap-2 p-3 border rounded-xl hover:bg-slate-50 cursor-pointer">
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
          className="mt-4 w-full bg-brand-blue text-white py-3 rounded-xl font-bold hover:opacity-90 disabled:opacity-50"
        >
          {generating ? 'Generating...' : '🚀 Generate Selected'}
        </button>
      </div>

      {/* Results */}
      {result && (
        <div className="bg-white rounded-2xl shadow-sm border p-6">
          <h3 className="font-bold text-lg mb-2">✅ Results</h3>
          <pre className="bg-slate-50 p-4 rounded-xl text-sm overflow-auto max-h-96">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}