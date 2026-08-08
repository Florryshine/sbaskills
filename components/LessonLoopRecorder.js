'use client';

// components/LessonLoopRecorder.js
//
// Renders one lesson_loop content_assets row's metadata.segments (each
// already carrying real narration MP3 + a background candidate, from
// lesson-loops/generate) into a single landscape (16:9) ~2-minute video:
// background switches per segment, a segment-type badge, a short
// on-screen keyword caption, a subtitle band of the full narration line
// (for muted/sound-off viewers — most social autoplay is muted), and a
// progress bar — entirely in the browser via <canvas> + Web Audio API +
// MediaRecorder. Segment-advance logic (play segment -> on 'ended' move to
// the next -> stop after the last) is the same technique as
// AudiogramRecorder; background layering (video/photo/gradient, Ken Burns
// zoom on photos) is the same technique as QuoteLoopRecorder, just
// switched per-segment instead of being static for the whole clip.
//
// Same realtime tradeoff as AudiogramRecorder: a 2-minute lesson takes 2
// real minutes to record, because this captures a live stream rather than
// rendering faster than realtime.

import { useRef, useState, useEffect, useCallback } from 'react';
import { createBrowserClient } from '@/lib/supabase';

const CANVAS_W = 1920;
const CANVAS_H = 1080; // 16:9 landscape — real YouTube upload, not Shorts/Reels
const BRAND_BLUE = '#1a73e8';
const BRAND_YELLOW = '#FFCC00';
const DARK = '#0f172a';
const BUCKET = 'lesson-loops'; // create this bucket in Supabase storage (public read, authenticated upload) before first use

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
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4;codecs=avc1,mp4a.40.2',
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ];
  for (const type of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) return type;
  }
  return '';
}

function extensionForMimeType(mimeType) {
  return (mimeType || '').includes('mp4') ? 'mp4' : 'webm';
}

/**
 * @param {Object} props
 * @param {Object} props.contentAsset - a content_assets row (id, title, metadata.segments[], metadata.totalDurationSeconds)
 * @param {(videoUrl: string) => void} [props.onSaved]
 */
export default function LessonLoopRecorder({ contentAsset, onSaved }) {
  const canvasRef = useRef(null);
  const audioRef = useRef(null);
  const audioCtxRef = useRef(null);
  const rafRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const elapsedBeforeCurrentRef = useRef(0);
  const bgVideoRefs = useRef([]);
  const bgImageRefs = useRef([]);
  const segmentStartRef = useRef(0); // performance.now() when the current segment's audio started

  const segments = contentAsset.metadata?.segments || [];
  const totalDuration =
    contentAsset.metadata?.totalDurationSeconds || segments.reduce((sum, s) => sum + (s.durationSeconds || 0), 0);

  const [index, setIndex] = useState(-1); // -1 = idle
  const [status, setStatus] = useState('idle');
  const [videoBlobUrl, setVideoBlobUrl] = useState(null);
  const [videoBlob, setVideoBlob] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [assetsReady, setAssetsReady] = useState(false);

  // Preload every segment's background up front (small counts — 5-8
  // items — so this is cheap) instead of loading lazily per-segment,
  // which would stall the recording mid-clip waiting on a network fetch.
  useEffect(() => {
    if (segments.length === 0) {
      setAssetsReady(true);
      return;
    }
    let pending = segments.length;
    const checkDone = () => {
      pending -= 1;
      if (pending <= 0) setAssetsReady(true);
    };

    segments.forEach((seg, i) => {
      const bg = seg.background;
      if (bg?.type === 'video') {
        const vid = document.createElement('video');
        vid.src = bg.url;
        vid.crossOrigin = 'anonymous';
        vid.muted = true;
        vid.loop = true;
        vid.playsInline = true;
        vid.oncanplaythrough = checkDone;
        vid.onerror = checkDone;
        vid.load();
        bgVideoRefs.current[i] = vid;
      } else if (bg?.type === 'photo') {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = checkDone;
        img.onerror = checkDone;
        img.src = bg.url;
        bgImageRefs.current[i] = img;
      } else {
        checkDone();
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = CANVAS_W, H = CANVAS_H;
    const current = index >= 0 ? segments[index] : null;
    const localElapsed = audioRef.current?.currentTime || 0;

    // ── Background — switches per segment. ──
    const bg = current?.background;
    const vid = index >= 0 ? bgVideoRefs.current[index] : null;
    const img = index >= 0 ? bgImageRefs.current[index] : null;

    if (bg?.type === 'video' && vid?.readyState >= 2) {
      const scale = Math.max(W / vid.videoWidth, H / vid.videoHeight);
      const dw = vid.videoWidth * scale, dh = vid.videoHeight * scale;
      ctx.drawImage(vid, (W - dw) / 2, (H - dh) / 2, dw, dh);
      ctx.fillStyle = 'rgba(15,23,42,0.3)';
      ctx.fillRect(0, 0, W, H);
    } else if (bg?.type === 'photo' && img?.complete && img.naturalWidth) {
      const segDuration = current?.durationSeconds || 1;
      const t = Math.min(1, localElapsed / segDuration);
      const zoom = 1 + 0.08 * t;
      const scale = Math.max(W / img.naturalWidth, H / img.naturalHeight) * zoom;
      const dw = img.naturalWidth * scale, dh = img.naturalHeight * scale;
      ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
      ctx.fillStyle = 'rgba(15,23,42,0.3)';
      ctx.fillRect(0, 0, W, H);
    } else {
      const elapsed = elapsedBeforeCurrentRef.current + localElapsed;
      const t = totalDuration > 0 ? elapsed / totalDuration : 0;
      const angle = t * Math.PI * 0.3;
      const gradient = ctx.createLinearGradient(
        W / 2 + Math.cos(angle) * W, H / 2 + Math.sin(angle) * H,
        W / 2 - Math.cos(angle) * W, H / 2 - Math.sin(angle) * H
      );
      gradient.addColorStop(0, DARK);
      gradient.addColorStop(1, BRAND_BLUE);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, W, H);
    }

    if (!current) return;

    // ── Segment-type badge, top-left. ──
    ctx.font = 'bold 30px Arial';
    const badgeText = current.label || current.type.toUpperCase();
    const badgePad = 20;
    const badgeW = ctx.measureText(badgeText).width + badgePad * 2;
    ctx.fillStyle = 'rgba(15,23,42,0.7)';
    ctx.fillRect(50, 46, badgeW, 56);
    ctx.fillStyle = BRAND_YELLOW;
    ctx.textBaseline = 'middle';
    ctx.fillText(badgeText, 50 + badgePad, 46 + 28);

    // Fade-in for the segment's own text (keyword + subtitle) over its
    // first 400ms so a segment switch reads as a clean cut, not a smear.
    const introT = Math.min(1, localElapsed / 0.4);
    const introEased = 1 - Math.pow(1 - introT, 3);

    // ── Big on-screen keyword/caption, lower-third. ──
    ctx.font = '800 64px Arial';
    const keywordLines = wrapText(ctx, current.onScreenText || '', W - 200).slice(0, 2);
    const keywordLineH = 76;
    const keywordTop = H * 0.68;

    const scrimTop = keywordTop - 60;
    const scrimBottom = H - 90;
    const scrim = ctx.createLinearGradient(0, scrimTop, 0, scrimBottom);
    scrim.addColorStop(0, 'rgba(15,23,42,0)');
    scrim.addColorStop(0.25, 'rgba(15,23,42,0.72)');
    scrim.addColorStop(1, 'rgba(15,23,42,0.82)');
    ctx.fillStyle = scrim;
    ctx.fillRect(0, scrimTop, W, scrimBottom - scrimTop);

    ctx.save();
    ctx.globalAlpha = introEased;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 10;
    keywordLines.forEach((line, i) => {
      ctx.fillText(line, 60, keywordTop + i * keywordLineH + (1 - introEased) * 14);
    });
    ctx.restore();

    // ── Subtitle band — full spoken line, smaller, for muted viewers. ──
    ctx.font = '500 30px Arial';
    const subtitleLines = wrapText(ctx, current.text || '', W - 200).slice(0, 2);
    const subtitleTop = keywordTop + keywordLines.length * keywordLineH + 20;
    ctx.save();
    ctx.globalAlpha = introEased * 0.92;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    subtitleLines.forEach((line, i) => {
      ctx.fillText(line, 60, subtitleTop + i * 38);
    });
    ctx.restore();

    // ── Brand mark + progress bar, bottom. ──
    ctx.font = 'bold 24px Arial';
    ctx.fillStyle = BRAND_YELLOW;
    ctx.fillText('SHINEY BRAIN ACADEMY', 60, H - 34);

    const elapsedTotal = elapsedBeforeCurrentRef.current + localElapsed;
    const pct = totalDuration > 0 ? Math.min(1, elapsedTotal / totalDuration) : 0;
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(60, H - 14, W - 120, 5);
    ctx.fillStyle = BRAND_YELLOW;
    ctx.fillRect(60, H - 14, (W - 120) * pct, 5);
  }, [index, segments, totalDuration]);

  useEffect(() => {
    function loop() {
      draw();
      rafRef.current = requestAnimationFrame(loop);
    }
    if (status === 'recording') {
      rafRef.current = requestAnimationFrame(loop);
    } else {
      draw();
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [status, draw]);

  // ── Segment advancing — same shape as AudiogramRecorder. ──
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || index < 0) return;

    const seg = segments[index];

    // Play/pause background videos so only the active one is decoding.
    bgVideoRefs.current.forEach((v, i) => {
      if (!v) return;
      if (i === index) {
        v.currentTime = 0;
        v.play().catch(() => {});
      } else {
        v.pause();
      }
    });

    const handleEnded = () => {
      elapsedBeforeCurrentRef.current += seg.durationSeconds || audio.duration || 0;
      if (index < segments.length - 1) {
        setIndex(index + 1);
      } else {
        finishRecording();
      }
    };

    if (!seg.audioUrl) {
      // No narration for this segment (TTS failed) — hold it on screen
      // for its estimated duration instead of skipping straight past a
      // silent gap, so the timing/visuals still make sense.
      const holdMs = (seg.durationSeconds || 2) * 1000;
      const t = setTimeout(handleEnded, holdMs);
      return () => clearTimeout(t);
    }

    audio.src = seg.audioUrl;
    audio.load();
    audio.play().catch((err) => {
      setStatus('error');
      setErrorMsg(`Playback failed: ${err.message}`);
    });

    audio.addEventListener('ended', handleEnded);
    return () => audio.removeEventListener('ended', handleEnded);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  const startRecording = async () => {
    setErrorMsg(null);
    setVideoBlobUrl(null);
    setVideoBlob(null);
    elapsedBeforeCurrentRef.current = 0;

    if (segments.length === 0) {
      setErrorMsg('This lesson has no segments yet — still generating, or generation failed.');
      return;
    }

    try {
      const AudioContextCls = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioContextCls();
      audioCtxRef.current = audioCtx;

      const source = audioCtx.createMediaElementSource(audioRef.current);
      const dest = audioCtx.createMediaStreamDestination();
      source.connect(dest);
      source.connect(audioCtx.destination); // so you can hear it while it records

      const canvasStream = canvasRef.current.captureStream(30);
      const combined = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...dest.stream.getAudioTracks(),
      ]);

      // ~600kbps video / 96kbps audio -- a 2-minute clip lands around
      // ~5.5MB, comfortably inside typical Supabase bucket size limits.
      const recorderOptions = { videoBitsPerSecond: 600_000, audioBitsPerSecond: 96_000 };
      const mimeType = pickMimeType();
      if (mimeType) recorderOptions.mimeType = mimeType;

      const recorder = new MediaRecorder(combined, recorderOptions);
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
    if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop();
    if (audioCtxRef.current) audioCtxRef.current.close().catch(() => {});
    bgVideoRefs.current.forEach((v) => v?.pause());
    setIndex(-1);
  }

  const cancelRecording = () => {
    if (recorderRef.current) recorderRef.current.onstop = null;
    if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop();
    if (audioRef.current) audioRef.current.pause();
    if (audioCtxRef.current) audioCtxRef.current.close().catch(() => {});
    bgVideoRefs.current.forEach((v) => v?.pause());
    setIndex(-1);
    setStatus('idle');
  };

  const saveToContentAsset = async () => {
    if (!videoBlob) return;
    setStatus('uploading');
    setErrorMsg(null);
    try {
      const supabase = createBrowserClient();
      const ext = extensionForMimeType(videoBlob.type);
      const path = `${contentAsset.id}/video/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, videoBlob, { contentType: videoBlob.type || 'video/webm', upsert: true });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);

      const res = await fetch('/api/admin/lesson-loops/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentAssetId: contentAsset.id,
          videoUrl: urlData.publicUrl,
          durationSeconds: Math.round(totalDuration),
        }),
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
        width={CANVAS_W}
        height={CANVAS_H}
        className="w-full max-w-2xl aspect-video mx-auto rounded-2xl border shadow-sm bg-black"
      />
      <audio ref={audioRef} crossOrigin="anonymous" className="hidden" />

      <p className="text-xs text-gray-500 text-center">
        Landscape, {segments.length} segments, ~{Math.round(totalDuration)}s total. Recording plays in realtime — keep
        this tab open and active while it runs (about {Math.max(1, Math.round(totalDuration / 60))} minute
        {totalDuration >= 90 ? 's' : ''}).
      </p>

      {errorMsg && <p className="text-sm text-red-600 text-center">⚠️ {errorMsg}</p>}
      {!assetsReady && status === 'idle' && (
        <p className="text-xs text-gray-400 text-center">Loading backgrounds…</p>
      )}

      <div className="flex justify-center gap-2">
        {status === 'idle' && (
          <button
            onClick={startRecording}
            disabled={!assetsReady || segments.length === 0}
            className="bg-brand-blue text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:opacity-90 disabled:opacity-50"
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
              download={`${(contentAsset.title || 'lesson-loop').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.${extensionForMimeType(videoBlob?.type)}`}
              className="bg-gray-100 text-gray-700 px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-gray-200"
            >
              ⬇ Download
            </a>
            {status === 'finished' ? (
              <button
                onClick={saveToContentAsset}
                className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:opacity-90"
              >
                💾 Save
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
