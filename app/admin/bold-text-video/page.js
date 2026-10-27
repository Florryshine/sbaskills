'use client';

import { useEffect, useRef, useState } from 'react';
import PublishToChannels from '@/components/admin/PublishToChannels';

const FORMATS = {
  '9:16': [720, 1280],
  '1:1': [900, 900],
  '16:9': [1280, 720],
};
const TYPES = [
  ['question', 'JAMB / quiz question'],
  ['story', 'Short story'],
  ['joke', 'Joke / funny'],
  ['fact', 'Surprising fact'],
  ['motivation', 'Motivation / hard truth'],
  ['lesson', 'Quick lesson / explainer'],
  ['riddle', 'Riddle / brain teaser'],
  ['promo', 'Promo / call to action'],
];

export default function BoldTextVideoPage() {
  const [topic, setTopic] = useState('');
  const [type, setType] = useState('question');
  const [seconds, setSeconds] = useState(20);
  const [ratio, setRatio] = useState('9:16');
  const [style, setStyle] = useState('pop');
  const [script, setScript] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [recording, setRecording] = useState(false);
  const [progress, setProgress] = useState(0);
  const [soundMode, setSoundMode] = useState('narration_music');
  const [voice, setVoice] = useState('host_a');
  const [emotion, setEmotion] = useState('excited');
  const [musicTrack, setMusicTrack] = useState('');
  const [musicTracks, setMusicTracks] = useState([]);
  const [audioUrl, setAudioUrl] = useState('');
  const [generatingAudio, setGeneratingAudio] = useState(false);
  const [captionMode, setCaptionMode] = useState('scene');
  const [fontFamily, setFontFamily] = useState('Impact');
  const [backgroundQuery, setBackgroundQuery] = useState('');
  const [backgroundKind, setBackgroundKind] = useState('video');
  const [backgrounds, setBackgrounds] = useState([]);
  const [selectedBackground, setSelectedBackground] = useState(null);
  const [searchingBackgrounds, setSearchingBackgrounds] = useState(false);
  const [backgroundError, setBackgroundError] = useState('');
  const [generatedBlob, setGeneratedBlob] = useState(null);
  const [savedVideo, setSavedVideo] = useState(null);
  const [savingToCloud, setSavingToCloud] = useState(false);
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const audioElementsRef = useRef([]);
  const backgroundMediaRef = useRef(null);

  useEffect(() => {
    fetch('/api/admin/quote-loops/audio-list').then(r => r.json())
      .then(d => setMusicTracks((d.tracks || []).map((url, i) => ({ url, title: decodeURIComponent(url.split('/').pop().replace(/\\.mp3$/i, '').replace(/[-_]/g, ' ')) || ('Track ' + (i + 1)) }))))
      .catch(() => setMusicTracks([]));
  }, []);

  const generateNarration = async () => {
    if (!script?.scenes?.length) return;
    setGeneratingAudio(true); setError('');
    try {
      const res = await fetch('/api/admin/bold-text-video/audio', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: script.scenes.map(s => s.text).join('. '), voice, emotion })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Narration generation failed');
      setAudioUrl('data:' + data.mimeType + ';base64,' + data.audioBase64);
    } catch (e) { setError(e.message || 'Narration failed. The shared TTS service may be unavailable.'); }
    finally { setGeneratingAudio(false); }
  };

  const searchBackgrounds = async () => {
    if (!backgroundQuery.trim()) { setBackgroundError('Enter a search phrase, e.g. chemistry lab or students studying.'); return; }
    setSearchingBackgrounds(true); setBackgroundError('');
    try {
      const res = await fetch('/api/admin/bold-text-video/backgrounds', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: backgroundQuery.trim(), kind: backgroundKind }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Background search failed');
      setBackgrounds(data.results || []);
      if (!(data.results || []).length) setBackgroundError(data.warning || 'No results found. Try another search.');
    } catch (e) { setBackgroundError(e.message || 'Could not search stock backgrounds.'); }
    finally { setSearchingBackgrounds(false); }
  };

  const generate = async () => {
    setBusy(true); setError(''); setScript(null); setGeneratedBlob(null); setSavedVideo(null);
    try {
      const res = await fetch('/api/admin/bold-text-video/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: topic.trim(), type, seconds: Number(seconds) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Script generation failed');
      setScript(data.script);
    } catch (e) { setError(e.message || 'Could not generate script'); }
    finally { setBusy(false); }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !script?.scenes?.length) return;
    const ctx = canvas.getContext('2d');
    const [W, H] = FORMATS[ratio];
    canvas.width = W; canvas.height = H;
    const scenes = script.scenes;
    const total = Math.max(5, Number(seconds) || 20);
    let start = performance.now();
    let lastProgress = 0;
    let media = null;
    if (selectedBackground && selectedBackground.url) {
      try {
        if (selectedBackground.type === 'photo') {
          media = new Image(); media.crossOrigin = 'anonymous'; media.src = selectedBackground.url;
        } else {
          media = document.createElement('video'); media.crossOrigin = 'anonymous'; media.src = selectedBackground.url; media.muted = true; media.loop = true; media.playsInline = true; media.play().catch(() => {});
        }
        backgroundMediaRef.current = media;
      } catch (_) { media = null; }
    } else { backgroundMediaRef.current = null; }
    const draw = (now) => {
      const elapsed = ((now - start) / 1000) % total;
      const p = elapsed / total;
      const sceneIndex = Math.min(scenes.length - 1, Math.floor(p * scenes.length));
      const scene = scenes[sceneIndex] || { text: script.title || 'SHINEY BRAIN', emphasis: '' };
      const local = (p * scenes.length) % 1;
      lastProgress = p;
      setProgress(p);
      // Draw selected stock media when ready; otherwise use the animated gradient.
      let drewMedia = false;
      if (media) {
        try {
          const isPhoto = selectedBackground.type === 'photo';
          const ready = isPhoto ? media.complete && media.naturalWidth > 0 : media.readyState >= 2 && media.videoWidth > 0;
          if (ready) {
            const mw = isPhoto ? media.naturalWidth : media.videoWidth;
            const mh = isPhoto ? media.naturalHeight : media.videoHeight;
            const scale = Math.max(W / mw, H / mh);
            ctx.drawImage(media, (W - mw * scale) / 2, (H - mh * scale) / 2, mw * scale, mh * scale);
            ctx.fillStyle = 'rgba(3,10,25,.62)'; ctx.fillRect(0, 0, W, H); drewMedia = true;
          }
        } catch (_) { drewMedia = false; }
      }
      if (!drewMedia) {
        const g = ctx.createLinearGradient(0, 0, W, H);
        const hue = (220 + elapsed * 13) % 360;
        g.addColorStop(0, '#071329'); g.addColorStop(.55, '#102f67'); g.addColorStop(1, 'hsl(' + hue + ', 82%, 35%)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      }
      ctx.save();
      ctx.globalAlpha = .13;
      ctx.translate(W * (.5 + Math.sin(elapsed * .8) * .18), H * .4);
      ctx.rotate(-.24);
      ctx.fillStyle = '#fff';
      for (let i = -4; i < 5; i++) ctx.fillRect(i * W * .22, -H, W * .035, H * 2);
      ctx.restore();
      // Accent frame + moving progress line
      ctx.strokeStyle = '#ffcc00'; ctx.lineWidth = Math.max(4, W * .006);
      ctx.strokeRect(W*.055, H*.055, W*.89, H*.89);
      ctx.fillStyle = '#ffcc00'; ctx.fillRect(0, H*.018, W*p, Math.max(6,H*.009));
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffcc00'; ctx.font = `900 ${Math.round(W*.035)}px Arial`;
      ctx.fillText('SHINEY BRAIN ACADEMY', W/2, H*.16);
      const allWords = String(scene.text || '').trim().split(/\s+/).slice(0, 28);
      const words = captionMode === 'word' ? allWords.slice(0, Math.max(1, Math.ceil(local * allWords.length))) : allWords;
      const fontSize = Math.round(Math.min(W*.105, H*.09, W*0.88 / Math.max(5, Math.min(11, Math.max(...words.map(w=>w.length), 5))*.55)));
      ctx.font = `1000 ${fontSize}px ${fontFamily}, Impact, Arial Black, Arial`;
      ctx.lineJoin = 'round'; ctx.textAlign = 'center';
      const lines = []; let line = '';
      const maxWidth = W*.82;
      words.forEach(word => {
        const test = line ? line + ' ' + word : word;
        if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = word; } else line = test;
      });
      if (line) lines.push(line);
      const lineH = fontSize*1.13;
      const blockH = lines.length*lineH;
      const y0 = H*.51 - blockH/2 + Math.sin(local*Math.PI)*H*.012;
      lines.forEach((ln,i) => {
        const y = y0+i*lineH;
        const pop = style === 'pop' ? 1 + Math.sin(local*Math.PI)*.045 : 1;
        ctx.save(); ctx.translate(W/2,y); ctx.scale(pop,pop);
        ctx.font = `1000 ${fontSize}px Impact, Arial Black, Arial`;
        ctx.lineWidth = Math.max(6,fontSize*.13); ctx.strokeStyle = '#07101f'; ctx.strokeText(ln,W*0,H*0);
        ctx.fillStyle = (i === Math.floor(lines.length/2) || /\b(ANSWER|WHY|STOP|NEVER|JAMB|SECRET|WRONG|RIGHT)\b/i.test(ln)) ? '#ffcc00' : '#ffffff';
        ctx.fillText(ln,0,0);
        ctx.restore();
      });
      ctx.fillStyle = 'rgba(0,0,0,.48)'; ctx.fillRect(W*.08,H*.82,W*.84,H*.085);
      ctx.fillStyle = '#fff'; ctx.font = `800 ${Math.round(W*.027)}px Arial`;
      ctx.fillText(scene.label || 'WATCH THIS', W/2,H*.862, W*.78);
      ctx.fillStyle = '#dbeafe'; ctx.font = `700 ${Math.round(W*.024)}px Arial`;
      ctx.fillText('FOLLOW FOR MORE • @SHINEY BRAIN', W/2,H*.94,W*.82);
      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [script, ratio, seconds, style, captionMode, fontFamily, selectedBackground]);

  const saveToSupabase = async () => {
    if (!generatedBlob) { setError('Create a video first.'); return; }
    setSavingToCloud(true); setError('');
    try {
      const form = new FormData();
      form.append('file', generatedBlob, 'shiney-brain-video-' + Date.now() + '.webm');
      const title = (topic || script?.title || 'SBA Bold Text Video').trim().slice(0, 180);
      const caption = (script?.scenes || []).map(x => x.text).join(' ');
      form.append('title', title);
      form.append('topic', topic || title);
      form.append('script', caption);
      form.append('durationSeconds', String(Number(seconds) || 0));
      form.append('caption', caption);
      const savedRes = await fetch('/api/admin/bold-text-video/save', { method: 'POST', body: form });
      const saved = await savedRes.json();
      if (!savedRes.ok) throw new Error(saved.error || 'Could not save video to Supabase.');
      setSavedVideo(saved);
    } catch (e) { setError(e.message || 'Could not save video to Supabase.'); }
    finally { setSavingToCloud(false); }
  };

  const recordVideo = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !script) return;
    if (!canvas.captureStream || typeof MediaRecorder === 'undefined') {
      setError('Video recording is not supported by this browser. Try Chrome.'); return;
    }
    const videoStream = canvas.captureStream(30);
    let combinedStream = videoStream;
    let audioContext = null;
    audioElementsRef.current.forEach(a => { try { a.pause(); a.src = ''; } catch (_) {} });
    audioElementsRef.current = [];
    try {
      const tracks = [...videoStream.getVideoTracks()];
      if (soundMode !== 'none') {
        audioContext = new AudioContext();
        const destination = audioContext.createMediaStreamDestination();
        if (soundMode === 'narration' || soundMode === 'narration_music') {
          if (!audioUrl) throw new Error('Generate AI narration first, or choose a mode without narration.');
          const narration = new Audio(audioUrl); narration.preload = 'auto'; audioElementsRef.current.push(narration);
          const source = audioContext.createMediaElementSource(narration);
          const gain = audioContext.createGain(); gain.gain.value = 1;
          source.connect(gain); gain.connect(destination); gain.connect(audioContext.destination);
          await audioContext.resume();
        }
        if ((soundMode === 'music' || soundMode === 'narration_music') && musicTrack) {
          const music = new Audio(musicTrack); music.loop = true; music.preload = 'auto'; audioElementsRef.current.push(music);
          const source = audioContext.createMediaElementSource(music);
          const gain = audioContext.createGain();
          gain.gain.value = soundMode === 'narration_music' ? 0.14 : 0.45;
          source.connect(gain); gain.connect(destination); gain.connect(audioContext.destination);
        }
        tracks.push(...destination.stream.getAudioTracks());
      }
      combinedStream = new MediaStream(tracks);
      const mime = ['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'].find(t => MediaRecorder.isTypeSupported(t)) || '';
      const recorder = new MediaRecorder(combinedStream, mime ? { mimeType: mime } : undefined);
      recorderRef.current = recorder; chunksRef.current = [];
      recorder.ondataavailable = e => { if (e.data?.size) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'video/webm' });
        setGeneratedBlob(blob); setSavedVideo(null);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'shiney-brain-video-' + Date.now() + '.webm';
        document.body.appendChild(a); a.click(); a.remove();
        setRecording(false); videoStream.getTracks().forEach(t => t.stop());
        audioElementsRef.current.forEach(a => { try { a.pause(); a.src = ''; } catch (_) {} }); audioElementsRef.current = [];
        if (audioContext) audioContext.close().catch(() => {});
      };
      recorder.start(250); setRecording(true); setError('');
      for (const audio of audioElementsRef.current) {
        try { audio.currentTime = 0; await audio.play(); }
        catch (e) { throw new Error('Could not play selected audio: ' + (e.message || 'browser playback blocked')); }
      }
      window.setTimeout(() => { if (recorder.state === 'recording') recorder.stop(); }, Number(seconds)*1000);
    } catch (e) {
      videoStream.getTracks().forEach(t => t.stop());
      if (audioContext) audioContext.close().catch(() => {});
      setError(e.message || 'Could not start recording. Try Chrome.');
    }
  };

  return <main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
    <header><p className="text-sm font-bold uppercase tracking-widest text-blue-600">SBA VIDEO STUDIO</p>
      <h1 className="text-3xl font-black">Bold Text Video</h1>
      <p className="mt-2 max-w-2xl text-sm text-gray-600">Generate a script, create your video, download it to your phone, or save it to Cloudinary and publish it through the Social Engine.</p>
    </header>
    <section className="grid gap-5 md:grid-cols-[1fr_1fr]">
      <div className="space-y-4 rounded-2xl border bg-white p-4">
        <label className="block text-sm font-bold">What is the video about? <span className="font-normal text-gray-500">(optional for random ideas)</span>
          <input value={topic} onChange={e=>setTopic(e.target.value)} placeholder="e.g. tricky JAMB Chemistry questions" className="mt-2 w-full rounded-xl border px-3 py-3 text-base" />
        </label>
        <label className="block text-sm font-bold">Video type
          <select value={type} onChange={e=>setType(e.target.value)} className="mt-2 w-full rounded-xl border px-3 py-3 text-base">{TYPES.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select>
        </label>
        <label className="block text-sm font-bold">Video duration
          <select value={seconds} onChange={e=>setSeconds(Number(e.target.value))} className="mt-2 w-full rounded-xl border px-3 py-3 text-base">{[10,15,20,30,45,60,90,120].map(n=><option key={n} value={n}>{n} seconds</option>)}</select>
        </label>
        <label className="block text-sm font-bold">Aspect ratio
          <select value={ratio} onChange={e=>setRatio(e.target.value)} className="mt-2 w-full rounded-xl border px-3 py-3 text-base"><option value="9:16">9:16 — TikTok / Reels / Shorts</option><option value="1:1">1:1 — Square</option><option value="16:9">16:9 — YouTube / Landscape</option></select>
        </label>
        <label className="block text-sm font-bold">Sound
          <select value={soundMode} onChange={e=>setSoundMode(e.target.value)} className="mt-2 w-full rounded-xl border px-3 py-3 text-base">
            <option value="none">No audio</option><option value="music">Background music only</option><option value="narration">AI narration only</option><option value="narration_music">AI narration + music</option>
          </select>
        </label>
        {(soundMode==='narration' || soundMode==='narration_music') && <div className="space-y-2 rounded-xl bg-blue-50 p-3">
          <label className="block text-sm font-bold">Nigerian English voice
            <select value={voice} onChange={e=>setVoice(e.target.value)} className="mt-2 w-full rounded-xl border px-3 py-2 text-base"><option value="host_a">Ezinne — female</option><option value="host_b">Abeo — male</option></select>
          </label>
          <label className="block text-sm font-bold">Delivery
            <select value={emotion} onChange={e=>setEmotion(e.target.value)} className="mt-2 w-full rounded-xl border px-3 py-2 text-base"><option value="excited">Energetic</option><option value="curious">Curious</option><option value="serious">Serious</option><option value="calm">Calm</option><option value="dramatic">Dramatic</option><option value="neutral">Neutral</option></select>
          </label>
          <button onClick={generateNarration} disabled={generatingAudio || !script} className="w-full rounded-lg bg-blue-700 px-3 py-2 font-bold text-white">{generatingAudio ? 'Generating narration…' : audioUrl ? 'Regenerate AI narration' : 'Generate AI narration'}</button>
          {audioUrl && <audio controls src={audioUrl} className="w-full" />}
        </div>}
        {(soundMode==='music' || soundMode==='narration_music') && <label className="block text-sm font-bold">Background music
          <select value={musicTrack} onChange={e=>setMusicTrack(e.target.value)} className="mt-2 w-full rounded-xl border px-3 py-3 text-base"><option value="">No music track selected</option>{musicTracks.map((t,i)=><option key={t.url || i} value={t.url}>{t.title || ('Track '+(i+1))}</option>)}</select>
        </label>}
        <div className="space-y-3 rounded-xl border p-3">
          <h3 className="font-black">Stock background</h3>
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <input value={backgroundQuery} onChange={e=>setBackgroundQuery(e.target.value)} placeholder="e.g. chemistry lab, students studying" className="min-w-0 rounded-xl border px-3 py-2 text-base" />
            <button type="button" onClick={searchBackgrounds} disabled={searchingBackgrounds} className="rounded-xl bg-slate-900 px-3 py-2 font-bold text-white">{searchingBackgrounds ? 'Searching…' : 'Search'}</button>
          </div>
          <div className="flex flex-wrap gap-3 text-sm">
            <label><input type="radio" checked={backgroundKind==='video'} onChange={()=>{setBackgroundKind('video');setBackgrounds([]);setSelectedBackground(null);}} /> Stock video</label>
            <label><input type="radio" checked={backgroundKind==='photo'} onChange={()=>{setBackgroundKind('photo');setBackgrounds([]);setSelectedBackground(null);}} /> Photo</label>
            <button type="button" onClick={()=>setSelectedBackground(null)} className="ml-auto underline">Use gradient</button>
          </div>
          {backgroundError && <p className="text-xs text-amber-700">{backgroundError}</p>}
          {backgrounds.length > 0 && <div className="grid grid-cols-2 gap-2">{backgrounds.map((b,i)=><button type="button" key={b.url || i} onClick={()=>setSelectedBackground(b)} className={'overflow-hidden rounded-lg border-2 text-left '+(selectedBackground?.url===b.url?'border-blue-600':'border-transparent')}><div className="flex h-20 items-center justify-center bg-slate-200 text-xs">{(b.thumbnail || b.previewUrl) ? <img src={b.thumbnail || b.previewUrl} alt="" className="h-full w-full object-cover" /> : <span>{backgroundKind==='video'?'Stock video':'Stock photo'}</span>}</div><span className="block truncate px-2 py-1 text-xs">{b.title || b.photographer || ('Result '+(i+1))}</span></button>)}</div>}
          {selectedBackground && <p className="text-xs font-semibold text-green-700">Selected background: {selectedBackground.title || selectedBackground.photographer || 'Stock media'}</p>}
          <p className="text-xs text-gray-500">If a stock clip cannot play, the preview falls back to the gradient.</p>
        </div>
        <label className="block text-sm font-bold">Caption reveal
          <select value={captionMode} onChange={e=>setCaptionMode(e.target.value)} className="mt-2 w-full rounded-xl border px-3 py-3 text-base"><option value="scene">Full phrase / scene</option><option value="word">Reveal one word at a time</option></select>
        </label>
        <label className="block text-sm font-bold">Caption font
          <select value={fontFamily} onChange={e=>setFontFamily(e.target.value)} className="mt-2 w-full rounded-xl border px-3 py-3 text-base"><option value="Impact">Impact — bold viral</option><option value="Arial Black">Arial Black — heavy clean</option><option value="Arial">Arial — simple</option><option value="Georgia">Georgia — editorial</option><option value="Trebuchet MS">Trebuchet — modern</option><option value="Courier New">Courier — typewriter</option></select>
        </label>
        <label className="block text-sm font-bold">Caption animation
          <select value={style} onChange={e=>setStyle(e.target.value)} className="mt-2 w-full rounded-xl border px-3 py-3 text-base"><option value="pop">Bold pop-in</option><option value="clean">Clean kinetic text</option></select>
        </label>
        <button onClick={generate} disabled={busy} className="w-full rounded-xl bg-blue-700 px-4 py-3 font-black text-white disabled:opacity-50">{busy ? 'AI IS WRITING…' : '✨ Generate script'}</button>
        {error && <p role="alert" className="text-sm font-semibold text-red-600">{error}</p>}
        {generatedBlob && <section className="space-y-3 rounded-2xl border border-blue-200 bg-blue-50 p-4"><h2 className="text-lg font-black">Your video is ready</h2><p className="text-sm text-gray-700">The video has been downloaded to your device. You can also save a copy to your SBA Supabase media library.</p><div className="flex flex-wrap gap-2"><button type="button" onClick={()=>{const url=URL.createObjectURL(generatedBlob);const a=document.createElement('a');a.href=url;a.download='shiney-brain-video-'+Date.now()+'.webm';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}} className="rounded-xl border bg-white px-4 py-3 font-bold">Download again</button><button type="button" onClick={saveToSupabase} disabled={savingToCloud} className="rounded-xl bg-blue-700 px-4 py-3 font-bold text-white">{savingToCloud?'Saving to Supabase…':'Save to Supabase'}</button></div>{savedVideo && <div className="space-y-2 rounded-xl border bg-white p-3"><p className="font-bold text-green-700">Saved to your SBA content library.</p><a className="break-all text-sm text-blue-700 underline" href={savedVideo.videoUrl} target="_blank" rel="noreferrer">Open saved video</a><a className="block text-sm underline" href="/admin/social-engine">Open Social Engine</a><PublishToChannels contentAssetId={savedVideo.contentAssetId} /></div>}</section>}
        {script && <div className="rounded-xl bg-blue-50 p-3"><p className="font-bold">{script.title}</p><p className="mt-1 text-sm text-gray-600">{script.scenes.length} caption scenes · {seconds}s · {ratio}</p><button onClick={recordVideo} disabled={recording} className="mt-3 w-full rounded-xl bg-yellow-400 px-4 py-3 font-black text-slate-950 disabled:opacity-60">{recording ? 'Recording… please keep this tab open' : '⬇ Record & download video'}</button>{recording&&<p className="mt-2 text-sm">Recording video for {seconds} seconds…</p>}</div>}
      </div>
      <div className="space-y-3">
        <div className="overflow-hidden rounded-2xl bg-slate-950 p-3">
          <div className="mx-auto max-w-full" style={{width: ratio==='9:16'?'min(100%, 300px)':ratio==='1:1'?'min(100%, 360px)':'100%'}}>
            <canvas ref={canvasRef} className="block h-auto w-full rounded-lg" aria-label="Animated bold text video preview" />
          </div>
          {!script && <p className="p-8 text-center text-sm text-white/70">Generate a script to preview the animated captions here.</p>}
        </div>
        {script && <div className="rounded-xl border p-4"><h2 className="font-bold">Script preview</h2><div className="mt-2 space-y-2">{script.scenes.map((s,i)=><p key={i} className="border-l-4 border-yellow-400 pl-3 text-sm"><strong>{s.label || 'SCENE'}</strong> — {s.text}</p>)}</div></div>}
        <p className="text-xs text-gray-500">Exports animated text as WebM with the selected AI narration and/or music mixed into the video.</p>
      </div>
    </section>
  </main>;
}
