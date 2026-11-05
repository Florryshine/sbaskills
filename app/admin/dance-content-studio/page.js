'use client';

import { useEffect, useRef, useState } from 'react';

const WIDTH = 720;
const HEIGHT = 1280;

function wrapLines(ctx, value, maxWidth) {
  const words = String(value || '').trim().split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? line + ' ' + word : word;
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

export default function DanceContentStudio() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const audioRef = useRef(null);
  const audioContextRef = useRef(null);
  const audioSourceRef = useRef(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [videoName, setVideoName] = useState('');
  const [musicUrl, setMusicUrl] = useState('');
  const [musicName, setMusicName] = useState('');
  const [stockQuery, setStockQuery] = useState('dancing silhouette');
  const [stockResults, setStockResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [topic, setTopic] = useState('Motivation for students preparing for JAMB');
  const [tone, setTone] = useState('motivational');
  const [overlayText, setOverlayText] = useState('Your future is being shaped by the effort you put in today. Keep learning, keep practising, and do not give up on the person you are becoming.');
  const [socialCaption, setSocialCaption] = useState('Small steps, taken consistently, can change your results. Keep showing up. 💙💛');
  const [headline, setHeadline] = useState('KEEP SHOWING UP');
  const [textColor, setTextColor] = useState('#ffffff');
  const [panelColor, setPanelColor] = useState('#09284b');
  const [textSize, setTextSize] = useState(35);
  const [headlineSize, setHeadlineSize] = useState(42);
  const [position, setPosition] = useState(72);
  const [musicVolume, setMusicVolume] = useState(35);
  const [originalVolume, setOriginalVolume] = useState(0);
  const [busy, setBusy] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [status, setStatus] = useState('Upload a dance clip or search for dancing stock footage.');
  const [showBrand, setShowBrand] = useState(true);

  useEffect(() => {
    let frame;
    const draw = () => {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#071b36';
        ctx.fillRect(0, 0, WIDTH, HEIGHT);
        if (video && video.readyState >= 2 && video.videoWidth) {
          const scale = Math.max(WIDTH / video.videoWidth, HEIGHT / video.videoHeight);
          const sourceWidth = WIDTH / scale;
          const sourceHeight = HEIGHT / scale;
          ctx.drawImage(video, (video.videoWidth - sourceWidth) / 2, (video.videoHeight - sourceHeight) / 2, sourceWidth, sourceHeight, 0, 0, WIDTH, HEIGHT);
        }
        const maxWidth = WIDTH - 88;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = '#000000a8';
        ctx.shadowBlur = 7;
        ctx.font = '900 ' + headlineSize + 'px Arial, sans-serif';
        const titleLines = wrapLines(ctx, headline, maxWidth);
        const bodyFont = Math.max(22, Math.min(44, textSize));
        ctx.font = '700 ' + bodyFont + 'px Arial, sans-serif';
        const bodyLines = wrapLines(ctx, overlayText, maxWidth);
        const titleLineHeight = headlineSize * 1.2;
        const titleHeight = titleLines.length * titleLineHeight;
        const bodyHeight = bodyLines.length * (bodyFont * 1.28);
        const gap = 20;
        const totalHeight = titleHeight + gap + bodyHeight;
        const top = Math.max(50, Math.min(HEIGHT - totalHeight - 50, HEIGHT * position / 100 - totalHeight / 2));
        ctx.fillStyle = '#f5c542';
        titleLines.forEach((line, index) => ctx.fillText(line, WIDTH / 2, top + index * titleLineHeight + titleLineHeight / 2, maxWidth));
        ctx.font = '700 ' + bodyFont + 'px Arial, sans-serif';
        ctx.fillStyle = textColor;
        bodyLines.forEach((line, index) => ctx.fillText(line, WIDTH / 2, top + titleHeight + gap + index * bodyFont * 1.28 + bodyFont / 2, maxWidth));
        ctx.shadowBlur = 0;
        if (showBrand) {
          ctx.font = '900 18px Arial, sans-serif';
          ctx.fillStyle = '#ffffffdd';
          ctx.textAlign = 'left';
          ctx.fillText('SHINEY BRAIN ACADEMY', 34, HEIGHT - 34);
        }
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [headline, overlayText, textColor, textSize, headlineSize, position, showBrand, videoUrl]);

  useEffect(() => () => {
    if (videoUrl.startsWith('blob:')) URL.revokeObjectURL(videoUrl);
    if (musicUrl.startsWith('blob:')) URL.revokeObjectURL(musicUrl);
    audioContextRef.current?.close().catch(() => {});
  }, [videoUrl, musicUrl]);

  function loadVideo(file) {
    if (!file) return;
    if (!file.type.startsWith('video/')) return setStatus('Please choose a video file.');
    setVideoUrl(URL.createObjectURL(file));
    setVideoName(file.name);
    setStatus('Dance clip loaded. Add music and generate your message.');
  }

  function loadMusic(file) {
    if (!file) return;
    if (!file.type.startsWith('audio/')) return setStatus('Please choose an audio file.');
    setMusicUrl(URL.createObjectURL(file));
    setMusicName(file.name);
    setStatus('Music loaded. You can adjust both audio levels.');
  }

  async function searchStock(event) {
    event.preventDefault();
    if (!stockQuery.trim()) return;
    setSearching(true);
    setStatus('Searching Pexels and Pixabay for dancing footage…');
    try {
      const response = await fetch('/api/admin/bold-text-video/backgrounds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: stockQuery.trim(), kind: 'video' }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Stock search failed.');
      setStockResults(data.results || []);
      setStatus(data.results?.length ? 'Choose a dancing clip from the results.' : (data.warning || 'No stock clips found. Try another search.'));
    } catch (error) {
      setStatus(error.message || 'Could not search stock footage.');
    } finally {
      setSearching(false);
    }
  }

  async function generateCopy() {
    if (!topic.trim()) return setStatus('Enter a topic or message idea first.');
    setGenerating(true);
    setStatus('Writing your video message and social caption…');
    try {
      const response = await fetch('/api/admin/dance-studio/copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, tone }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Copy generation failed.');
      setHeadline(data.headline || '');
      setOverlayText(data.overlayText || '');
      setSocialCaption(data.socialCaption || '');
      setStatus('Your overlay message and social caption are ready. Edit either one before export.');
    } catch (error) {
      setStatus(error.message || 'Could not generate copy.');
    } finally {
      setGenerating(false);
    }
  }

  function selectStock(item) {
    setVideoUrl(item.url);
    setVideoName((item.source || 'Stock') + ' dance footage · ' + (item.photographer || 'creator'));
    setStatus('Stock clip selected. If its preview does not load, choose another result or upload your own clip.');
  }

  async function exportVideo() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!videoUrl || !video || !canvas) return;
    if (!canvas.captureStream || !window.MediaRecorder) {
      setStatus('Video export is not supported in this browser. Try the latest Chrome.');
      return;
    }
    let audioContext;
    let recorder;
    try {
      setBusy(true);
      setStatus('Preparing video export. Keep this page open…');
      video.pause();
      video.currentTime = 0;
      await new Promise((resolve, reject) => {
        if (video.readyState >= 2) return resolve();
        video.onloadeddata = resolve;
        video.onerror = () => reject(new Error('The selected video could not be loaded. Try another clip.'));
      });
      audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const destination = audioContext.createMediaStreamDestination();
      if (audioRef.current && musicUrl) {
        audioSourceRef.current = audioContext.createMediaElementSource(audioRef.current);
        const musicGain = audioContext.createGain();
        musicGain.gain.value = musicVolume / 100;
        audioSourceRef.current.connect(musicGain);
        musicGain.connect(destination);
      }
      const videoElement = video;
      const originalGain = audioContext.createGain();
      originalGain.gain.value = originalVolume / 100;
      if (videoElement.captureStream) {
        const originalStream = videoElement.captureStream();
        const originalTrack = originalStream.getAudioTracks()[0];
        if (originalTrack) {
          const source = audioContext.createMediaStreamSource(originalStream);
          source.connect(originalGain);
          originalGain.connect(destination);
        }
      }
      await audioContext.resume();
      const outputStream = new MediaStream([
        ...canvas.captureStream(30).getVideoTracks(),
        ...destination.stream.getAudioTracks(),
      ]);
      const mimeType = ['video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find((type) => MediaRecorder.isTypeSupported(type));
      recorder = new MediaRecorder(outputStream, mimeType ? { mimeType } : undefined);
      const chunks = [];
      recorder.ondataavailable = (event) => { if (event.data?.size) chunks.push(event.data); };
      recorder.onerror = () => {
        setBusy(false);
        setStatus('The browser stopped the recording unexpectedly. Try a shorter clip.');
        audioContext.close().catch(() => {});
      };
      recorder.onstop = () => {
        const mime = recorder.mimeType || mimeType || 'video/webm';
        const blob = new Blob(chunks, { type: mime });
        const objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = objectUrl;
        anchor.download = 'shiney-brain-dance-content.' + (mime.includes('mp4') ? 'mp4' : 'webm');
        anchor.click();
        setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
        audioContext.close().catch(() => {});
        setBusy(false);
        setStatus('Export finished · ' + (blob.size / 1048576).toFixed(1) + ' MB. File downloaded to your device.');
      };
      recorder.start(1000);
      await video.play();
      if (audioRef.current && musicUrl) await audioRef.current.play().catch(() => {});
      setStatus('Recording your finished video…');
      video.onended = () => {
        if (recorder.state !== 'inactive') recorder.stop();
        video.pause();
        audioRef.current?.pause();
      };
    } catch (error) {
      if (recorder && recorder.state !== 'inactive') recorder.stop();
      audioContext?.close().catch(() => {});
      setBusy(false);
      setStatus(error.message || 'Export failed. Try a shorter clip or another browser.');
    }
  }

  function previewPlayback() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => setStatus('Could not play this clip.'));
      if (audioRef.current && musicUrl) audioRef.current.play().catch(() => {});
    } else {
      video.pause();
      audioRef.current?.pause();
    }
  }

  return (
    <main className="mx-auto max-w-7xl space-y-5 pb-16">
      <header className="rounded-3xl bg-gradient-to-r from-blue-950 via-blue-800 to-blue-600 p-6 text-white">
        <p className="text-xs font-black tracking-[.22em] text-yellow-300">SHINEY BRAIN ACADEMY · CREATOR TOOLS</p>
        <h1 className="mt-2 text-3xl font-black">Dance Content Studio</h1>
        <p className="mt-2 max-w-2xl text-blue-100">Turn your own dance clips or stock dancing footage into branded motivational and educational videos.</p>
      </header>

      <div className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
        <section className="space-y-5 rounded-2xl border bg-white p-4 sm:p-6">
          <div>
            <h2 className="text-lg font-extrabold">1. Choose dancing footage</h2>
            <label className="mt-3 block cursor-pointer rounded-xl border-2 border-dashed border-blue-200 bg-blue-50 p-5 text-center">
              <b>Upload a video from your phone</b>
              <span className="block text-xs text-slate-500">MP4, MOV or WebM</span>
              <input className="mt-3 block w-full text-sm" type="file" accept="video/*" onChange={(event) => loadVideo(event.target.files?.[0])} />
            </label>
            {videoName && <p className="mt-2 break-all text-xs text-slate-500">Selected: {videoName}</p>}
            <form onSubmit={searchStock} className="mt-4 flex gap-2">
              <input value={stockQuery} onChange={(event) => setStockQuery(event.target.value)} className="min-w-0 flex-1 rounded-xl border p-3 text-sm" placeholder="Search dancing stickman, silhouette, street dance…" />
              <button disabled={searching} className="rounded-xl bg-blue-700 px-4 text-sm font-bold text-white disabled:opacity-50">{searching ? 'Searching…' : 'Find clips'}</button>
            </form>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {stockResults.map((item, index) => (
                <button key={item.url || index} type="button" onClick={() => selectStock(item)} className="overflow-hidden rounded-xl border p-2 text-left hover:border-blue-500">
                  <div className="aspect-video overflow-hidden rounded-lg bg-slate-100">
                    {item.previewUrl && <img src={item.previewUrl} alt="" className="h-full w-full object-cover" />}
                  </div>
                  <p className="mt-2 text-xs font-bold capitalize">{item.source} · {item.durationSeconds || '?'} sec</p>
                  <span className="text-xs text-blue-700">Use this clip</span>
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-500">Stock results come from Pexels/Pixabay. Check each source's licence and any identifiable-person rights before commercial use.</p>
          </div>

          <div className="border-t pt-5">
            <h2 className="text-lg font-extrabold">2. Add background music</h2>
            <input className="mt-3 block w-full text-sm" type="file" accept="audio/*" onChange={(event) => loadMusic(event.target.files?.[0])} />
            {musicName && <p className="mt-1 break-all text-xs text-slate-500">{musicName}</p>}
            <label className="mt-3 block text-sm font-semibold">Music volume: {musicVolume}%<input className="mt-2 w-full" type="range" min="0" max="100" value={musicVolume} onChange={(event) => setMusicVolume(Number(event.target.value))} /></label>
            <label className="mt-3 block text-sm font-semibold">Original video sound: {originalVolume}%<input className="mt-2 w-full" type="range" min="0" max="100" value={originalVolume} onChange={(event) => setOriginalVolume(Number(event.target.value))} /></label>
          </div>

          <div className="space-y-3 border-t pt-5">
            <h2 className="text-lg font-extrabold">3. Write the message</h2>
            <input value={topic} onChange={(event) => setTopic(event.target.value)} className="w-full rounded-xl border p-3 text-sm" placeholder="What should this video be about?" />
            <div className="flex flex-wrap items-center gap-3">
              <select value={tone} onChange={(event) => setTone(event.target.value)} className="rounded-xl border p-3 text-sm">
                <option value="motivational">Motivational</option>
                <option value="educational">Educational / study tip</option>
                <option value="promotional">SBA promotional</option>
                <option value="storytelling">Storytelling</option>
              </select>
              <button type="button" onClick={generateCopy} disabled={generating} className="rounded-xl bg-yellow-400 px-4 py-3 text-sm font-extrabold text-blue-950 disabled:opacity-50">{generating ? 'Writing…' : '✨ Generate message + caption'}</button>
            </div>
            <label className="block text-sm font-semibold">Headline on video<input value={headline} onChange={(event) => setHeadline(event.target.value)} className="mt-1 w-full rounded-xl border p-3 font-normal" /></label>
            <label className="block text-sm font-semibold">Message displayed on video<textarea rows={4} value={overlayText} onChange={(event) => setOverlayText(event.target.value)} className="mt-1 w-full rounded-xl border p-3 font-normal" /></label>
            <label className="block text-sm font-semibold">Social media caption (separate from video text)<textarea rows={3} value={socialCaption} onChange={(event) => setSocialCaption(event.target.value)} className="mt-1 w-full rounded-xl border p-3 font-normal" /></label>
          </div>

          <div className="space-y-3 border-t pt-5">
            <h2 className="text-lg font-extrabold">4. Style the video</h2>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm font-semibold">Text colour<input type="color" value={textColor} onChange={(event) => setTextColor(event.target.value)} className="mt-1 block h-10 w-full" /></label>
            </div>
            <label className="block text-sm font-semibold">Headline size: {headlineSize}px<input type="range" min="24" max="72" value={headlineSize} onChange={(event) => setHeadlineSize(Number(event.target.value))} className="mt-2 w-full" /></label>
            <label className="block text-sm font-semibold">Message size: {textSize}px<input type="range" min="18" max="64" value={textSize} onChange={(event) => setTextSize(Number(event.target.value))} className="mt-2 w-full" /></label>
            <label className="block text-sm font-semibold">Message position: {position}%<input type="range" min="35" max="85" value={position} onChange={(event) => setPosition(Number(event.target.value))} className="mt-2 w-full" /></label>
            <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={showBrand} onChange={(event) => setShowBrand(event.target.checked)} /> Show subtle SBA branding</label>
          </div>
        </section>

        <aside className="space-y-4 rounded-2xl border bg-slate-50 p-4 sm:p-6">
          <div className="flex items-center justify-between"><h2 className="text-lg font-extrabold">Live preview</h2><span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-800">9:16 vertical</span></div>
          <div className="mx-auto max-w-[320px] overflow-hidden rounded-2xl bg-slate-950 shadow-xl"><canvas ref={canvasRef} width={WIDTH} height={HEIGHT} className="block h-auto w-full" /></div>
          <video ref={videoRef} src={videoUrl || undefined} playsInline preload="auto" crossOrigin="anonymous" className="fixed -left-[2000px] top-0 h-px w-px opacity-0" />
          <audio ref={audioRef} src={musicUrl || undefined} className="hidden" />
          <button type="button" onClick={previewPlayback} disabled={!videoUrl || busy} className="w-full rounded-xl border bg-white p-3 font-bold text-blue-800 disabled:opacity-40">▶ Play / pause preview</button>
          <button type="button" onClick={exportVideo} disabled={!videoUrl || busy} className="w-full rounded-xl bg-yellow-400 p-4 font-extrabold text-blue-950 disabled:opacity-40">{busy ? 'Rendering… keep this page open' : 'Export finished video'}</button>
          <div className="rounded-xl bg-white p-4 text-sm"><b>Status</b><p aria-live="polite" className="mt-1 text-slate-600">{status}</p></div>
          <p className="text-xs leading-5 text-slate-500">Export happens in your browser. Keep this page open until the file downloads. Some Android browsers export WebM rather than MP4; try Chrome or a laptop if export fails.</p>
        </aside>
      </div>
    </main>
  );
}
