'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

export default function PastePodcastPage() {
  const [mode, setMode] = useState('single'); // 'single' | 'batch'
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [targetMinutes, setTargetMinutes] = useState(5);
  const [status, setStatus] = useState('idle'); // idle | submitting | polling | done | error
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const pollRef = useRef(null);

  useEffect(() => () => clearInterval(pollRef.current), []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim() || !text.trim()) return;
    setStatus('submitting');
    setError('');
    setResult(null);

    try {
      if (mode === 'single') {
        const res = await fetch('/api/content-engine/podcast/generate-from-text', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, text, source: 'manual_paste' }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Generation failed');
        setStatus('done');
        setResult({ kind: 'single', ...data });
      } else {
        const res = await fetch('/api/content-engine/podcast/generate-batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ seriesTitle: title, text, targetMinutes: Number(targetMinutes) || 5 }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Batch generation failed');
        setStatus('polling');
        pollBatch(data.seriesId);
      }
    } catch (err) {
      setStatus('error');
      setError(err.message);
    }
  }

  function pollBatch(seriesId) {
    clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/content-engine/podcast/generate-batch/status?seriesId=${seriesId}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Status check failed');
        setResult({ kind: 'batch', ...data });
        if (data.status === 'ready' || data.status === 'failed') {
          clearInterval(pollRef.current);
          setStatus(data.status === 'ready' ? 'done' : 'error');
          if (data.status === 'failed') setError(data.error || 'Batch generation failed');
        }
      } catch (err) {
        clearInterval(pollRef.current);
        setStatus('error');
        setError(err.message);
      }
    }, 3000);
  }

  const busy = status === 'submitting' || status === 'polling';

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-brand-blue">🎙️ Paste Text → Podcast</h1>
        <Link href="/admin/podcasts" className="text-sm text-blue-600 hover:underline">
          ← All episodes
        </Link>
      </div>

      <p className="text-sm text-gray-500 mb-6">
        Paste a playbook, study note, or any other text and generate a podcast from it directly —
        no research pipeline required. Long text can be split into a full episode series.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4 bg-white border rounded-2xl p-5 shadow-sm">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMode('single')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
              mode === 'single' ? 'bg-brand-blue text-white' : 'bg-gray-100 text-gray-600'
            }`}
          >
            Single episode
          </button>
          <button
            type="button"
            onClick={() => setMode('batch')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
              mode === 'batch' ? 'bg-brand-blue text-white' : 'bg-gray-100 text-gray-600'
            }`}
          >
            Batch series
          </button>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {mode === 'single' ? 'Episode title' : 'Series title'}
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full border rounded-lg p-2"
            placeholder={mode === 'single' ? 'e.g. Photosynthesis Explained' : 'e.g. JAMB Biology Playbook'}
            required
          />
        </div>

        {mode === 'batch' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Target minutes per episode
            </label>
            <input
              type="number"
              min={2}
              max={20}
              value={targetMinutes}
              onChange={(e) => setTargetMinutes(e.target.value)}
              className="w-32 border rounded-lg p-2"
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Text</label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={14}
            className="w-full border rounded-lg p-2 font-mono text-sm"
            placeholder="Paste the playbook or study text here…"
            required
          />
          <p className="text-xs text-gray-400 mt-1">{text.length.toLocaleString()} characters</p>
        </div>

        <button
          type="submit"
          disabled={busy}
          className="px-4 py-2 rounded-lg bg-brand-blue text-white font-medium disabled:opacity-50"
        >
          {busy ? 'Generating…' : mode === 'single' ? 'Generate Podcast' : 'Generate Series'}
        </button>
      </form>

      {status === 'error' && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          ❌ {error}
        </div>
      )}

      {result?.kind === 'single' && status === 'done' && (
        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">
          ✅ Episode ready — {result.segmentCount} segments, ~
          {Math.round((result.totalDurationSeconds || 0) / 60)} min ({result.usedProvider})
          {result.failedSegments ? ` — ${result.failedSegments} segment(s) skipped` : ''}
        </div>
      )}

      {result?.kind === 'batch' && (
        <div className="mt-4 p-4 bg-white border rounded-lg text-sm space-y-2">
          <p className="font-medium">
            Series status: <span className="capitalize">{result.status}</span>
            {result.episodeCount ? ` — ${result.completedCount}/${result.episodeCount} episodes` : ''}
          </p>
          {(result.episodes || []).map((ep) => (
            <div key={ep.id} className="flex justify-between border-t pt-2 text-gray-600">
              <span>
                {ep.episode_number}. {ep.title}
              </span>
              <span className="capitalize">{ep.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
