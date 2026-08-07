'use client';

// components/MemeLoopRecorder.js
//
// Renders one meme_loop content_assets row (setup + punchline + laugh
// emoji + a background candidate fetched by
// /api/admin/meme-loops/generate) into a short, loopable 9:16 video:
// setup text holds, a beat of anticipation dots, then the punchline
// reveals with a burst of rising/rotating laugh emoji timed to a laugh
// track — entirely in the browser via <canvas> + Web Audio API +
// MediaRecorder. Same technique as QuoteLoopRecorder, just a different
// reveal choreography (comedic setup->punchline timing instead of
// headline->paragraph) and a laugh track instead of instrumental music.

import { useRef, useState, useEffect, useCallback } from 'react';
import { createBrowserClient } from '@/lib/supabase';

const CANVAS_W = 1080;
const CANVAS_H = 1920; // 9:16 — TikTok / IG Reels / YouTube Shorts
const BRAND_BLUE = '#1a73e8';
const BRAND_YELLOW = '#FFCC00';
const DARK = '#0f172a';
const BUCKET = 'meme-loops'; // create this bucket in Supabase storage (public read, authenticated upload) before first use — same policy shape as quote-loops
const RECORD_SECONDS = 8; // setup hold + beat + punchline reveal + emoji burst all need room to land
const PUNCHLINE_AT_MS = 3000; // when the punchline (and the laugh track) fires

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

// Fixed pseudo-random burst layout so the emoji don't reshuffle every
// animation frame — seeded off index, not Math.random(), so draw() stays
// a pure function of elapsedMs (needed since it also gets called with a
// static timestamp for the idle preview frame).
function buildEmojiBurst(emojis, count = 10) {
  const burst = [];
  for (let i = 0; i < count; i++) {
    const emoji = emojis[i % emojis.length];
    // Deterministic spread across the width, small per-item jitter.
    const seed = i * 137.5; // golden-angle-ish spacing for a natural scatter
    burst.push({
      emoji,
      xFrac: 0.12 + (((seed * 1.7) % 100) / 100) * 0.76, // 0.12–0.88 across width
      delayMs: (i % 5) * 140, // staggered start
      driftX: ((i % 3) - 1) * 30, // slight left/right drift per item
      rotate: ((i % 4) - 1.5) * 18, // slight rotation variety
      size: 54 + (i % 3) * 14,
    });
  }
  return burst;
}

/**
 * @param {Object} props
 * @param {Object} props.contentAsset - a content_assets row (id, title, body=setup, metadata.punchline, metadata.emojis, metadata.background)
 * @param {(videoUrl: string) => void} [props.onSaved]
 */
export default function MemeLoopRecorder({ contentAsset, onSaved }) {
  const canvasRef = useRef(null);
  const bgVideoRef = useRef(null);
  const bgImageRef = useRef(null);
  const audioRef = useRef(null);
  const audioCtxRef = useRef(null);
  const rafRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const startTimeRef = useRef(0);
  const stopTimerRef = useRef(null);
  const laughTimerRef = useRef(null);

  const [status, setStatus] = useState('idle');
  const [videoBlobUrl, setVideoBlobUrl] = useState(null);
  const [videoBlob, setVideoBlob] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [bgReady, setBgReady] = useState(false);

  const background = contentAsset.metadata?.background || null;
  const setup = contentAsset.body || '';
  const punchline = contentAsset.metadata?.punchline || '';
  const emojis = contentAsset.metadata?.emojis?.length ? contentAsset.metadata.emojis : ['😂', '🤣'];
  const burstRef = useRef(buildEmojiBurst(emojis));

  useEffect(() => {
    fetch('/api/admin/meme-loops/audio-list')
      .then((r) => r.json())
      .then((d) => setTracks(d.tracks || []))
      .catch(() => setTracks([]));

    if (background?.type === 'photo') {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => setBgReady(true);
      img.onerror = () => setBgReady(true);
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
      setBgReady(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const draw = useCallback(
    (elapsedMs) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const W = CANVAS_W, H = CANVAS_H;

      // Background layer — identical to QuoteLoopRecorder.
      if (background?.type === 'video' && bgVideoRef.current?.readyState >= 2) {
        const vid = bgVideoRef.current;
        const scale = Math.max(W / vid.videoWidth, H / vid.videoHeight);
        const dw = vid.videoWidth * scale, dh = vid.videoHeight * scale;
        ctx.drawImage(vid, (W - dw) / 2, (H - dh) / 2, dw, dh);
        ctx.fillStyle = 'rgba(15,23,42,0.35)';
        ctx.fillRect(0, 0, W, H);
      } else if (background?.type === 'photo' && bgImageRef.current?.complete && bgImageRef.current.naturalWidth) {
        const img = bgImageRef.current;
        const t = Math.min(1, elapsedMs / (RECORD_SECONDS * 1000));
        const zoom = 1 + 0.12 * t;
        const scale = Math.max(W / img.naturalWidth, H / img.naturalHeight) * zoom;
        const dw = img.naturalWidth * scale, dh = img.naturalHeight * scale;
        ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
        ctx.fillStyle = 'rgba(15,23,42,0.35)';
        ctx.fillRect(0, 0, W, H);
      } else {
        const t = Math.min(1, elapsedMs / (RECORD_SECONDS * 1000));
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

      // ── Setup text — fades/scales in immediately, holds throughout. ──
      const setupIntroT = Math.min(1, elapsedMs / 500);
      const setupEased = 1 - Math.pow(1 - setupIntroT, 3);

      ctx.font = '800 58px Arial';
      const setupLines = wrapText(ctx, setup, W - 140).slice(0, 4);
      const setupLineH = 70;
      const setupTop = H * 0.3;

      // Dark scrim band behind the setup text so it reads over any footage.
      const setupScrimTop = setupTop - 90;
      const setupScrimBottom = setupTop + (setupLines.length - 1) * setupLineH + 90;
      const scrimGrad1 = ctx.createLinearGradient(0, setupScrimTop - 60, 0, setupScrimBottom + 60);
      scrimGrad1.addColorStop(0, 'rgba(15,23,42,0)');
      scrimGrad1.addColorStop(0.2, 'rgba(15,23,42,0.6)');
      scrimGrad1.addColorStop(0.8, 'rgba(15,23,42,0.6)');
      scrimGrad1.addColorStop(1, 'rgba(15,23,42,0)');
      ctx.fillStyle = scrimGrad1;
      ctx.fillRect(0, setupScrimTop - 60, W, setupScrimBottom - setupScrimTop + 120);

      ctx.save();
      ctx.globalAlpha = setupEased;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `800 ${Math.round(58 * (0.88 + 0.12 * setupEased))}px Arial`;
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 12;
      setupLines.forEach((line, i) => {
        ctx.fillText(line, W / 2, setupTop + i * setupLineH);
      });
      ctx.restore();

      // ── Anticipation beat — pulsing "..." between setup and punchline. ──
      const beatStart = 900;
      const beatEnd = PUNCHLINE_AT_MS - 200;
      if (elapsedMs >= beatStart && elapsedMs < beatEnd) {
        const dotsY = setupTop + setupLines.length * setupLineH + 40;
        const pulse = 0.5 + 0.5 * Math.sin(elapsedMs / 160);
        ctx.save();
        ctx.globalAlpha = 0.55 + 0.35 * pulse;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '700 44px Arial';
        ctx.fillStyle = BRAND_YELLOW;
        ctx.fillText('· · ·', W / 2, dotsY);
        ctx.restore();
      }

      // ── Punchline — bigger, bolder, reveals after the beat. ──
      if (elapsedMs >= PUNCHLINE_AT_MS) {
        const punchIntroT = Math.min(1, (elapsedMs - PUNCHLINE_AT_MS) / 550);
        const punchEased = 1 - Math.pow(1 - punchIntroT, 3);

        ctx.font = '900 72px Arial';
        const punchLines = wrapText(ctx, punchline, W - 120).slice(0, 4);
        const punchLineH = 84;
        const punchTop = setupTop + setupLines.length * setupLineH + 130;

        const punchScrimTop = punchTop - 100;
        const punchScrimBottom = punchTop + (punchLines.length - 1) * punchLineH + 110;
        const scrimGrad2 = ctx.createLinearGradient(0, punchScrimTop - 50, 0, punchScrimBottom + 50);
        scrimGrad2.addColorStop(0, 'rgba(15,23,42,0)');
        scrimGrad2.addColorStop(0.2, 'rgba(15,23,42,0.68)');
        scrimGrad2.addColorStop(0.8, 'rgba(15,23,42,0.68)');
        scrimGrad2.addColorStop(1, 'rgba(15,23,42,0)');
        ctx.fillStyle = scrimGrad2;
        ctx.fillRect(0, punchScrimTop - 50, W, punchScrimBottom - punchScrimTop + 100);

        ctx.save();
        ctx.globalAlpha = punchEased;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const punchScale = 0.82 + 0.18 * punchEased;
        ctx.font = `900 ${Math.round(72 * punchScale)}px Arial`;
        ctx.fillStyle = BRAND_YELLOW;
        ctx.shadowColor = 'rgba(0,0,0,0.6)';
        ctx.shadowBlur = 14;
        punchLines.forEach((line, i) => {
          const slideY = (1 - punchEased) * 24;
          ctx.fillText(line, W / 2, punchTop + i * punchLineH + slideY);
        });
        ctx.restore();

        // ── Laugh emoji burst — rises from around the punchline, fades
        // in, drifts up and slightly sideways, fades out near the top of
        // its own travel, then the loop restart resets it. Deterministic
        // per-item timing (see buildEmojiBurst) so replays look the same.
        const burstOriginY = punchTop + punchLines.length * punchLineH * 0.5;
        const burstDuration = 1600;
        burstRef.current.forEach((item) => {
          const localElapsed = elapsedMs - PUNCHLINE_AT_MS - item.delayMs;
          if (localElapsed < 0) return;
          const bt = Math.min(1, localElapsed / burstDuration);
          if (bt >= 1) return;
          // Ease-out rise, fade in over first 15%, fade out over last 35%.
          const rise = (1 - Math.pow(1 - bt, 2)) * 420;
          const alpha = bt < 0.15 ? bt / 0.15 : bt > 0.65 ? Math.max(0, (1 - bt) / 0.35) : 1;
          const x = W * item.xFrac + item.driftX * bt;
          const y = burstOriginY - rise;
          const rot = (item.rotate * bt * Math.PI) / 180;

          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.translate(x, y);
          ctx.rotate(rot);
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.font = `${item.size}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", Arial`;
          ctx.fillText(item.emoji, 0, 0);
          ctx.restore();
        });
      }

      // Small brand mark, bottom
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = BRAND_YELLOW;
      ctx.font = 'bold 26px Arial';
      ctx.fillText('SHINEY BRAIN ACADEMY', 50, H - 50);
    },
    [background, setup, punchline]
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
      draw(PUNCHLINE_AT_MS + 1600); // static idle frame — past the punchline reveal and burst
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [status, draw]);

  const startRecording = async () => {
    setErrorMsg(null);
    setVideoBlobUrl(null);
    setVideoBlob(null);

    try {
      const AudioContextCls = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioContextCls();
      audioCtxRef.current = audioCtx;

      const dest = audioCtx.createMediaStreamDestination();

      // Laugh track is timed to the punchline, not started at t=0 — a
      // laugh landing before the joke lands reads as broken, not funny.
      if (tracks.length > 0 && audioRef.current) {
        const track = tracks[Math.floor(Math.random() * tracks.length)];
        audioRef.current.src = track;
        audioRef.current.currentTime = 0;
        const source = audioCtx.createMediaElementSource(audioRef.current);
        source.connect(dest);
        source.connect(audioCtx.destination);
        laughTimerRef.current = setTimeout(() => {
          audioRef.current?.play().catch(() => {});
        }, PUNCHLINE_AT_MS);
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

      // Bitrate target: comfortably under ~1.3MB for an 8s clip.
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
    if (laughTimerRef.current) clearTimeout(laughTimerRef.current);
    if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop();
    if (audioRef.current) audioRef.current.pause();
    if (bgVideoRef.current) bgVideoRef.current.pause();
    if (audioCtxRef.current) audioCtxRef.current.close().catch(() => {});
  }

  const cancelRecording = () => {
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    if (laughTimerRef.current) clearTimeout(laughTimerRef.current);
    if (recorderRef.current) recorderRef.current.onstop = null;
    if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop();
    if (audioRef.current) audioRef.current.pause();
    if (bgVideoRef.current) bgVideoRef.current.pause();
    if (audioCtxRef.current) audioCtxRef.current.close().catch(() => {});
    setStatus('idle');
  };

  const saveToContentAsset = async () => {
    if (!videoBlob) return;
    setStatus('uploading');
    setErrorMsg(null);
    try {
      const supabase = createBrowserClient();
      const ext = extensionForMimeType(videoBlob.type);
      const path = `${contentAsset.id}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, videoBlob, { contentType: videoBlob.type || 'video/webm', upsert: true });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);

      const res = await fetch('/api/admin/meme-loops/save', {
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
        width={CANVAS_W}
        height={CANVAS_H}
        className="w-full max-w-[280px] aspect-[9/16] mx-auto rounded-2xl border shadow-sm bg-black"
      />
      <video ref={bgVideoRef} muted playsInline className="hidden" />
      <audio ref={audioRef} crossOrigin="anonymous" className="hidden" />

      <p className="text-xs text-gray-500 text-center">
        {background?.type === 'video' && `Real footage background (${background.source}).`}
        {background?.type === 'photo' && `Photo background with zoom (${background.source}).`}
        {!background && 'No background candidate found — recording on an animated brand gradient.'}
        {' '}Records an {RECORD_SECONDS}s setup→punchline loop{tracks.length === 0 ? ' — no laugh tracks found in public/audio/meme-loops yet, clip will be silent' : ''}.
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
              download={`${(contentAsset.title || 'meme-loop').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.${extensionForMimeType(videoBlob?.type)}`}
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
