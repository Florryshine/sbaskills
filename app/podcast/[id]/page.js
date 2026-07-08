'use client';

import { useState, useEffect, useRef } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import { useParams } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export default function PodcastPlayer() {
  const params = useParams();
  const id = params.id;
  const supabase = createBrowserClient();

  const [episode, setEpisode] = useState(null);
  const [segments, setSegments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef(null);

  useEffect(() => {
    async function loadEpisode() {
      setLoading(true);
      const { data: ep, error: epError } = await supabase
        .from('podcast_episodes')
        .select('*')
        .eq('id', id)
        .eq('status', 'ready')
        .single();

      if (epError || !ep) {
        setError('Episode not found or not published.');
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

      const validSegments = segs.filter(s => s.audio_url);
      if (validSegments.length === 0) {
        setError('This episode has no audio segments available.');
        setLoading(false);
        return;
      }

      setEpisode(ep);
      setSegments(validSegments);
      setLoading(false);
    }
    loadEpisode();
  }, [id]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleEnded = () => {
      if (currentIndex < segments.length - 1) {
        setCurrentIndex(currentIndex + 1);
      } else {
        setIsPlaying(false);
      }
    };

    audio.addEventListener('ended', handleEnded);
    return () => audio.removeEventListener('ended', handleEnded);
  }, [currentIndex, segments.length]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, [currentIndex, isPlaying]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || segments.length === 0) return;
    audio.src = segments[currentIndex]?.audio_url || '';
    if (isPlaying) {
      audio.play().catch(() => {});
    }
  }, [currentIndex, segments]);

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="p-8 text-center">Loading episode...</div>
        <Footer />
      </>
    );
  }

  if (error) {
    return (
      <>
        <Navbar />
        <div className="p-8 text-center text-red-600">{error}</div>
        <Footer />
      </>
    );
  }

  const handlePlayPause = () => setIsPlaying(!isPlaying);

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setIsPlaying(false);
      setCurrentIndex(currentIndex - 1);
      setTimeout(() => setIsPlaying(true), 100);
    }
  };

  const handleNext = () => {
    if (currentIndex < segments.length - 1) {
      setIsPlaying(false);
      setCurrentIndex(currentIndex + 1);
      setTimeout(() => setIsPlaying(true), 100);
    }
  };

  const progress = segments.length > 0 ? ((currentIndex + 1) / segments.length) * 100 : 0;

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-2xl mx-auto px-4">
          <div className="bg-white rounded-2xl shadow-lg border p-6">
            <h1 className="text-2xl font-bold text-brand-blue mb-2">{episode.title}</h1>
            <p className="text-sm text-gray-500 mb-4">
              {Math.round(episode.total_duration_seconds / 60)} min • {segments.length} segments
            </p>

            <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
              <div
                className="bg-brand-yellow h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>

            <audio ref={audioRef} className="hidden" />

            <div className="flex items-center justify-center gap-6">
              <button
                onClick={handlePrevious}
                disabled={currentIndex === 0}
                className="text-2xl text-gray-600 hover:text-brand-blue disabled:opacity-30"
              >
                ⏮️
              </button>
              <button
                onClick={handlePlayPause}
                className="text-5xl text-brand-blue hover:scale-110 transition"
              >
                {isPlaying ? '⏸️' : '▶️'}
              </button>
              <button
                onClick={handleNext}
                disabled={currentIndex === segments.length - 1}
                className="text-2xl text-gray-600 hover:text-brand-blue disabled:opacity-30"
              >
                ⏭️
              </button>
            </div>

            <p className="text-center text-sm text-gray-500 mt-4">
              Segment {currentIndex + 1} of {segments.length}
            </p>

            <div className="mt-6 p-4 bg-gray-50 rounded-xl max-h-40 overflow-y-auto">
              <p className="text-sm text-gray-700">
                {segments[currentIndex]?.text || ''}
              </p>
              {segments[currentIndex]?.speaker && (
                <p className="text-xs text-gray-400 mt-1">— {segments[currentIndex].speaker}</p>
              )}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}