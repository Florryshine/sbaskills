'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { listPodcastStyles, DEFAULT_PODCAST_STYLE } from '@/lib/podcastStyles';
import { listStudyNoteStyles, DEFAULT_STUDY_NOTE_STYLE } from '@/lib/studyNoteStyles';

// The orchestrator at /api/content-engine/generate-selected expects these
// EXACT keys (see engineEndpoints in that route). Our checkbox ids are
// friendlier/plural in the UI, so we translate before sending.
const ENGINE_ID_MAP = {
  quiz: 'quiz',
  boss_battle: 'boss_battle',
  flashcards: 'flashcard',
  study_notes: 'study_note',
  podcast: 'podcast',
  blog: 'blog',
  social: 'social',
  // The new multi-platform pipeline (Instagram/Facebook/TikTok/etc.) — also
  // auto-renders Instagram carousels and queues TikTok/YouTube video scripts.
  // Kept separate from 'social' above, which is the older single-post engine.
  social_engine: 'social_engine',
};

// UI id -> orchestrator engine id, for the ones that support a style choice.
const STYLE_ENGINE_MAP = {
  podcast: 'podcast',
  study_notes: 'study_note',
};

const PODCAST_STYLE_OPTIONS = listPodcastStyles();
const STUDY_NOTE_STYLE_OPTIONS = listStudyNoteStyles();

export default function GenerateContentPage() {
  return (
    <Suspense fallback={<div className="p-6 text-center text-gray-400">Loading...</div>}>
      <GenerateContentInner />
    </Suspense>
  );
}

function GenerateContentInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createBrowserClient();

  const [assets, setAssets] = useState([]);
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [selectedContent, setSelectedContent] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [logs, setLogs] = useState([]);

  // Chosen style per style-aware content type, keyed by UI id (e.g. 'podcast').
  const [selectedStyles, setSelectedStyles] = useState({
    podcast: DEFAULT_PODCAST_STYLE,
    study_notes: DEFAULT_STUDY_NOTE_STYLE,
  });

  const contentTypes = [
    { id: 'blog', label: 'Blog Post', icon: '📝' },
    { id: 'social', label: 'Social Post (old, single)', icon: '📱' },
    { id: 'social_engine', label: 'Social Engine (all platforms + carousel + video script)', icon: '🚀' },
    { id: 'podcast', label: 'Podcast Episode', icon: '🎙️' },
    { id: 'quiz', label: 'Quiz (20 MCQs)', icon: '🧠' },
    { id: 'boss_battle', label: 'Boss Battle (10 hard)', icon: '👹' },
    { id: 'flashcards', label: 'Flashcards (20-30)', icon: '🃏' },
    { id: 'study_notes', label: 'Study Notes', icon: '📖' },
    { id: 'images', label: 'Images (10 per asset)', icon: '🖼️' },
  ];

  useEffect(() => {
    loadAssets();
    const assetFromQuery = searchParams.get('asset');
    if (assetFromQuery) setSelectedAssetId(assetFromQuery);
  }, []);

  const loadAssets = async () => {
    const { data } = await supabase
      .from('knowledge_assets')
      .select('id, keyword, subject')
      .order('created_at', { ascending: false })
      .limit(100);
    setAssets(data || []);
  };

  const toggleContent = (id, disabled) => {
    if (disabled) return;
    setSelectedContent((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const addLog = (message, type = 'info') => {
    setLogs((prev) => [...prev, { message, type, time: new Date().toLocaleTimeString() }]);
  };

  const handleGenerate = async () => {
    if (!selectedAssetId) { alert('Please select a knowledge asset first.'); return; }
    if (selectedContent.length === 0) { alert('Please select at least one content type to generate.'); return; }

    setGenerating(true);
    setLogs([]);
    addLog(`🚀 Starting generation for asset: ${selectedAssetId}`);

    try {
      // 1. Everything except images goes through the ONE orchestrator call
      // (this is what actually creates the generation_jobs row).
      const engines = selectedContent
        .filter((type) => type !== 'images')
        .map((type) => ENGINE_ID_MAP[type] || type);

      // Build the styles map the orchestrator expects: { podcast: 'deep_dive', study_note: 'mcq_practice' }
      const styles = {};
      for (const uiId of Object.keys(STYLE_ENGINE_MAP)) {
        if (selectedContent.includes(uiId)) {
          styles[STYLE_ENGINE_MAP[uiId]] = selectedStyles[uiId];
        }
      }

      if (engines.length > 0) {
        addLog(`⏳ Generating: ${engines.join(', ')}...`);
        const res = await fetch('/api/content-engine/generate-selected', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ knowledgeAssetId: selectedAssetId, engines, styles }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Generation failed');

        (data.results || []).forEach((r) => {
          if (r.status === 'completed') addLog(`✅ ${r.engine} generated successfully`, 'success');
          else if (r.status === 'skipped') addLog(`⏭️ ${r.engine} skipped: ${r.message || ''}`, 'info');
          else addLog(`❌ ${r.engine} failed: ${r.error || 'Unknown error'}`, 'error');
        });
        addLog(`📋 Job ${data.jobId} — ${data.summary.completed}/${data.summary.total} completed`, 'info');
      }

      // 2. Images — separate two-step flow (planning + fetching), unaffected by the above
      if (selectedContent.includes('images')) {
        addLog('🖼️ Generating visual blueprint...');
        const blueprintRes = await fetch('/api/engines/visual-blueprint', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ knowledgeAssetId: selectedAssetId }),
        });
        const blueprintData = await blueprintRes.json();
        if (!blueprintRes.ok) throw new Error(`Blueprint failed: ${blueprintData.error}`);
        addLog(`✅ Blueprint generated (${blueprintData.plan?.length || 0} sections)`, 'success');

        addLog('📸 Fetching images from Pixabay/Pexels/Wikimedia...');
        const imagesRes = await fetch('/api/engines/images', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ knowledgeAssetId: selectedAssetId }),
        });
        const imagesData = await imagesRes.json();
        if (!imagesRes.ok) throw new Error(`Image fetch failed: ${imagesData.error}`);
        addLog(`✅ ${imagesData.savedCount || 0} images fetched (previews)`, 'success');

        addLog('🔗 Redirecting to Image Engine...');
        setTimeout(() => router.push(`/admin/asset-images?asset=${selectedAssetId}`), 1000);
        return;
      }

      addLog('🎉 Done!', 'success');
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
              <option key={asset.id} value={asset.id}>{asset.subject ? `${asset.subject} — ` : ''}{asset.keyword}</option>
            ))}
          </select>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">2️⃣</span>
            <h2 className="text-lg font-bold text-gray-900">Select Content to Generate</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {contentTypes.map((type) => (
              <div key={type.id}>
                <label
                  title={type.note || ''}
                  className={`flex items-center gap-3 p-3 rounded-xl border-2 transition ${
                    type.disabled ? 'opacity-50 cursor-not-allowed border-gray-200'
                    : selectedContent.includes(type.id) ? 'border-brand-blue bg-blue-50 cursor-pointer'
                    : 'border-gray-200 hover:border-gray-300 cursor-pointer'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedContent.includes(type.id)}
                    onChange={() => toggleContent(type.id, type.disabled)}
                    disabled={type.disabled}
                    className="w-4 h-4 text-brand-blue focus:ring-brand-blue"
                  />
                  <span className="text-lg">{type.icon}</span>
                  <span className="font-medium text-gray-700">{type.label}</span>
                </label>

                {/* Style picker — only shown once the content type is checked,
                    and only for style-aware engines (podcast, study notes). */}
                {type.id === 'podcast' && selectedContent.includes('podcast') && (
                  <select
                    value={selectedStyles.podcast}
                    onChange={(e) => setSelectedStyles((prev) => ({ ...prev, podcast: e.target.value }))}
                    className="mt-2 w-full text-sm border rounded-lg p-2 bg-white"
                  >
                    {PODCAST_STYLE_OPTIONS.map((s) => (
                      <option key={s.id} value={s.id}>{s.label}</option>
                    ))}
                  </select>
                )}
                {type.id === 'study_notes' && selectedContent.includes('study_notes') && (
                  <select
                    value={selectedStyles.study_notes}
                    onChange={(e) => setSelectedStyles((prev) => ({ ...prev, study_notes: e.target.value }))}
                    className="mt-2 w-full text-sm border rounded-lg p-2 bg-white"
                  >
                    {STUDY_NOTE_STYLE_OPTIONS.map((s) => (
                      <option key={s.id} value={s.id}>{s.label}</option>
                    ))}
                  </select>
                )}
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={handleGenerate}
          disabled={generating || !selectedAssetId || selectedContent.length === 0}
          className="w-full bg-brand-blue text-white py-4 rounded-2xl font-bold text-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
        >
          {generating ? (<><Loader2 className="w-5 h-5 animate-spin" />Generating...</>) : '⚡ Generate Selected'}
        </button>

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
