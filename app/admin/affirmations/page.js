'use client';

import { useEffect, useRef, useState } from 'react';

const W = 720, H = 1280;
const STARTER = ['I WILL NOT FAIL.', 'I AM PREPARED FOR SUCCESS.', 'I AM CAPABLE OF SCORING 300+.', 'I WILL STAY FOCUSED.', 'EVERY DAY, I AM GETTING BETTER.', 'I WILL WALK INTO THAT EXAM HALL WITH CONFIDENCE.'];

function wrap(ctx, text, maxWidth) {
  const words = text.split(/\\s+/); const lines = []; let line = '';
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = word; } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

export default function AffirmationStudioPage() {
  const [text, setText] = useState(STARTER.join('\\n'));
  const [intro, setIntro] = useState('JAMB STUDENTS, SAY THIS AFTER ME');
  const [query, setQuery] = useState('peaceful sunrise nature scenery');
  const [background, setBackground] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [music, setMusic] = useState('');
  const [voice, setVoice] = useState('host_a');
  const [speed, setSpeed] = useState('0.8');
  const [emotion, setEmotion] = useState('calm');
  const [audioUrl, setAudioUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);
  const canvasRef = useRef(null), videoRef = useRef(null), rafRef = useRef(null);
  const recorderRef = useRef(null), chunksRef = useRef([]), audioCtxRef = useRef(null);
  const startRef = useRef(0), stopRef = useRef(null);

  const lines = text.split(/\\n+/).map(s => s.trim()).filter(Boolean);
  const duration = Math.max(12, lines.length * 4.5 + 3);

  useEffect(() => {
    fetch('/api/admin/quote-loops/audio-list').then(r=>r.json()).then(d=>setTracks(d.tracks||[])).catch(()=>{});
  }, []);

  useEffect(() => {
    const vid = videoRef.current;
    if (!vid || !background?.url) return;
    vid.crossOrigin = 'anonymous'; vid.src = background.url; vid.loop = true; vid.muted = true;
    vid.oncanplay = () => {}; vid.load();
  }, [background]);

  const findBackground = async () => {
    setBusy(true); setError('');
    try {
      const res = await fetch('/api/admin/affirmations/background', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query})});
      const data = await res.json(); if (!res.ok) throw new Error(data.error || 'Could not find stock footage');
      setBackground(data.background);
    } catch(e) { setError(e.message); } finally { setBusy(false); }
  };

  const generateVoice = async () => {
    if (!lines.length) return setError('Add at least one affirmation.');
    setBusy(true); setError('');
    try {
      const res = await fetch('/api/admin/affirmations/narration',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:[intro,...lines].join('. '),voice,speed:Number(speed),emotion})});
      const data=await res.json(); if(!res.ok) throw new Error(data.error||'Narration failed');
      setAudioUrl('data:'+data.mimeType+';base64,'+data.audioBase64);
    } catch(e) { setError(e.message); } finally { setBusy(false); }
  };

  useEffect(() => {
    const canvas=canvasRef.current; if(!canvas) return;
    const ctx=canvas.getContext('2d'); canvas.width=W; canvas.height=H;
    const draw=(now)=>{
      const elapsed=recording ? (now-startRef.current)/1000 : 0;
      const index=Math.max(0,Math.min(Math.max(0,lines.length-1),Math.floor(Math.max(0,elapsed-2)/4.5)));
      const local=Math.max(0,Math.min(1,(elapsed-2-index*4.5)/.8));
      const vid=videoRef.current;
      if(vid && vid.readyState>=2 && vid.videoWidth) {
        const scale=Math.max(W/vid.videoWidth,H/vid.videoHeight);
        const dw=vid.videoWidth*scale, dh=vid.videoHeight*scale;
        ctx.drawImage(vid,(W-dw)/2,(H-dh)/2,dw,dh);
      } else {
        const g=ctx.createLinearGradient(0,0,W,H); g.addColorStop(0,'#123b52');g.addColorStop(1,'#172554');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
      }
      const glow=ctx.createRadialGradient(W*.5,H*.42,20,W*.5,H*.42,H*.75);
      glow.addColorStop(0,'rgba(4,18,28,.10)');glow.addColorStop(1,'rgba(3,12,25,.72)');
      ctx.fillStyle=glow;ctx.fillRect(0,0,W,H);
      ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.fillStyle='rgba(255,255,255,.88)';ctx.font='700 22px Arial';ctx.letterSpacing='4px';
      ctx.fillText('SHINEY BRAIN ACADEMY',W/2,H*.13);
      ctx.letterSpacing='0px';
      const title = elapsed < 2 ? intro : (lines[index] || lines[0] || 'I WILL SUCCEED.');
      ctx.font='900 66px Arial';
      let wrapped=wrap(ctx,title.toUpperCase(),W*.84);
      while(wrapped.length>4 && ctx.font.match(/(\\d+)px/)[1]>38) { const n=Number(ctx.font.match(/(\\d+)px/)[1])-4;ctx.font='900 '+n+'px Arial';wrapped=wrap(ctx,title.toUpperCase(),W*.84); }
      const fs=Number(ctx.font.match(/(\\d+)px/)[1]), lineH=fs*1.22;
      const base=H*.49-(wrapped.length-1)*lineH/2;
      ctx.save();ctx.globalAlpha=elapsed<2?Math.min(1,elapsed/0.7):Math.min(1,local);
      ctx.translate(W/2, H*.49);ctx.scale(.96+.04*Math.min(1,local),.96+.04*Math.min(1,local));
      ctx.translate(-W/2,-H*.49);
      ctx.shadowColor='rgba(0,0,0,.65)';ctx.shadowBlur=22;ctx.fillStyle='#fff';ctx.strokeStyle='rgba(5,20,32,.75)';ctx.lineWidth=5;
      wrapped.forEach((ln,i)=>{const y=base+i*lineH;ctx.strokeText(ln,W/2,y);ctx.fillText(ln,W/2,y);});
      ctx.restore();
      ctx.fillStyle='rgba(255,255,255,.82)';ctx.font='500 22px Arial';ctx.fillText(elapsed<2?'TAKE A DEEP BREATH':'SAY IT WITH CONFIDENCE',W/2,H*.78);
      ctx.fillStyle='rgba(255,255,255,.75)';ctx.fillRect(W*.12,H*.91,W*.76,3);
      ctx.fillStyle='#facc15';ctx.fillRect(W*.12,H*.91,W*.76*Math.min(1,elapsed/duration),3);
      if(recording) setProgress(Math.min(1,elapsed/duration));
      rafRef.current=requestAnimationFrame(draw);
    };
    rafRef.current=requestAnimationFrame(draw);
    return ()=>{if(rafRef.current)cancelAnimationFrame(rafRef.current);};
  },[text,intro,recording,duration]);

  const startRecording=async()=>{
    if(!audioUrl) return setError('Generate the narration first.');
    if(!lines.length) return setError('Add affirmations first.');
    setError('');
    try {
      const Ctx=window.AudioContext||window.webkitAudioContext, ac=new Ctx();audioCtxRef.current=ac;
      const dest=ac.createMediaStreamDestination();
      const narration=new Audio(audioUrl);narration.crossOrigin='anonymous';
      const ns=ac.createMediaElementSource(narration);ns.connect(dest);
      const musicEl=music?new Audio(music):null;
      if(musicEl){musicEl.loop=true;musicEl.volume=1;const ms=ac.createMediaElementSource(musicEl);const gain=ac.createGain();gain.gain.value=.10;ms.connect(gain);gain.connect(dest);}
      await ac.resume();
      if(videoRef.current){videoRef.current.currentTime=0;await videoRef.current.play().catch(()=>{});}
      const stream=new MediaStream([...canvasRef.current.captureStream(30).getVideoTracks(),...dest.stream.getAudioTracks()]);
      const mime=['video/mp4;codecs=avc1.42E01E,mp4a.40.2','video/mp4','video/webm;codecs=vp9,opus','video/webm'].find(t=>MediaRecorder.isTypeSupported(t))||'';
      const rec=new MediaRecorder(stream,mime?{mimeType:mime}:undefined);chunksRef.current=[];
      rec.ondataavailable=e=>{if(e.data?.size)chunksRef.current.push(e.data);};
      rec.onstop=()=>{const blob=new Blob(chunksRef.current,{type:rec.mimeType||'video/webm'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='sba-jamb-affirmation.'+(blob.type.includes('mp4')?'mp4':'webm');a.click();setRecording(false);if(videoRef.current)videoRef.current.pause();ac.close().catch(()=>{});};
      recorderRef.current=rec;startRef.current=performance.now();rec.start(250);setRecording(true);
      await narration.play();
      if(musicEl) await musicEl.play().catch(()=>{});
      stopRef.current=setTimeout(()=>{if(rec.state==='recording')rec.stop();},Math.max(duration*1000,narration.duration*1000||0));
    } catch(e){setError(e.message||'Could not start recording. Try Chrome.');setRecording(false);}
  };

  return <main className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
    <header><p className="text-xs font-black uppercase tracking-[.25em] text-blue-600">SBA VIDEO STUDIO</p><h1 className="text-3xl font-black">Affirmation Studio</h1><p className="mt-2 max-w-2xl text-sm text-slate-600">Create calm, confidence-building videos for JAMB students with cinematic stock footage, slow narration and soft background music.</p></header>
    <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
      <section className="space-y-4 rounded-2xl border bg-white p-4">
        <label className="block text-sm font-bold">Opening message<input value={intro} onChange={e=>setIntro(e.target.value)} className="mt-2 w-full rounded-xl border p-3" /></label>
        <label className="block text-sm font-bold">Affirmations <span className="font-normal text-slate-500">— one affirmation per line</span><textarea value={text} onChange={e=>setText(e.target.value)} rows={9} className="mt-2 w-full rounded-xl border p-3 text-base leading-7" /></label>
        <div className="rounded-xl bg-blue-50 p-3 space-y-3">
          <h2 className="font-black">Narration</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-sm font-semibold">Voice<select value={voice} onChange={e=>setVoice(e.target.value)} className="mt-1 w-full rounded-lg border p-2"><option value="host_a">Ezinne — female</option><option value="host_b">Abeo — male</option></select></label>
            <label className="text-sm font-semibold">Speaking speed<select value={speed} onChange={e=>setSpeed(e.target.value)} className="mt-1 w-full rounded-lg border p-2"><option value=".7">Slow — 0.7×</option><option value=".8">Gentle — 0.8×</option><option value=".9">Natural — 0.9×</option><option value="1">Normal — 1.0×</option></select></label>
            <label className="text-sm font-semibold">Delivery<select value={emotion} onChange={e=>setEmotion(e.target.value)} className="mt-1 w-full rounded-lg border p-2"><option value="calm">Calm</option><option value="serious">Serious</option><option value="neutral">Neutral</option></select></label>
          </div>
          <button onClick={generateVoice} disabled={busy} className="rounded-xl bg-blue-700 px-4 py-3 font-bold text-white disabled:opacity-50">{busy?'Working…':'Generate slow narration'}</button>
          {audioUrl&&<audio controls src={audioUrl} className="w-full"/>}
        </div>
        <div className="rounded-xl border p-3 space-y-3">
          <h2 className="font-black">Scenery / stock background</h2>
          <label className="block text-sm font-semibold">Search scene<input value={query} onChange={e=>setQuery(e.target.value)} className="mt-1 w-full rounded-lg border p-2" placeholder="peaceful beach sunrise" /></label>
          <button onClick={findBackground} disabled={busy} className="rounded-xl border border-blue-700 px-4 py-2 font-bold text-blue-700 disabled:opacity-50">{busy?'Searching…':'Find stock video'}</button>
          {background&&<p className="text-sm text-emerald-700">Background selected: {background.source || 'Stock footage'}</p>}
          <p className="text-xs text-slate-500">If no stock clip is found, the video uses a calm branded gradient.</p>
        </div>
        <label className="block text-sm font-bold">Quiet background music<select value={music} onChange={e=>setMusic(e.target.value)} className="mt-2 w-full rounded-xl border p-3"><option value="">No music</option>{tracks.map((t,i)=><option key={t}>{t}</option>)}</select></label>
        <button onClick={startRecording} disabled={recording||!audioUrl} className="w-full rounded-xl bg-yellow-400 px-4 py-4 font-black text-slate-950 disabled:opacity-50">{recording?'Recording affirmation video…':'Create & download affirmation video'}</button>
        {recording&&<div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-blue-600" style={{width:(progress*100)+'%'}}/></div>}
        {error&&<p role="alert" className="text-sm font-semibold text-red-600">{error}</p>}
      </section>
      <aside className="space-y-3">
        <div className="overflow-hidden rounded-2xl bg-slate-950 p-3">
          <canvas ref={canvasRef} className="mx-auto block h-auto w-full max-w-[320px] rounded-xl"/>
          <p className="pt-3 text-center text-xs text-white/70">9:16 vertical preview</p>
        </div>
        <video ref={videoRef} className="hidden" playsInline muted crossOrigin="anonymous"/>
        {background?.sourceUrl&&<a href={background.sourceUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-700 underline">View stock source / licence details</a>}
        <div className="rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">Estimated video length: {Math.round(duration)} seconds · {lines.length} affirmations. Each affirmation holds on screen for several seconds so students can repeat it.</div>
      </aside>
    </div>
  </main>;
}
