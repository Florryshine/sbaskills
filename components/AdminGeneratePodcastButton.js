'use client';

import { useState } from 'react';

/**
 * Drop this into your admin content list/editor next to a published post:
 *   <AdminGeneratePodcastButton title={post.title} content={post.content} />
 *
 * Sends the post's own title/content straight to generate-from-text —
 * blog posts (content_drafts) were never knowledge_assets, so there was
 * never a knowledgeAssetId for this button to send.
 */
export default function AdminGeneratePodcastButton({ title, content }) {
  const [status, setStatus] = useState('idle'); // idle | generating | done | error
  const [message, setMessage] = useState('');

  async function handleGenerate() {
    if (!content) {
      setStatus('error');
      setMessage('❌ This post has no content to generate a podcast from');
      return;
    }
    setStatus('generating');
    setMessage('');
    try {
      const res = await fetch('/api/content-engine/podcast/generate-from-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          text: content,
          source: 'blog_post',
          format: 'teacher_examiner',
          saveAsAsset: false,
        }),
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
