'use client';

import { useState } from 'react';

/**
 * Drop this into your admin content list/editor next to a published post:
 *   <AdminGeneratePodcastButton contentDraftId={post.id} />
 */
export default function AdminGeneratePodcastButton({ contentDraftId }) {
  const [status, setStatus] = useState('idle'); // idle | generating | done | error
  const [message, setMessage] = useState('');

  async function handleGenerate() {
    setStatus('generating');
    setMessage('');
    try {
      const res = await fetch('/api/content-engine/podcast/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentDraftId, format: 'teacher_examiner' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed');
      setStatus('done');
      setMessage(
        `✅ ${data.segmentCount} segments, ~${Math.round(data.totalDurationSeconds / 60)} min (${data.usedProvider})${
          data.failedSegments ? ` — ${data.failedSegments} segment(s) skipped` : ''
        }`
      );
    } catch (e) {
      setStatus('error');
      setMessage(`❌ ${e.message}`);
    }
  }

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        onClick={handleGenerate}
        disabled={status === 'generating'}
        className="text-sm px-3 py-1.5 rounded-lg bg-brand-blue text-white disabled:opacity-50"
      >
        {status === 'generating' ? '🎙️ Generating podcast…' : '🎙️ Generate Podcast'}
      </button>
      {message && <span className="text-xs text-gray-500">{message}</span>}
    </div>
  );
}
