'use client';

import { useEffect, useRef, useState } from 'react';

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
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);

  useEffect(() => {
    fetch('/api/admin/quote-loops/audio-list').then(r => r.json())
      .then(d => setMusicTracks(d.tracks || [])).catch(() => setMusicTracks([]));
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

  const generate = async () => {
    setBusy(true); setError(''); setScript(null);
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
    const draw = (now) => {
      const elapsed = ((now - start) / 1000) % total;
      const p = elapsed / total;
      const sceneIndex = Math.min(scenes.length - 1, Math.floor(p * scenes.length));
      const scene = scenes[sceneIndex] || { text: script.title || 'SHINEY BRAIN', emphasis: '' };
      const local = (p * scenes.length) % 1;
      lastProgress = p;
      setProgress(p);
      // Deep, lively gradient with animated light bands.
      const g = ctx.createLinearGradient(0, 0, W, H);
      const hue = (220 + elapsed * 13) % 360;
      g.addColorStop(0, '#071329'); g.addColorStop(.55, '#102f67'); g.addColorStop(1, `hsl(${hue}, 82%, 35%)`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
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
      const words = String(scene.text || '').trim().split(/\s+/).slice(0, 28);
      const fontSize = Math.round(Math.min(W*.105, H*.09, W*0.88 / Math.max(5, Math.min(11, Math.max(...words.map(w=>w.length), 5))*.55)));
      ctx.font = `1000 ${fontSize}px Impact, Arial Black, Arial`;
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
  }, [script, ratio, seconds, style]);

  const recordVideo = () => {
    const canvas = canvasRef.current;
    if (!canvas || !script) return;
    if (!canvas.captureStream || typeof MediaRecorder === 'undefined') {
      setError('Video recording is not supported by this browser. Try Chrome.'); return;
    }
    const videoStream = canvas.captureStream(30);
    let combinedStream = videoStream;
    let audioContext = null;
    try {
      const tracks = [...videoStream.getVideoTracks()];
      if (soundMode !== 'none') {
        audioContext = new AudioContext();
        const destination = audioContext.createMediaStreamDestination();
        if (soundMode === 'narration' || soundMode === 'narration_music') {
          if (!audioUrl) throw new Error('Generate AI narration first, or choose a mode without narration.');
          const narration = new Audio(audioUrl);
          const source = audioContext.createMediaElementSource(narration);
          source.connect(destination);
          await audioContext.resume();
          await narration.play();
        }
        if ((soundMode === 'music' || soundMode === 'narration_music') && musicTrack) {
          const music = new Audio(musicTrack); music.loop = true; music.volume = 0.2;
          const source = audioContext.createMediaElementSource(music);
          const gain = audioContext.createGain();
          gain.gain.value = soundMode === 'narration_music' ? 0.16 : 0.5;
          source.connect(gain); gain.connect(destination); music.play().catch(() => {});
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
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'shiney-brain-video-' + Date.now() + '.webm';
        document.body.appendChild(a); a.click(); a.remove();
        setRecording(false); videoStream.getTracks().forEach(t => t.stop());
        if (audioContext) audioContext.close().catch(() => {});
      };
      recorder.start(250); setRecording(true); setError('');
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
      <p className="mt-2 max-w-2xl text-sm text-gray-600">Generate a script for your chosen content type, then turn it into a bold, animated caption video you can download.</p>
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
          <select value={musicTrack} onChange={e=>setMusicTrack(e.target.value)} className="mt-2 w-full rounded-xl border px-3 py-3 text-base"><option value="">No music track selected</option>{musicTracks.map((t,i)=><option key={t.url || t.path || i} value={t.url || t.path}>{t.title || t.name || ('Track '+(i+1))}</option>)}</select>
        </label>}
        <label className="block text-sm font-bold">Caption animation
          <select value={style} onChange={e=>setStyle(e.target.value)} className="mt-2 w-full rounded-xl border px-3 py-3 text-base"><option value="pop">Bold pop-in</option><option value="clean">Clean kinetic text</option></select>
        </label>
        <button onClick={generate} disabled={busy} className="w-full rounded-xl bg-blue-700 px-4 py-3 font-black text-white disabled:opacity-50">{busy ? 'AI IS WRITING…' : '✨ Generate script'}</button>
        {error && <p role="alert" className="text-sm font-semibold text-red-600">{error}</p>}
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
