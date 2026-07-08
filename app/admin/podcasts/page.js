'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import Link from 'next/link';

export default function AdminPodcastsPage() {
  const [episodes, setEpisodes] = useState([]);
  const [loading, setLoading] = useState(true);
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

  const regenerateEpisode = async (id) => {
    // This would call the podcast generation route again
    // You can pass the same knowledgeAssetId – but we don't store that here.
    // For now, we'll just reload – you can implement a proper retry later.
    alert('Regenerate feature coming soon – you can re-run the generation from the Generate Content page.');
  };

  const getStatusBadge = (status) => {
    const colors = {
      generating: 'bg-blue-100 text-blue-700',
      ready: 'bg-green-100 text-green-700',
      failed: 'bg-red-100 text-red-700',
    };
    return `px-2 py-1 rounded-full text-xs font-bold ${colors[status] || 'bg-gray-100'}`;
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-brand-blue mb-6">🎙️ Podcast Episodes</h1>
      {loading ? (
        <div className="text-center py-8">Loading...</div>
      ) : episodes.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No podcast episodes found.</div>
      ) : (
        <div className="grid gap-4">
          {episodes.map((ep) => (
            <div key={ep.id} className="bg-white rounded-2xl shadow-sm border p-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold">{ep.title}</h3>
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
                  <button
                    onClick={() => regenerateEpisode(ep.id)}
                    className="bg-yellow-100 text-yellow-700 px-4 py-2 rounded-xl text-sm font-bold hover:bg-yellow-200"
                  >
                    🔄 Regenerate
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
          ))}
        </div>
      )}
    </div>
  );
}