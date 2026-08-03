'use client';

// app/admin/quote-loops/page.js
//
// Full flow: pick a knowledge asset -> generate N short quote-loop drafts
// (LLM lines + background candidates) -> pick one -> record it with
// QuoteLoopRecorder -> saved into content_assets/media_files, ready for
// the existing social-engine review dashboard.
//
// Needs a `quote-loops` bucket in Supabase storage (public read,
// authenticated upload — same policy shape as `lesson-videos`) before the
// first save; nothing else new to configure.

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import QuoteLoopRecorder from '@/components/QuoteLoopRecorder';

export default function QuoteLoopsPage() {
  const [assets, setAssets] = useState([]);
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [count, setCount] = useState(5);
  const [drafts, setDrafts] = useState([]);
  const [activeDraft, setActiveDraft] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [warnings, setWarnings] = useState([]);

  useEffect(() => {
    const supabase = createBrowserClient();
    supabase
      .from('knowledge_assets')
      .select('id, keyword, subject')
      .order('created_at', { ascending: false })
      .limit(200)
      .then(({ data }) => setAssets(data || []));
  }, []);

  const loadExistingDrafts = async (assetId) => {
    try {
      const res = await fetch(`/api/admin/quote-loops/list?knowledgeAssetId=${assetId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load drafts');
      setDrafts(data.contentAssets || []);
    } catch (err) {
      setErrorMsg(err.message);
      setDrafts([]);
    }
  };

  useEffect(() => {
    if (selectedAssetId) loadExistingDrafts(selectedAssetId);
    else setDrafts([]);
  }, [selectedAssetId]);

  const handleGenerate = async () => {
    if (!selectedAssetId) return;
    setGenerating(true);
    setErrorMsg(null);
    setWarnings([]);
    try {
      const res = await fetch('/api/admin/quote-loops/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ knowledgeAssetId: selectedAssetId, count }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed');
      setWarnings(data.warnings || []);
      await loadExistingDrafts(selectedAssetId);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const hasVideo = (draft) => (draft.media_files || []).some((m) => m.media_type === 'video' && m.role === 'primary');

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Quote Loops</h1>
        <p className="text-sm text-gray-500">
          Short, loopable, motivational text-over-video clips generated from a topic.
        </p>
      </div>

      <div className="bg-white rounded-xl border p-4 space-y-3">
        <label className="block text-sm font-semibold">Knowledge asset / topic</label>
        <select
          value={selectedAssetId}
          onChange={(e) => setSelectedAssetId(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm"
        >
          <option value="">Select a topic…</option>
          {assets.map((a) => (
            <option key={a.id} value={a.id}>
              {a.keyword} {a.subject ? `— ${a.subject}` : ''}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-3">
          <label className="text-sm font-semibold">How many lines?</label>
          <input
            type="number"
            min={1}
            max={20}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className="w-20 border rounded-lg px-2 py-1 text-sm"
          />
          <button
            onClick={handleGenerate}
            disabled={!selectedAssetId || generating}
            className="bg-brand-blue text-white px-4 py-2 rounded-lg text-sm font-bold hover:opacity-90 disabled:opacity-50"
          >
            {generating ? 'Generating…' : '✨ Generate'}
          </button>
        </div>

        {errorMsg && <p className="text-sm text-red-600">⚠️ {errorMsg}</p>}
        {warnings.map((w, i) => (
          <p key={i} className="text-sm text-amber-600">
            ⚠️ {w}
          </p>
        ))}
      </div>

      {drafts.length > 0 && (
        <div className="space-y-2">
          <h2 className="font-bold text-sm text-gray-500 uppercase">Drafts</h2>
          {drafts.map((draft) => (
            <div key={draft.id} className="bg-white rounded-xl border p-4 flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold">{draft.body}</p>
                <p className="text-xs text-gray-500">
                  {draft.metadata?.background?.type
                    ? `${draft.metadata.background.type} background (${draft.metadata.background.source})`
                    : 'no background found'}{' '}
                  · {hasVideo(draft) ? '✅ recorded' : '⏳ not recorded'}
                </p>
              </div>
              <button
                onClick={() => setActiveDraft(draft)}
                className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-bold hover:bg-gray-200 whitespace-nowrap"
              >
                {hasVideo(draft) ? 'Re-record' : 'Record'}
              </button>
            </div>
          ))}
        </div>
      )}

      {activeDraft && (
        <div className="bg-white rounded-xl border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">Recording: “{activeDraft.body}”</h2>
            <button onClick={() => setActiveDraft(null)} className="text-sm text-gray-400 hover:text-gray-600">
              ✕ Close
            </button>
          </div>
          <QuoteLoopRecorder
            contentAsset={activeDraft}
            onSaved={() => loadExistingDrafts(selectedAssetId)}
          />
        </div>
      )}
    </div>
  );
}
