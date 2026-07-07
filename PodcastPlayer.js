'use client';

import { useEffect, useRef, useState } from 'react';

const SPEAKER_LABEL = { host_a: '🎓 Teacher', host_b: '📝 Examiner' };
const SPEAKER_COLOR = { host_a: 'bg-brand-blue text-white', host_b: 'bg-brand-yellow text-gray-900' };

/**
 * Plays an array of audio segments back-to-back (no server-side stitching
 * needed) and highlights the currently-playing line in the transcript.
 *
 * segments: [{ position, speaker, text, audio_url, duration_seconds }]
 */
export default function PodcastPlayer({ segments = [], title }) {
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef(null);
  const transcriptRef = useRef(null);

  const playable = segments.filter((s) => s.audio_url);

  useEffect(() => {
    if (currentIndex < 0 || !audioRef.current) return;
    const el = document.getElementById(`podcast-line-${currentIndex}`);
    if (el && transcriptRef.current) {
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [currentIndex]);

  function handlePlayPause() {
    if (playable.length === 0) return;
    if (currentIndex === -1) {
      setCurrentIndex(0);
      setIsPlaying(true);
      return;
    }
    if (isPlaying) {
      audioRef.current?.pause();
      setIsPlaying(false);
    } else {
      audioRef.current?.play();
      setIsPlaying(true);
    }
  }

  function handleEnded() {
    if (currentIndex < playable.length - 1) {
      setCurrentIndex((i) => i + 1);
    } else {
      setIsPlaying(false);
      setCurrentIndex(-1);
    }
  }

  function jumpTo(index) {
    setCurrentIndex(index);
    setIsPlaying(true);
  }

  useEffect(() => {
    if (currentIndex >= 0 && isPlaying && audioRef.current) {
      audioRef.current.play().catch(() => {});
    }
  }, [currentIndex, isPlaying]);

  if (playable.length === 0) return null;

  const current = currentIndex >= 0 ? playable[currentIndex] : null;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 my-8">
      <h3 className="text-lg font-bold text-gray-800 mb-1">🎧 Listen to this lesson</h3>
      {title && <p className="text-sm text-gray-500 mb-4">{title}</p>}

      {/* Hidden audio element driving playback of the current segment */}
      {current && (
        <audio
          ref={audioRef}
          src={current.audio_url}
          autoPlay={isPlaying}
          onEnded={handleEnded}
          onPause={() => setIsPlaying(false)}
          onPlay={() => setIsPlaying(true)}
          className="hidden"
        />
      )}

      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={handlePlayPause}
          className="w-12 h-12 rounded-full bg-brand-blue text-white flex items-center justify-center text-xl shrink-0"
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? '⏸' : '▶'}
        </button>
        <div className="text-sm text-gray-500">
          {currentIndex >= 0 ? (
            <>
              Line {currentIndex + 1} of {playable.length} — {SPEAKER_LABEL[current.speaker]}
            </>
          ) : (
            `${playable.length} lines · ~${Math.round(
              playable.reduce((sum, s) => sum + (s.duration_seconds || 0), 0) / 60
            )} min`
          )}
        </div>
      </div>

      {/* Transcript with live-highlighted current line ("Study Mode" foundation) */}
      <div ref={transcriptRef} className="max-h-80 overflow-y-auto space-y-2 border-t pt-4">
        {playable.map((seg, i) => (
          <button
            key={seg.position}
            id={`podcast-line-${i}`}
            onClick={() => jumpTo(i)}
            className={`w-full text-left p-3 rounded-lg transition-colors ${
              i === currentIndex ? 'bg-brand-blue/10 border border-brand-blue' : 'hover:bg-gray-50'
            }`}
          >
            <span
              className={`inline-block text-xs font-semibold px-2 py-0.5 rounded mb-1 ${SPEAKER_COLOR[seg.speaker]}`}
            >
              {SPEAKER_LABEL[seg.speaker]}
            </span>
            <p className="text-sm text-gray-700">{seg.text}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
