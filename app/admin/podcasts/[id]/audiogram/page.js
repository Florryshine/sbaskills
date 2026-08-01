'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { createBrowserClient } from '@/lib/supabase';
import AudiogramRecorder from '@/components/AudiogramRecorder';

export default function AudiogramPage() {
  const { id } = useParams();
  const supabase = createBrowserClient();

  const [episode, setEpisode] = useState(null);
  const [segments, setSegments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [savedUrl, setSavedUrl] = useState(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data: ep, error: epError } = await supabase
        .from('podcast_episodes')
        .select('*')
        .eq('id', id)
        .single();

      if (epError || !ep) {
        setError('Episode not found.');
        setLoading(false);
        return;
      }
      if (ep.status !== 'ready') {
        setError(`Episode status is "${ep.status}" — it needs to be "ready" before an audiogram can be made.`);
        setLoading(false);
        return;
      }

      const { data: segs, error: segError } = await supabase
        .from('podcast_segments')
        .select('*')
        .eq('episode_id', id)
        .order('position', { ascending: true });

      if (segError) {
        setError('Failed to load segments.');
        setLoading(false);
        return;
      }

      const validSegments = (segs || []).filter((s) => s.audio_url);
      setEpisode(ep);
      setSegments(validSegments);
      setSavedUrl(ep.audiogram_url || null);
      setLoading(false);
    }
    load();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <Link href="/admin/podcasts" className="text-sm text-brand-blue hover:underline">
          ← Back to Podcast Episodes
        </Link>
      </div>

      <h1 className="text-2xl font-bold text-brand-blue mb-1">🎥 Audiogram</h1>
      <p className="text-sm text-gray-500 mb-6">
        Renders in your browser — square video with a live waveform and burned-in captions, built from this
        episode's existing segment audio. No server rendering involved.
      </p>

      {loading && <div className="text-center py-8">Loading…</div>}
      {error && <div className="text-center py-8 text-red-600">{error}</div>}

      {!loading && !error && episode && (
        <>
          {savedUrl && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-4 text-sm">
              ✓ An audiogram is already saved for this episode.{' '}
              <a href={savedUrl} target="_blank" rel="noreferrer" className="text-emerald-700 underline font-semibold">
                View current version
              </a>
              . Recording again below will replace it.
            </div>
          )}
          <AudiogramRecorder episode={episode} segments={segments} onSaved={setSavedUrl} />
        </>
      )}
    </div>
  );
}
