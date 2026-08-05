'use client';

// components/admin/PublishToChannels.js
//
// Drops into any "record a draft" admin page (quote-loops, past-question-
// loops, ...) once a content_assets row has media on it. Wires straight
// into the publish pipeline that already exists:
//   1. POST /api/publish/approve  { contentAssetId, channelIds }
//      -> marks the asset approved, creates one publish_jobs row per
//         selected channel (status 'queued')
//   2. POST /api/publish/bulk     { jobIds, mode: 'now' }
//      -> executePublishJob() for each: loads the channel + adapter from
//         lib/publishers/registry.js, refreshes the token if needed, and
//         actually calls the platform API.
// Nothing platform-specific lives here — this is the same path every other
// Social Engine asset already goes out through.

import { useEffect, useState } from 'react';

const PLATFORM_LABELS = {
  tiktok: 'TikTok',
  youtube: 'YouTube',
  instagram: 'Instagram',
  facebook: 'Facebook',
  x: 'X',
  linkedin: 'LinkedIn',
  pinterest: 'Pinterest',
  telegram: 'Telegram',
};

/**
 * @param {Object} props
 * @param {string} props.contentAssetId
 * @param {boolean} [props.disabled] - true until the draft has a recorded video
 */
export default function PublishToChannels({ contentAssetId, disabled }) {
  const [channels, setChannels] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/api/admin/channels')
      .then((r) => r.json())
      .then((d) => {
        const active = (d.data || []).filter((c) => c.is_active);
        setChannels(active);
      })
      .catch(() => setChannels([]))
      .finally(() => setLoading(false));
  }, []);

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const publish = async () => {
    if (selected.size === 0) return;
    setPublishing(true);
    setError(null);
    setResults(null);
    try {
      const approveRes = await fetch('/api/publish/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentAssetId, channelIds: Array.from(selected) }),
      });
      const approveData = await approveRes.json();
      if (!approveRes.ok) throw new Error(approveData.error || 'Approve failed');

      const jobIds = (approveData.jobs || []).map((j) => j.id);
      const bulkRes = await fetch('/api/publish/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobIds, mode: 'now' }),
      });
      const bulkData = await bulkRes.json();
      if (!bulkRes.ok) throw new Error(bulkData.error || 'Publish failed');

      setResults(bulkData.results || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setPublishing(false);
    }
  };

  if (loading) return null;

  if (channels.length === 0) {
    return (
      <p className="text-xs text-gray-400">
        No channels connected yet.{' '}
        <a href="/admin/channels" className="underline text-brand-blue">
          Connect TikTok, YouTube, or another platform
        </a>{' '}
        to publish this.
      </p>
    );
  }

  return (
    <div className="border-t pt-3 mt-3 space-y-2">
      <p className="text-xs font-semibold text-gray-500 uppercase">Publish to</p>
      <div className="flex flex-wrap gap-2">
        {channels.map((c) => (
          <label
            key={c.id}
            className={`flex items-center gap-1.5 border rounded-lg px-2.5 py-1.5 text-xs cursor-pointer ${
              selected.has(c.id) ? 'border-brand-blue bg-blue-50' : 'border-gray-200'
            } ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
          >
            <input
              type="checkbox"
              checked={selected.has(c.id)}
              onChange={() => toggle(c.id)}
              className="accent-brand-blue"
            />
            {PLATFORM_LABELS[c.platform] || c.platform}
            {c.label && c.label !== 'Main' ? ` · ${c.label}` : ''}
          </label>
        ))}
      </div>

      <button
        onClick={publish}
        disabled={disabled || publishing || selected.size === 0}
        className="bg-emerald-600 text-white px-4 py-1.5 rounded-lg text-xs font-bold hover:opacity-90 disabled:opacity-50"
      >
        {publishing ? 'Publishing…' : `🚀 Publish now (${selected.size || 0})`}
      </button>

      {error && <p className="text-xs text-red-600">⚠️ {error}</p>}

      {results && (
        <ul className="text-xs space-y-0.5">
          {results.map((r) => (
            <li key={r.jobId} className={r.success ? 'text-emerald-600' : 'text-red-600'}>
              {r.success ? '✓' : '✗'} {r.success ? `Published (${r.externalId || 'ok'})` : r.error}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
