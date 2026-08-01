'use client';

// components/AudiogramRecorder.js
//
// Renders a podcast episode's already-generated segment MP3s into a single
// square video: brand-gradient background + a live frequency-bar waveform
// + burned-in captions (the segment text your podcast pipeline already
// stores) — entirely in the browser via <canvas> + Web Audio API +
// MediaRecorder. No Remotion, no headless Chromium, no server rendering,
// no local worker. Vercel does nothing here except serve this page and the
// one API call that saves the resulting URL — the actual "rendering" work
// runs on the admin's machine in real time while the episode plays.
//
// Tradeoff worth knowing: because this captures a live canvas+audio stream,
// recording takes exactly as long as the episode itself (a 5-minute episode
// takes 5 real minutes to record) — there's no way to render faster than
// realtime with this approach. That's the price of avoiding Remotion/FFmpeg
// entirely; for a first version this is a fair trade.

import { useRef, useState, useEffect, useCallback } from 'react';
import { createBrowserClient } from '@/lib/supabase';

const CANVAS_SIZE = 1080;
const BRAND_BLUE = '#1a73e8';
const BRAND_YELLOW = '#FFCC00';
const DARK = '#0f172a';
const BUCKET = 'lesson-videos'; // already public + authenticated-upload; reused instead of a new bucket

function wrapText(ctx, text, maxWidth) {
  const words = String(text || '').split(' ');
  const lines = [];
  let current = '';
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function pickMimeType() {
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ];
  for (const type of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) return type;
  }
  return '';
}

/**
 * @param {Object} props
 * @param {Object} props.episode - a podcast_episodes row (id, title, episode_number, total_duration_seconds)
 * @param {Array}  props.segments - podcast_segments rows, ordered by position, each with { text, audio_url, duration_seconds }
 * @param {(videoUrl: string) => void} [props.onSaved]
 */
export default function AudiogramRecorder({ episode, segments, onSaved }) {
  const canvasRef = useRef(null);
  const audioRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const rafRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const elapsedBeforeCurrentRef = useRef(0);

  const [index, setIndex] = useState(-1); // -1 = idle
  const [status, setStatus] = useState('idle'); // idle | recording | finished | uploading | saved | error
  const [videoBlobUrl, setVideoBlobUrl] = useState(null);
  const [videoBlob, setVideoBlob] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  const totalDuration =
    episode.total_duration_seconds || segments.reduce((sum, s) => sum + (s.duration_seconds || 0), 0);

  // ── Drawing ────────────────────────────────────────────────────────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = CANVAS_SIZE, H = CANVAS_SIZE;

    // Background gradient — same brand palette as the rest of the platform
    const gradient = ctx.createLinearGradient(0, 0, W * 0.3, H);
    gradient.addColorStop(0, DARK);
    gradient.addColorStop(1, BRAND_BLUE);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);

    // Top label + title
    ctx.textBaseline = 'top';
    ctx.fillStyle = BRAND_YELLOW;
    ctx.font = 'bold 28px Arial';
    ctx.fillText('🎙 SHINEY BRAIN ACADEMY', 60, 70);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 52px Arial';
    const titleLines = wrapText(ctx, episode.title || 'Podcast Episode', W - 120).slice(0, 3);
    titleLines.forEach((line, i) => ctx.fillText(line, 60, 130 + i * 62));

    // Waveform — live frequency bars from the analyser, or a flat idle line
    const analyser = analyserRef.current;
    const barCount = 48;
    const barAreaW = W - 160;
    const barW = barAreaW / barCount - 6;
    const centerY = H * 0.58;
    const maxBarH = 220;

    let freqData = null;
    if (analyser) {
      freqData = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(freqData);
    }

    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    for (let i = 0; i < barCount; i++) {
      const sampleIndex = Math.floor((i / barCount) * (freqData ? freqData.length * 0.6 : 0));
      const value = freqData ? freqData[sampleIndex] / 255 : 0.06;
      const barH = Math.max(6, value * maxBarH);
      const x = 80 + i * (barW + 6);
      ctx.fillRect(x, centerY - barH / 2, barW, barH);
    }

    // Caption — current segment's line, if any
    const current = index >= 0 ? segments[index] : null;
    if (current) {
      const capY = H * 0.74;
      const capH = 190;
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(0, capY, W, capH);

      ctx.fillStyle = '#ffffff';
      ctx.font = '600 34px Arial';
      const capLines = wrapText(ctx, current.text || '', W - 120).slice(0, 4);
      capLines.forEach((line, i) => ctx.fillText(line, 60, capY + 24 + i * 42));
    }

    // Progress bar
    const elapsed = elapsedBeforeCurrentRef.current + (audioRef.current?.currentTime || 0);
    const pct = totalDuration > 0 ? Math.min(1, elapsed / totalDuration) : 0;
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(60, H - 40, W - 120, 6);
    ctx.fillStyle = BRAND_YELLOW;
    ctx.fillRect(60, H - 40, (W - 120) * pct, 6);
  }, [index, segments, episode.title, totalDuration]);

  useEffect(() => {
    function loop() {
      draw();
      rafRef.current = requestAnimationFrame(loop);
    }
    if (status === 'recording') {
      rafRef.current = requestAnimationFrame(loop);
    } else {
      draw(); // draw one static idle/finished frame
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [status, draw]);

  // ── Segment advancing ────────────────────────────────────────────────
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || index < 0) return;

    const handleEnded = () => {
      elapsedBeforeCurrentRef.current += segments[index].duration_seconds || 0;
      if (index < segments.length - 1) {
        setIndex(index + 1);
      } else {
        finishRecording();
      }
    };

    audio.src = segments[index].audio_url;
    audio.load();
    audio
      .play()
      .catch((err) => {
        setStatus('error');
        setErrorMsg(`Playback failed: ${err.message}`);
      });

    audio.addEventListener('ended', handleEnded);
    return () => audio.removeEventListener('ended', handleEnded);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  // ── Start / stop ─────────────────────────────────────────────────────
  const startRecording = async () => {
    setErrorMsg(null);
    setVideoBlobUrl(null);
    setVideoBlob(null);
    elapsedBeforeCurrentRef.current = 0;

    if (!segments.length) {
      setErrorMsg('This episode has no playable segments.');
      return;
    }

    try {
      const AudioContextCls = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioContextCls();
      audioCtxRef.current = audioCtx;

      const source = audioCtx.createMediaElementSource(audioRef.current);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      const dest = audioCtx.createMediaStreamDestination();

      source.connect(analyser);
      analyser.connect(dest);
      source.connect(audioCtx.destination); // so you can hear it while it records
      analyserRef.current = analyser;

      const canvasStream = canvasRef.current.captureStream(30);
      const combined = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...dest.stream.getAudioTracks(),
      ]);

      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(combined, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType || 'video/webm' });
        setVideoBlob(blob);
        setVideoBlobUrl(URL.createObjectURL(blob));
        setStatus('finished');
      };
      recorderRef.current = recorder;

      recorder.start();
      setStatus('recording');
      setIndex(0);
    } catch (err) {
      setStatus('error');
      setErrorMsg(`Could not start recording: ${err.message}`);
    }
  };

  function finishRecording() {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
    }
    setIndex(-1);
  }

  const cancelRecording = () => {
    if (recorderRef.current) recorderRef.current.onstop = null; // discard, don't produce a blob
    if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop();
    if (audioRef.current) audioRef.current.pause();
    if (audioCtxRef.current) audioCtxRef.current.close().catch(() => {});
    setIndex(-1);
    setStatus('idle');
  };

  // ── Save: upload blob to storage, then tell the server to record it ──
  const saveToEpisode = async () => {
    if (!videoBlob) return;
    setStatus('uploading');
    setErrorMsg(null);
    try {
      const supabase = createBrowserClient();
      const path = `audiograms/${episode.id}/${Date.now()}.webm`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, videoBlob, { contentType: videoBlob.type || 'video/webm', upsert: true });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);

      const res = await fetch(`/api/admin/podcasts/${episode.id}/audiogram`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoUrl: urlData.publicUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');

      setStatus('saved');
      onSaved?.(urlData.publicUrl);
    } catch (err) {
      setStatus('finished');
      setErrorMsg(err.message);
    }
  };

  return (
    <div className="space-y-4">
      <canvas
        ref={canvasRef}
        width={CANVAS_SIZE}
        height={CANVAS_SIZE}
        className="w-full max-w-md mx-auto rounded-2xl border shadow-sm bg-black"
      />
      {/* Hidden — this is the actual audio source the Web Audio graph and
          recorder pull from; it isn't meant to be seen, just heard/analyzed. */}
      <audio ref={audioRef} crossOrigin="anonymous" className="hidden" />

      <p className="text-xs text-gray-500 text-center">
        Recording plays in realtime — a {Math.round(totalDuration / 60)}-minute episode takes about{' '}
        {Math.round(totalDuration / 60)} minute(s) to record. Keep this tab open and active while it runs.
      </p>

      {errorMsg && <p className="text-sm text-red-600 text-center">⚠️ {errorMsg}</p>}

      <div className="flex justify-center gap-2">
        {status === 'idle' && (
          <button
            onClick={startRecording}
            className="bg-brand-blue text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:opacity-90"
          >
            🔴 Start Recording
          </button>
        )}
        {status === 'recording' && (
          <button
            onClick={cancelRecording}
            className="bg-red-100 text-red-600 px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-red-200"
          >
            ⏹ Cancel
          </button>
        )}
        {(status === 'finished' || status === 'saved') && videoBlobUrl && (
          <>
            <a
              href={videoBlobUrl}
              download={`${(episode.title || 'audiogram').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.webm`}
              className="bg-gray-100 text-gray-700 px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-gray-200"
            >
              ⬇ Download
            </a>
            {status === 'finished' ? (
              <button
                onClick={saveToEpisode}
                className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:opacity-90"
              >
                💾 Save to Episode
              </button>
            ) : (
              <span className="text-sm font-bold text-emerald-600 px-3 py-2.5">✓ Saved</span>
            )}
          </>
        )}
        {status === 'uploading' && (
          <span className="text-sm font-bold text-gray-500 px-3 py-2.5">Uploading…</span>
        )}
      </div>
    </div>
  );
}
