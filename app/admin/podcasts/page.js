'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import Link from 'next/link';

export default function AdminPodcastsPage() {
  const [episodes, setEpisodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [regeneratingId, setRegeneratingId] = useState(null);
  const supabase = createBrowserClient();

  useEffect(() => {
    loadEpisodes();
  }, []);

  const loadEpisodes = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('podcast_episodes')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Error loading episodes:', error);
    } else {
      setEpisodes(data || []);
    }
    setLoading(false);
  };

  const deleteEpisode = async (id) => {
    if (!confirm('Delete this episode and all its segments?')) return;
    const { error } = await supabase
      .from('podcast_episodes')
      .delete()
      .eq('id', id);
    if (error) alert(error.message);
    else loadEpisodes();
  };

  const regenerateEpisode = async (ep) => {
    if (!ep.knowledge_asset_id) {
      alert(
        "This episode wasn't generated from a saved knowledge asset (e.g. it came from a blog post), so there's no source text to regenerate from."
      );
      return;
    }
    if (!confirm(`Regenerate "${ep.title}"? This creates a new episode from the same source text.`)) return;
    setRegeneratingId(ep.id);
    try {
      const res = await fetch('/api/content-engine/podcast/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ knowledgeAssetId: ep.knowledge_asset_id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Regeneration failed');
      await loadEpisodes();
    } catch (e) {
      alert(`❌ ${e.message}`);
    } finally {
      setRegeneratingId(null);
    }
  };

  const getStatusBadge = (status) => {
    const colors = {
      generating: 'bg-blue-100 text-blue-700',
      ready: 'bg-green-100 text-green-700',
      failed: 'bg-red-100 text-red-700',
    };
    return `px-2 py-1 rounded-full text-xs font-bold ${colors[status] || 'bg-gray-100'}`;
  };

  // Group series episodes together; standalone episodes each get their own group.
  const seriesMap = new Map();
  const standalone = [];
  for (const ep of episodes) {
    if (ep.series_id) {
      if (!seriesMap.has(ep.series_id)) seriesMap.set(ep.series_id, []);
      seriesMap.get(ep.series_id).push(ep);
    } else {
      standalone.push(ep);
    }
  }
  for (const eps of seriesMap.values()) {
    eps.sort((a, b) => (a.episode_number || 0) - (b.episode_number || 0));
  }

  const renderEpisode = (ep) => (
    <div key={ep.id} className="bg-white rounded-2xl shadow-sm border p-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h3 className="font-bold">
            {ep.episode_number ? `Ep. ${ep.episode_number} — ` : ''}
            {ep.title}
          </h3>
          <p className="text-sm text-gray-500">
            Status: <span className={getStatusBadge(ep.status)}>{ep.status}</span>
            {ep.total_duration_seconds && (
              <span className="ml-2">• Duration: {Math.round(ep.total_duration_seconds / 60)} min</span>
            )}
            {ep.error_message && (
              <span className="ml-2 text-red-500 text-xs">⚠️ {ep.error_message}</span>
            )}
          </p>
          <p className="text-xs text-gray-400">
            Created: {new Date(ep.created_at).toLocaleString()}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {ep.status === 'ready' && (
            <Link
              href={`/podcast/${ep.id}`}
              target="_blank"
              className="text-brand-blue px-4 py-2 rounded-xl text-sm font-bold hover:bg-blue-50"
            >
              ▶️ Play
            </Link>
          )}
          {ep.status === 'ready' && (
            <Link
              href={`/admin/podcasts/${ep.id}/audiogram`}
              className="bg-indigo-100 text-indigo-700 px-4 py-2 rounded-xl text-sm font-bold hover:bg-indigo-200"
            >
              {ep.audiogram_url ? '🎥 Audiogram ✓' : '🎥 Create Audiogram'}
            </Link>
          )}
          <button
            onClick={() => regenerateEpisode(ep)}
            disabled={regeneratingId === ep.id}
            className="bg-yellow-100 text-yellow-700 px-4 py-2 rounded-xl text-sm font-bold hover:bg-yellow-200 disabled:opacity-50"
          >
            {regeneratingId === ep.id ? '🔄 Regenerating…' : '🔄 Regenerate'}
          </button>
          <button
            onClick={() => deleteEpisode(ep.id)}
            className="bg-red-100 text-red-600 px-4 py-2 rounded-xl text-sm font-bold hover:bg-red-200"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-brand-blue">🎙️ Podcast Episodes</h1>
        <Link
          href="/admin/podcasts/paste"
          className="bg-brand-blue text-white px-4 py-2 rounded-xl text-sm font-bold hover:opacity-90"
        >
          + Paste Text → Podcast
        </Link>
      </div>
      {loading ? (
        <div className="text-center py-8">Loading...</div>
      ) : episodes.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No podcast episodes found.</div>
      ) : (
        <div className="space-y-8">
          {standalone.length > 0 && (
            <div className="grid gap-4">{standalone.map(renderEpisode)}</div>
          )}
          {[...seriesMap.entries()].map(([seriesId, eps]) => (
            <div key={seriesId}>
              <h2 className="text-lg font-bold text-gray-700 mb-3">
                📚 {eps[0].series_title || 'Series'} ({eps.length} episode{eps.length === 1 ? '' : 's'})
              </h2>
              <div className="grid gap-4">{eps.map(renderEpisode)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
