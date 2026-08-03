'use client';

// components/QuoteLoopRecorder.js
//
// Renders one quote_loop content_assets row (a short punchy line + a
// background candidate fetched by /api/admin/quote-loops/generate) into a
// short, loopable square video: real stock footage or a photo with a slow
// Ken Burns zoom (or an animated brand gradient if no background was
// found) + the quote fading/scaling in + a random background music track
// — entirely in the browser via <canvas> + Web Audio API + MediaRecorder.
// Same technique as AudiogramRecorder.js, just a fixed ~3-5s clip instead
// of a full podcast episode, which is why this one doesn't need to run in
// realtime for minutes at a time.

import { useRef, useState, useEffect, useCallback } from 'react';
import { createBrowserClient } from '@/lib/supabase';

const CANVAS_SIZE = 1080;
const BRAND_BLUE = '#1a73e8';
const BRAND_YELLOW = '#FFCC00';
const DARK = '#0f172a';
const BUCKET = 'quote-loops'; // create this bucket in Supabase storage (public read, authenticated upload) before first use — see admin page note
const RECORD_SECONDS = 4; // "not more than 3 seconds" target with a little headroom; adjust freely

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
  const candidates = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  for (const type of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) return type;
  }
  return '';
}

/**
 * @param {Object} props
 * @param {Object} props.contentAsset - a content_assets row (id, title, body, metadata.background)
 * @param {(videoUrl: string) => void} [props.onSaved]
 */
export default function QuoteLoopRecorder({ contentAsset, onSaved }) {
  const canvasRef = useRef(null);
  const bgVideoRef = useRef(null); // hidden <video> for stock-footage backgrounds
  const bgImageRef = useRef(null); // loaded <img> for photo backgrounds
  const audioRef = useRef(null);
  const audioCtxRef = useRef(null);
  const rafRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const startTimeRef = useRef(0);
  const stopTimerRef = useRef(null);

  const [status, setStatus] = useState('idle'); // idle | loading-bg | recording | finished | uploading | saved | error
  const [videoBlobUrl, setVideoBlobUrl] = useState(null);
  const [videoBlob, setVideoBlob] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [bgReady, setBgReady] = useState(false);

  const background = contentAsset.metadata?.background || null;
  const quote = contentAsset.body || '';

  // ── Discover music tracks + preload background on mount ────────────────
  useEffect(() => {
    fetch('/api/admin/quote-loops/audio-list')
      .then((r) => r.json())
      .then((d) => setTracks(d.tracks || []))
      .catch(() => setTracks([]));

    if (background?.type === 'photo') {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => setBgReady(true);
      img.onerror = () => setBgReady(true); // fall through to gradient below rather than block forever
      img.src = background.url;
      bgImageRef.current = img;
    } else if (background?.type === 'video') {
      const vid = bgVideoRef.current;
      if (vid) {
        vid.src = background.url;
        vid.crossOrigin = 'anonymous';
        vid.muted = true;
        vid.loop = true;
        vid.oncanplaythrough = () => setBgReady(true);
        vid.onerror = () => setBgReady(true);
        vid.load();
      }
    } else {
      setBgReady(true); // gradient-only background, nothing to preload
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Drawing ─────────────────────────────────────────────────────────────
  const draw = useCallback(
    (elapsedMs) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const W = CANVAS_SIZE, H = CANVAS_SIZE;
      const t = Math.min(1, elapsedMs / (RECORD_SECONDS * 1000)); // 0→1 over the clip

      // Background layer
      if (background?.type === 'video' && bgVideoRef.current?.readyState >= 2) {
        const vid = bgVideoRef.current;
        // Cover-fit crop, matching object-fit:cover behavior for whatever
        // aspect ratio the stock clip came in at.
        const scale = Math.max(W / vid.videoWidth, H / vid.videoHeight);
        const dw = vid.videoWidth * scale, dh = vid.videoHeight * scale;
        ctx.drawImage(vid, (W - dw) / 2, (H - dh) / 2, dw, dh);
        ctx.fillStyle = 'rgba(15,23,42,0.35)'; // darken so white text stays readable over any footage
        ctx.fillRect(0, 0, W, H);
      } else if (background?.type === 'photo' && bgImageRef.current?.complete && bgImageRef.current.naturalWidth) {
        const img = bgImageRef.current;
        // Slow Ken Burns zoom: 1.0 -> 1.12 scale over the clip.
        const zoom = 1 + 0.12 * t;
        const scale = Math.max(W / img.naturalWidth, H / img.naturalHeight) * zoom;
        const dw = img.naturalWidth * scale, dh = img.naturalHeight * scale;
        ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
        ctx.fillStyle = 'rgba(15,23,42,0.35)';
        ctx.fillRect(0, 0, W, H);
      } else {
        // No background candidate — animated brand gradient, still on-brand.
        const angle = t * Math.PI * 0.4;
        const gradient = ctx.createLinearGradient(
          W / 2 + Math.cos(angle) * W,
          H / 2 + Math.sin(angle) * H,
          W / 2 - Math.cos(angle) * W,
          H / 2 - Math.sin(angle) * H
        );
        gradient.addColorStop(0, DARK);
        gradient.addColorStop(1, BRAND_BLUE);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, W, H);
      }

      // Quote text — scales/fades in over the first 0.6s, then holds.
      const introT = Math.min(1, elapsedMs / 600);
      const eased = 1 - Math.pow(1 - introT, 3); // ease-out cubic
      const fontScale = 0.85 + 0.15 * eased;
      const alpha = eased;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `800 ${Math.round(64 * fontScale)}px Arial`;
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 12;
      const lines = wrapText(ctx, quote, W - 140).slice(0, 5);
      const lineHeight = 76;
      const totalH = lines.length * lineHeight;
      lines.forEach((line, i) => {
        ctx.fillText(line, W / 2, H / 2 - totalH / 2 + lineHeight / 2 + i * lineHeight);
      });
      ctx.restore();

      // Small brand mark, bottom
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = BRAND_YELLOW;
      ctx.font = 'bold 26px Arial';
      ctx.fillText('SHINEY BRAIN ACADEMY', 50, H - 50);
    },
    [background, quote]
  );

  useEffect(() => {
    function loop() {
      const elapsed = status === 'recording' ? performance.now() - startTimeRef.current : 0;
      draw(elapsed);
      rafRef.current = requestAnimationFrame(loop);
    }
    if (status === 'recording') {
      rafRef.current = requestAnimationFrame(loop);
    } else {
      draw(600); // draw one static, fully-faded-in idle frame
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [status, draw]);

  // ── Start / stop ─────────────────────────────────────────────────────
  const startRecording = async () => {
    setErrorMsg(null);
    setVideoBlobUrl(null);
    setVideoBlob(null);

    try {
      const AudioContextCls = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioContextCls();
      audioCtxRef.current = audioCtx;

      const dest = audioCtx.createMediaStreamDestination();

      if (tracks.length > 0 && audioRef.current) {
        const track = tracks[Math.floor(Math.random() * tracks.length)];
        audioRef.current.src = track;
        audioRef.current.loop = true;
        // Start at a random offset so the same track doesn't always open
        // on its intro across many clips — actual trim-to-length happens
        // naturally since we only record RECORD_SECONDS of it.
        audioRef.current.currentTime = 0;
        await audioRef.current.play().catch(() => {}); // best-effort — a clip with no audio still records fine
        const source = audioCtx.createMediaElementSource(audioRef.current);
        source.connect(dest);
        source.connect(audioCtx.destination); // so you can hear it while it records
      }

      if (background?.type === 'video' && bgVideoRef.current) {
        bgVideoRef.current.currentTime = 0;
        bgVideoRef.current.play().catch(() => {});
      }

      const canvasStream = canvasRef.current.captureStream(30);
      const combined = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...dest.stream.getAudioTracks(),
      ]);

      // Bitrate target: comfortably under 1MB for a 4-5s clip.
      // 700kbps video + 64kbps audio * 4s / 8 ≈ 380KB.
      const recorderOptions = { videoBitsPerSecond: 700_000, audioBitsPerSecond: 64_000 };
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

      startTimeRef.current = performance.now();
      recorder.start();
      setStatus('recording');

      stopTimerRef.current = setTimeout(finishRecording, RECORD_SECONDS * 1000);
    } catch (err) {
      setStatus('error');
      setErrorMsg(`Could not start recording: ${err.message}`);
    }
  };

  function finishRecording() {
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop();
    if (audioRef.current) audioRef.current.pause();
    if (bgVideoRef.current) bgVideoRef.current.pause();
    if (audioCtxRef.current) audioCtxRef.current.close().catch(() => {});
  }

  const cancelRecording = () => {
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    if (recorderRef.current) recorderRef.current.onstop = null; // discard, don't produce a blob
    if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop();
    if (audioRef.current) audioRef.current.pause();
    if (bgVideoRef.current) bgVideoRef.current.pause();
    if (audioCtxRef.current) audioCtxRef.current.close().catch(() => {});
    setStatus('idle');
  };

  // ── Save: upload blob to storage, then tell the server to record it ──
  const saveToContentAsset = async () => {
    if (!videoBlob) return;
    setStatus('uploading');
    setErrorMsg(null);
    try {
      const supabase = createBrowserClient();
      const path = `${contentAsset.id}/${Date.now()}.webm`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, videoBlob, { contentType: videoBlob.type || 'video/webm', upsert: true });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);

      const res = await fetch('/api/admin/quote-loops/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentAssetId: contentAsset.id,
          videoUrl: urlData.publicUrl,
          durationSeconds: RECORD_SECONDS,
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
        width={CANVAS_SIZE}
        height={CANVAS_SIZE}
        className="w-full max-w-md mx-auto rounded-2xl border shadow-sm bg-black"
      />
      {/* Hidden — real sources the recorder draws/plays from, not meant to be seen directly. */}
      <video ref={bgVideoRef} muted playsInline className="hidden" />
      <audio ref={audioRef} crossOrigin="anonymous" className="hidden" />

      <p className="text-xs text-gray-500 text-center">
        {background?.type === 'video' && `Real footage background (${background.source}).`}
        {background?.type === 'photo' && `Photo background with zoom (${background.source}).`}
        {!background && 'No background candidate found — recording on an animated brand gradient.'}
        {' '}Records a {RECORD_SECONDS}s loop{tracks.length === 0 ? ' — no music tracks found in public/audio/quote-loops yet, clip will be silent' : ''}.
      </p>

      {errorMsg && <p className="text-sm text-red-600 text-center">⚠️ {errorMsg}</p>}
      {!bgReady && status === 'idle' && (
        <p className="text-xs text-gray-400 text-center">Loading background…</p>
      )}

      <div className="flex justify-center gap-2">
        {status === 'idle' && (
          <button
            onClick={startRecording}
            disabled={!bgReady}
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
              download={`${(contentAsset.title || 'quote-loop').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.webm`}
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
