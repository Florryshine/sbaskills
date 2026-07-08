'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import MarkDoneButton from '@/components/MarkDoneButton';
import Link from 'next/link';

export const dynamic = 'force-dynamic';
export default function AudioPage() {
  const [audios, setAudios] = useState([]);
  const [podcasts, setPodcasts] = useState([]);
  const [loading, setLoading] = useState(true);
  const supabase = createBrowserClient();

  useEffect(() => {
    async function fetchAudio() {
      // Fetch manual audio uploads
      const { data: audioData } = await supabase
        .from('audio_library')
        .select('*')
        .order('created_at', { ascending: false });

      // Fetch ready podcast episodes
      const { data: podcastData } = await supabase
        .from('podcast_episodes')
        .select('id, title, total_duration_seconds, created_at')
        .eq('status', 'ready')
        .order('created_at', { ascending: false });

      setAudios(audioData || []);
      setPodcasts(podcastData || []);
      setLoading(false);
    }
    fetchAudio();
  }, []);

  async function handlePlay(id, currentPlays) {
    await supabase
      .from('audio_library')
      .update({ plays: (currentPlays || 0) + 1 })
      .eq('id', id);
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gray-50">
        <section className="bg-brand-blue py-16 text-center text-white">
          <h1 className="text-4xl font-extrabold mb-3">🎵 Audio Library</h1>
          <p className="text-blue-100 text-lg">
            Listen to study guides, podcasts, motivational talks and exam tips
          </p>
        </section>

        <section className="max-w-4xl mx-auto px-4 py-12">
          {loading ? (
            <div className="text-center py-20">
              <p className="text-gray-500">Loading audio...</p>
            </div>
          ) : (audios.length === 0 && podcasts.length === 0) ? (
            <div className="text-center py-20">
              <p className="text-5xl mb-4">🎙️</p>
              <h2 className="text-2xl font-bold text-gray-700 mb-2">No audio yet</h2>
              <p className="text-gray-500">Audio lessons and podcasts are coming soon!</p>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {/* Manual Audio Uploads */}
              {audios.length > 0 && (
                <>
                  <h2 className="text-xl font-bold text-gray-700 border-b pb-2">📻 Manual Audio</h2>
                  {audios.map((audio) => (
                    <div key={audio.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h2 className="text-lg font-bold text-gray-800">{audio.title}</h2>
                          {audio.description && (
                            <p className="text-sm text-gray-500 mt-1">{audio.description}</p>
                          )}
                        </div>
                        <span className="text-xs text-gray-400 whitespace-nowrap ml-4">
                          🎧 {audio.plays || 0} plays
                        </span>
                      </div>
                      <audio
                        controls
                        className="w-full mt-2"
                        onPlay={() => handlePlay(audio.id, audio.plays)}
                      >
                        <source src={audio.audio_url} type="audio/mpeg" />
                        Your browser does not support the audio element.
                      </audio>
                      <div className="mt-4">
                        <MarkDoneButton activityType="audio" activityId={audio.id} points={10} label="🎵 Mark as Done" />
                      </div>
                    </div>
                  ))}
                </>
              )}

              {/* Podcast Episodes */}
              {podcasts.length > 0 && (
                <>
                  <h2 className="text-xl font-bold text-gray-700 border-b pb-2 mt-6">🎙️ Podcasts</h2>
                  {podcasts.map((podcast) => (
                    <div key={podcast.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                      <div className="flex items-start justify-between">
                        <div>
                          <h2 className="text-lg font-bold text-gray-800">{podcast.title}</h2>
                          <p className="text-sm text-gray-500 mt-1">
                            {Math.round(podcast.total_duration_seconds / 60)} min • {new Date(podcast.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <Link
                          href={`/podcast/${podcast.id}`}
                          className="bg-brand-yellow px-4 py-2 rounded-xl font-bold hover:opacity-90"
                        >
                          ▶️ Listen
                        </Link>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}s