'use client';
import { useEffect, useRef, useState } from 'react';

const W = 720, H = 1280;

export default function OverlayVideoStudio() {
  const video = useRef(null), canvas = useRef(null), music = useRef(null);
  const [videoUrl, setVideoUrl] = useState(''), [videoName, setVideoName] = useState('');
  const [musicUrl, setMusicUrl] = useState(''), [musicName, setMusicName] = useState('');
  const [query, setQuery] = useState(''), [results, setResults] = useState([]);
  const [text, setText] = useState('Wait for it…'), [color, setColor] = useState('#ffffff');
  const [size, setSize] = useState(54), [position, setPosition] = useState(65);
  const [boxColor, setBoxColor] = useState('#09284b'), [box, setBox] = useState(true);
  const [volume, setVolume] = useState(30), [busy, setBusy] = useState(false);
  const [searching, setSearching] = useState(false), [status, setStatus] = useState('Upload a video or search stock footage to begin.');

  useEffect(() => {
    let id;
    const paint = () => {
      const c = canvas.current, v = video.current;
      if (c) {
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#071b36'; ctx.fillRect(0, 0, W, H);
        if (v?.readyState >= 2 && v.videoWidth) {
          const scale = Math.max(W / v.videoWidth, H / v.videoHeight), sw = W / scale, sh = H / scale;
          ctx.drawImage(v, (v.videoWidth-sw)/2, (v.videoHeight-sh)/2, sw, sh, 0, 0, W, H);
        }
        ctx.font = `900 ${size}px Arial`;
        const lines = []; let line = '';
        text.split(/\\s+/).forEach(word => { const n = line ? line+' '+word : word; if (line && ctx.measureText(n).width > W-80) { lines.push(line); line=word; } else line=n; });
        if (line) lines.push(line);
        const lh = size*1.2, top = H*position/100-lines.length*lh/2;
        if (box && lines.length) { const bw = Math.min(W-32,Math.max(...lines.map(x=>ctx.measureText(x).width))+48); ctx.fillStyle=boxColor+'D9'; ctx.beginPath(); ctx.roundRect((W-bw)/2,top-18,bw,lines.length*lh+36,18); ctx.fill(); }
        ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillStyle=color; ctx.shadowColor='#00000099'; ctx.shadowBlur=8;
        lines.forEach((x,i)=>ctx.fillText(x,W/2,top+i*lh+lh/2,W-64)); ctx.shadowBlur=0;
      }
      id=requestAnimationFrame(paint);
    };
    id=requestAnimationFrame(paint); return ()=>cancelAnimationFrame(id);
  }, [text,color,size,position,boxColor,box,videoUrl]);

  function uploadVideo(file) { if (!file) return; if (!file.type.startsWith('video/')) return setStatus('Choose a video file.'); setVideoUrl(URL.createObjectURL(file)); setVideoName(file.name); setStatus('Video loaded. Add your text and music.'); }
  function uploadMusic(file) { if (!file) return; if (!file.type.startsWith('audio/')) return setStatus('Choose an audio file.'); setMusicUrl(URL.createObjectURL(file)); setMusicName(file.name); setStatus('Music loaded.'); }

  async function searchStock(e) {
    e.preventDefault(); if (!query.trim()) return; setSearching(true);
    try {
      const r=await fetch('/api/admin/bold-text-video/backgrounds',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query,kind:'video'})});
      const d=await r.json(); if(!r.ok) throw new Error(d.error||'Search failed');
      setResults(d.results||[]); setStatus(d.results?.length?'Choose a stock clip below.':(d.warning||'No clips found.'));
    } catch(err) { setStatus(err.message||'Stock search failed.'); } finally { setSearching(false); }
  }

  async function exportVideo() {
    const v=video.current,c=canvas.current; if(!v||!c||!videoUrl) return;
    if(!c.captureStream||!window.MediaRecorder) return setStatus('Export is not supported in this browser. Try Chrome.');
    let ac;
    try {
      setBusy(true); setStatus('Preparing export… keep this page open.'); v.currentTime=0;
      ac=new AudioContext(); const dest=ac.createMediaStreamDestination();
      if(music.current&&musicUrl) { const src=ac.createMediaElementSource(music.current),gain=ac.createGain(); gain.gain.value=volume/100; src.connect(gain); gain.connect(dest); }
      await ac.resume();
      const stream=new MediaStream([...c.captureStream(30).getVideoTracks(),...dest.stream.getAudioTracks()]);
      const type=['video/mp4','video/webm;codecs=vp9,opus','video/webm'].find(x=>MediaRecorder.isTypeSupported(x));
      const rec=new MediaRecorder(stream,type?{mimeType:type}:undefined),chunks=[];
      rec.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
      rec.onstop=()=>{const mime=rec.mimeType||type||'video/webm',blob=new Blob(chunks,{type:mime}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='shiney-brain-overlay.'+(mime.includes('mp4')?'mp4':'webm');a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);music.current?.pause();ac.close();setBusy(false);setStatus('Export complete · '+(blob.size/1048576).toFixed(1)+' MB');};
      rec.start(1000); await v.play(); if(musicUrl) await music.current.play().catch(()=>{}); setStatus('Recording video…');
      v.onended=()=>{if(rec.state!=='inactive')rec.stop();v.pause();music.current?.pause();};
    } catch(err) { ac?.close();setBusy(false);setStatus(err.message||'Export failed. Try a shorter clip.'); }
  }

  return <main className="mx-auto max-w-7xl space-y-5 pb-16">
    <header className="rounded-3xl bg-gradient-to-r from-blue-950 via-blue-800 to-blue-600 p-6 text-white"><p className="text-xs font-black tracking-[.25em] text-yellow-300">SHINEY BRAIN ACADEMY · CREATOR TOOLS</p><h1 className="mt-2 text-3xl font-black">Overlay Video Studio</h1><p className="mt-2 text-blue-100">Upload footage or search stock clips. Add music, style your text and export a vertical video.</p></header>
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="space-y-5 rounded-2xl border bg-white p-4 sm:p-6">
        <div><h2 className="text-lg font-extrabold">1. Background video</h2><label className="mt-3 block cursor-pointer rounded-xl border-2 border-dashed border-blue-200 bg-blue-50 p-5 text-center"><b>Upload video from your phone</b><span className="block text-xs text-slate-500">MP4, MOV or WebM</span><input className="mt-3 block w-full text-sm" type="file" accept="video/*" onChange={e=>uploadVideo(e.target.files?.[0])}/></label>{videoName&&<p className="mt-2 break-all text-xs text-slate-500">{videoName}</p>}
        <form onSubmit={searchStock} className="mt-4 flex gap-2"><input value={query} onChange={e=>setQuery(e.target.value)} className="min-w-0 flex-1 rounded-xl border p-3 text-sm" placeholder="Search: satisfying cutting, gaming, cooking…"/><button disabled={searching} className="rounded-xl bg-blue-700 px-4 text-sm font-bold text-white">{searching?'Searching…':'Search stock'}</button></form>
        <div className="mt-3 grid grid-cols-2 gap-3">{results.map((x,i)=><button key={x.url||i} onClick={()=>{setVideoUrl(x.url);setVideoName((x.source||'Stock')+' · '+(x.photographer||'creator'));setStatus('Stock clip selected. Preview before export.');}} className="overflow-hidden rounded-xl border p-2 text-left"><div className="aspect-video bg-slate-100">{x.previewUrl&&<img src={x.previewUrl} alt="" className="h-full w-full object-cover"/>}</div><p className="mt-1 text-xs font-bold capitalize">{x.source} · {x.durationSeconds||'?'}s</p><span className="text-xs text-blue-700">Use this clip</span></button>)}</div></div>
        <div className="border-t pt-4"><h2 className="text-lg font-extrabold">2. Background music</h2><input className="mt-3 block w-full text-sm" type="file" accept="audio/*" onChange={e=>uploadMusic(e.target.files?.[0])}/>{musicName&&<p className="mt-1 text-xs text-slate-500">{musicName}</p>}<label className="mt-3 block text-sm font-semibold">Music volume: {volume}%<input className="mt-2 w-full" type="range" min="0" max="100" value={volume} onChange={e=>setVolume(+e.target.value)}/></label></div>
        <div className="border-t pt-4"><h2 className="text-lg font-extrabold">3. Overlay text editor</h2><textarea className="mt-3 w-full rounded-xl border p-3 text-sm" rows={3} value={text} onChange={e=>setText(e.target.value)} placeholder="Type overlay text…"/><div className="mt-3 grid grid-cols-2 gap-4"><label className="text-sm font-semibold">Text colour<input className="mt-2 block h-10 w-full" type="color" value={color} onChange={e=>setColor(e.target.value)}/></label><label className="text-sm font-semibold">Box colour<input className="mt-2 block h-10 w-full" type="color" value={boxColor} onChange={e=>setBoxColor(e.target.value)}/></label><label className="col-span-2 text-sm font-semibold">Text size: {size}px<input className="mt-2 w-full" type="range" min="24" max="100" value={size} onChange={e=>setSize(+e.target.value)}/></label><label className="col-span-2 text-sm font-semibold">Vertical position: {position}%<input className="mt-2 w-full" type="range" min="15" max="88" value={position} onChange={e=>setPosition(+e.target.value)}/></label><label className="col-span-2 flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={box} onChange={e=>setBox(e.target.checked)}/> Show text background</label></div></div>
      </section>
      <section className="space-y-4 rounded-2xl border bg-slate-50 p-4 sm:p-6"><div className="flex items-center justify-between"><h2 className="text-lg font-extrabold">Live preview</h2><span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-800">9:16</span></div><div className="mx-auto max-w-[320px] overflow-hidden rounded-2xl bg-slate-950 shadow-xl"><canvas ref={canvas} width={W} height={H} className="block h-auto w-full"/></div><video ref={video} src={videoUrl||undefined} crossOrigin="anonymous" playsInline preload="auto" className="fixed -left-[2000px] top-0 h-px w-px opacity-0"/><audio ref={music} src={musicUrl||undefined} className="hidden"/><button onClick={()=>{const v=video.current;if(!v)return;if(v.paused){v.play();music.current?.play().catch(()=>{});}else{v.pause();music.current?.pause();}}} disabled={!videoUrl} className="w-full rounded-xl border bg-white p-3 font-bold text-blue-800 disabled:opacity-40">▶ Play / pause preview</button><button onClick={exportVideo} disabled={!videoUrl||busy} className="w-full rounded-xl bg-yellow-400 p-4 font-extrabold text-blue-950 disabled:opacity-40">{busy?'Exporting… keep this page open':'Export video to my phone'}</button><div className="rounded-xl bg-white p-4 text-sm"><b>Status</b><p className="mt-1 text-slate-600">{status}</p></div><p className="text-xs leading-5 text-slate-500">The editor uses MP4 when your browser supports it, otherwise WebM. Files remain on your device; nothing is uploaded to Supabase.</p></section>
    </div>
  </main>;
}