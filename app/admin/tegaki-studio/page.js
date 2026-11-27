'use client';

import { useEffect, useMemo, useState } from 'react';
import { Player } from '@remotion/player';
import { StudioComposition } from '@/remotion/StudioComposition';
import { TEGAKI_ENGINE, TEGAKI_VISUAL_STYLES, createTegakiLessonScene } from '@/lib/tegaki-engine/config';

const SUBJECTS = ['Biology', 'Chemistry', 'Physics'];
const SAMPLE = {
  heading: 'Cell Structure and Functions',
  text: 'Definition: A cell is the basic structural and functional unit of life.\n- The cell membrane controls what enters and leaves the cell.\n- The nucleus contains genetic material and controls cell activities.\n- Mitochondria release energy through aerobic respiration.\n- Ribosomes make proteins.\n- Plant cells have a cellulose cell wall, a large permanent vacuole and chloroplasts.',
};

export default function TegakiStudioPage() {
  const [subject, setSubject] = useState('Biology');
  const [assets, setAssets] = useState([]);
  const [assetId, setAssetId] = useState('');
  const [assetLoading, setAssetLoading] = useState(false);
  const [assetError, setAssetError] = useState('');
  const [heading, setHeading] = useState(SAMPLE.heading);
  const [text, setText] = useState(SAMPLE.text);
  const [duration, setDuration] = useState(40);
  const [style, setStyle] = useState('classic-notebook');
  const [brand, setBrand] = useState('SHINEY BRAIN ACADEMY');
  const [composed, setComposed] = useState(null);
  const [composeLoading, setComposeLoading] = useState(false);
  const [composeError, setComposeError] = useState('');
  const [voice, setVoice] = useState('host_a');
  const [emotion, setEmotion] = useState('neutral');
  const [narrationVolume, setNarrationVolume] = useState(1);
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioError, setAudioError] = useState('');
  const [audioReady, setAudioReady] = useState(false);
  const [aspectRatio, setAspectRatio] = useState('9:16');
  const [musicSrc, setMusicSrc] = useState('');
  const [musicName, setMusicName] = useState('');
  const [musicVolume, setMusicVolume] = useState(0.12);
  const [musicLoading, setMusicLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportError, setExportError] = useState('');
  const [exportJobs, setExportJobs] = useState([]);
  const [stylePreview, setStylePreview] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');

  useEffect(() => {
    let active = true;
    setAssetLoading(true);
    setAssetError('');
    fetch(`/api/admin/tegaki-studio/assets?subject=${encodeURIComponent(subject)}`)
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Unable to load topics.');
        return data.assets || [];
      })
      .then(rows => {
        if (!active) return;
        setAssets(rows);
        setAssetId(rows[0]?.id || '');
      })
      .catch(error => { if (active) setAssetError(error.message); })
      .finally(() => { if (active) setAssetLoading(false); });
    return () => { active = false; };
  }, [subject]);

  const fallbackScene = useMemo(() => createTegakiLessonScene({
    heading, text, durationSeconds: duration,
    illustrationCues: [{ at: 0, illustration: 'animal-cell', label: 'The cell' }],
  }), [heading, text, duration]);
  const activeScenes = composed?.scenes?.length ? composed.scenes : [fallbackScene];
  const activeTitle = composed?.title || heading;
  const activeFirstScene = activeScenes[0];
  const activeText = activeFirstScene?.text || text;
  const totalDuration = activeScenes.reduce((sum, item) => sum + (Number(item.durationSeconds) || 0), 0);
  const durationInFrames = Math.max(60, Math.round(totalDuration * 30));

  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      setPreviewLoading(true);
      setPreviewError('');
      try {
        const response = await fetch('/api/admin/tegaki-studio/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: activeFirstScene?.heading || heading, text: activeText, styleId: style, subject }),
        });
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Style preview failed.');
        }
        const blob = await response.blob();
        const nextUrl = URL.createObjectURL(blob);
        if (active) {
          setStylePreview(oldUrl => {
            if (oldUrl) URL.revokeObjectURL(oldUrl);
            return nextUrl;
          });
        } else URL.revokeObjectURL(nextUrl);
      } catch (error) {
        if (active) setPreviewError(error.message);
      } finally {
        if (active) setPreviewLoading(false);
      }
    }, 450);
    return () => { active = false; clearTimeout(timer); };
  }, [activeFirstScene?.heading, activeText, heading, style, subject]);

  useEffect(() => () => {
    if (stylePreview) URL.revokeObjectURL(stylePreview);
  }, [stylePreview]);

  async function generateNarration() {
    if (!composed?.scenes?.length) { setAudioError('Generate a structured lesson before creating its narration.'); return; }
    setAudioLoading(true); setAudioError('');
    try {
      const response = await fetch('/api/admin/tegaki-studio/narrate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ knowledgeAssetId: composed.knowledgeAssetId, scenes: composed.scenes, voice, emotion }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Narration generation failed.');
      const audioById = new Map((data.audio || []).map(item => [item.sceneId, item]));
      const scenes = composed.scenes.map(scene => {
        const audio = audioById.get(scene.id);
        return audio ? { ...scene, audioSrc: audio.audioSrc, durationSeconds: audio.durationSeconds, speechDurationSeconds: audio.speechDurationSeconds } : scene;
      });
      setComposed({ ...composed, scenes, durationSeconds: scenes.reduce((sum, scene) => sum + scene.durationSeconds, 0), audioProvider: data.voice, audioReusedCount: data.reusedCount });
      setAudioReady(true);
    } catch (error) { setAudioError(error.message); }
    finally { setAudioLoading(false); }
  }

  async function uploadMusic(file) {
    if (!file) return;
    setMusicLoading(true); setExportError('');
    try {
      const form = new FormData(); form.append('file', file);
      const response = await fetch('/api/admin/tegaki-studio/music', { method: 'POST', body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Music upload failed.');
      setMusicSrc(data.music.url); setMusicName(data.music.name);
    } catch (error) { setExportError(error.message); }
    finally { setMusicLoading(false); }
  }

  async function queueExport() {
    if (!composed?.scenes?.length) { setExportError('Generate a structured lesson first.'); return; }
    if (!audioReady || composed.scenes.some(scene => !scene.audioSrc)) { setExportError('Generate narration for every scene before exporting.'); return; }
    setExportLoading(true); setExportError('');
    try {
      const response = await fetch('/api/admin/tegaki-studio/export', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: composed.title, knowledgeAssetId: composed.knowledgeAssetId, scenes: composed.scenes, aspectRatio, styleId: style, brand, narrationVolume, musicSrc: musicSrc || null, musicVolume }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not queue MP4 export.');
      setExportJobs(current => [data.job, ...current.filter(item => item.id !== data.job.id)]);
    } catch (error) { setExportError(error.message); }
    finally { setExportLoading(false); }
  }

  async function retryExport(id) {
    try {
      const response = await fetch('/api/admin/tegaki-studio/export', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action: 'retry' }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Retry failed.');
      setExportJobs(current => current.map(item => item.id === id ? { ...item, status: 'queued', stage: 'queued', error_message: null } : item));
    } catch (error) { setExportError(error.message); }
  }

  async function composeLesson() {
    if (!assetId) { setComposeError('Select a Knowledge Asset topic first.'); return; }
    setComposeLoading(true);
    setComposeError('');
    try {
      const response = await fetch('/api/admin/tegaki-studio/compose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ knowledgeAssetId: assetId, durationSeconds: duration }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Lesson composition failed.');
      setComposed(data);
      setAudioReady(false); setAudioError('');
      setHeading(data.scenes[0]?.heading || data.title);
      setText(data.scenes[0]?.text || '');
    } catch (error) {
      setComposeError(error.message);
    } finally {
      setComposeLoading(false);
    }
  }

  const selectedStyle = TEGAKI_VISUAL_STYLES.find(item => item.id === style);
  const selectedAsset = assets.find(item => item.id === assetId);

  useEffect(() => {
    let active = true;
    const loadExports = async () => {
      try {
        const response = await fetch('/api/admin/tegaki-studio/export');
        const data = await response.json();
        if (response.ok && active) setExportJobs(data.jobs || []);
      } catch { /* export history is non-blocking for lesson composition */ }
    };
    loadExports();
    const timer = setInterval(loadExports, 5000);
    return () => { active = false; clearInterval(timer); };
  }, []);

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl bg-gradient-to-r from-blue-950 via-blue-800 to-sky-600 p-7 text-white shadow-lg">
          <p className="text-xs font-bold uppercase tracking-[.25em] text-sky-200">Shiney Brain Academy · Independent Video Engine</p>
          <h1 className="mt-2 text-3xl font-black md:text-4xl">{TEGAKI_ENGINE.name}</h1>
          <p className="mt-2 max-w-3xl text-sm text-blue-100">Turn a trusted Knowledge Asset into an illustrated handwritten lesson with generated Nigerian-English narration.</p>
          <span className="mt-4 inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-bold">Phase 4 · Animation and audio</span>
        </header>

        <div className="grid gap-6 xl:grid-cols-[.85fr_1.15fr]">
          <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div>
              <h2 className="text-lg font-black text-slate-900">Build a lesson</h2>
              <p className="mt-1 text-sm text-slate-500">Select a subject and an existing Knowledge Asset. The composer uses that source instead of inventing lesson facts.</p>
            </div>
            <label className="block text-sm font-semibold text-slate-700">Subject
              <select value={subject} onChange={e => { setSubject(e.target.value); setComposed(null); setAudioReady(false); }} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-3">
                {SUBJECTS.map(item => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label className="block text-sm font-semibold text-slate-700">Knowledge Asset topic
              <select value={assetId} onChange={e => { setAssetId(e.target.value); setComposed(null); setAudioReady(false); }} disabled={assetLoading || !assets.length} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 disabled:bg-slate-100">
                {assets.length ? assets.map(asset => <option key={asset.id} value={asset.id}>{asset.keyword}</option>) : <option>{assetLoading ? 'Loading topics…' : 'No topics found'}</option>}
              </select>
              {selectedAsset?.summary && <span className="mt-2 block text-xs leading-5 text-slate-500">{selectedAsset.summary.slice(0, 240)}{selectedAsset.summary.length > 240 ? '…' : ''}</span>}
              {assetError && <span role="alert" className="mt-2 block text-xs text-red-600">{assetError}</span>}
            </label>
            <label className="block text-sm font-semibold text-slate-700">Target video duration
              <select value={duration} onChange={e => setDuration(Number(e.target.value))} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-3">
                <option value={20}>20 seconds</option><option value={30}>30 seconds</option><option value={40}>40 seconds</option><option value={60}>60 seconds</option><option value={90}>90 seconds</option><option value={120}>2 minutes</option>
              </select>
            </label>
            <button type="button" onClick={composeLesson} disabled={composeLoading || assetLoading || !assetId} className="w-full rounded-xl bg-blue-700 px-4 py-3 font-bold text-white shadow-sm hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50">
              {composeLoading ? 'Composing lesson…' : 'Generate structured lesson'}
            </button>
            {composeError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{composeError}</p>}

            {composed && <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-black text-emerald-950">Lesson storyboard ready</h3><span className="text-xs font-semibold text-emerald-800">{composed.scenes.length} scenes · {composed.durationSeconds}s</span></div>
              <p className="text-xs text-emerald-900">Source: {composed.topic} · {composed.subject} · Provider: {composed.usedProvider || 'AI fallback chain'}</p>
              {composed.learningObjectives?.length > 0 && <div><p className="text-xs font-bold uppercase tracking-wide text-emerald-900">Learning objectives</p><ul className="mt-1 list-disc pl-5 text-sm text-emerald-950">{composed.learningObjectives.map((item,i) => <li key={i}>{item}</li>)}</ul></div>}
              <ol className="space-y-2">{composed.scenes.map((item,i) => <li key={item.id} className="rounded-lg bg-white/80 p-3"><p className="text-sm font-bold text-slate-900">{i+1}. {item.heading}</p><p className="mt-1 text-xs text-slate-600">{item.narration}</p><p className="mt-1 text-[11px] font-semibold text-blue-700">Illustration: {item.illustrationCues?.[0]?.illustration || 'No cue'}</p></li>)}</ol>
            </div>}

            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-3">
              <div><h3 className="font-black text-blue-950">Teacher narration</h3><p className="text-xs text-blue-800">Generate Nigerian-English voice audio for every storyboard scene. Reusable Knowledge Asset narration is cached.</p></div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-semibold text-slate-700">Voice<select value={voice} onChange={e => { setVoice(e.target.value); setAudioReady(false); }} className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2"><option value="host_a">Female · Ezinne / Kore</option><option value="host_b">Male · Abeo / Charon</option></select></label>
                <label className="text-xs font-semibold text-slate-700">Delivery style<select value={emotion} onChange={e => { setEmotion(e.target.value); setAudioReady(false); }} className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2">{['neutral','excited','curious','serious','calm','playful','dramatic','emphatic'].map(item => <option key={item} value={item}>{item[0].toUpperCase()+item.slice(1)}</option>)}</select></label>
              </div>
              <label className="block text-xs font-semibold text-slate-700">Narration volume · {Math.round(narrationVolume*100)}%<input type="range" min="0" max="1" step="0.05" value={narrationVolume} onChange={e => setNarrationVolume(Number(e.target.value))} className="mt-2 w-full" /></label>
              <button type="button" onClick={generateNarration} disabled={!composed || audioLoading} className="w-full rounded-lg bg-blue-700 px-3 py-2.5 text-sm font-bold text-white disabled:opacity-50">{audioLoading ? 'Generating scene narration…' : audioReady ? 'Regenerate narration' : 'Generate narration audio'}</button>
              {audioReady && <p className="text-xs font-semibold text-emerald-800">Narration attached to all scenes. {composed.audioReusedCount || 0} cached audio file(s) reused.</p>}
              {audioError && <p role="alert" className="text-xs text-red-700">{audioError}</p>}
            </div>

            <div className="rounded-xl border border-violet-200 bg-violet-50 p-4 space-y-3">
              <h3 className="font-black text-violet-950">Export settings</h3>
              <label className="block text-xs font-semibold text-slate-700">Video format<select value={aspectRatio} onChange={e => setAspectRatio(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2"><option value="9:16">9:16 · Reels / Shorts / TikTok</option><option value="16:9">16:9 · YouTube landscape</option><option value="1:1">1:1 · Square social video</option></select></label>
              <div><label className="block text-xs font-semibold text-slate-700">Background music · optional</label><input type="file" accept="audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/ogg,.mp3,.wav,.m4a,.ogg" onChange={e => uploadMusic(e.target.files?.[0])} className="mt-1 block w-full text-xs" />{musicLoading && <p className="mt-1 text-xs text-violet-800">Uploading music…</p>}{musicName && <p className="mt-1 text-xs font-semibold text-emerald-800">Attached: {musicName} <button type="button" onClick={() => { setMusicSrc(''); setMusicName(''); }} className="ml-2 underline">Remove</button></p>}</div>
              <label className="block text-xs font-semibold text-slate-700">Music volume · {Math.round(musicVolume*100)}%<input type="range" min="0" max="0.4" step="0.01" value={musicVolume} onChange={e => setMusicVolume(Number(e.target.value))} className="mt-2 w-full" /></label>
              <button type="button" onClick={queueExport} disabled={!composed || !audioReady || exportLoading || musicLoading} className="w-full rounded-lg bg-violet-700 px-3 py-3 text-sm font-black text-white disabled:opacity-50">{exportLoading ? 'Queueing MP4…' : 'Render and save MP4'}</button>
              <p className="text-[11px] text-violet-900">Exports run on the dedicated Remotion worker, not inside the website request. Completed videos are saved as drafts in Social Engine.</p>
              {exportError && <p role="alert" className="text-xs text-red-700">{exportError}</p>}
            </div>

            <div>
              <h3 className="text-sm font-bold text-slate-800">Visual style</h3>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {TEGAKI_VISUAL_STYLES.map(item => (
                  <button key={item.id} type="button" onClick={() => setStyle(item.id)} aria-pressed={style === item.id} className={`rounded-xl border p-3 text-left transition ${style === item.id ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-100' : 'border-slate-200 hover:border-blue-300'}`}>
                    <span className="block text-sm font-bold text-slate-800">{item.label}</span><span className="mt-1 block text-xs text-slate-500">Rendered page preview</span>
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div><h2 className="text-lg font-black text-slate-900">Rendered page style</h2><p className="text-sm text-slate-500">{selectedStyle?.label} · first storyboard scene</p></div>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">{previewLoading ? 'Rendering…' : 'PNG preview'}</span>
              </div>
              {stylePreview ? <img src={stylePreview} alt={`${selectedStyle?.label} Tegaki style preview`} className="mx-auto max-h-[620px] w-auto max-w-full rounded-lg border border-slate-200 shadow-md" /> : <div className="flex min-h-64 items-center justify-center rounded-xl bg-slate-100 text-sm text-slate-500">Your rendered preview will appear here.</div>}
              {previewError && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{previewError}</p>}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4"><h2 className="text-lg font-black text-slate-900">Full lesson preview</h2><p className="text-sm text-slate-500">{activeTitle} · {activeScenes.length} sequential scenes · {totalDuration}s</p></div>
              <div className="mx-auto overflow-hidden rounded-xl bg-slate-200 shadow-inner" style={{ maxWidth: aspectRatio === '16:9' ? 640 : 360 }}>
                <Player key={`${composed?.knowledgeAssetId || 'manual'}-${duration}-${activeScenes.length}`} component={StudioComposition}
                  inputProps={{ title: activeTitle, scenes: activeScenes, template: 'tegaki', brand, accent: '#f4c542', narrationVolume, aspectRatio }}
                  durationInFrames={durationInFrames} compositionWidth={aspectRatio === '16:9' ? 1920 : 1080} compositionHeight={aspectRatio === '1:1' ? 1080 : aspectRatio === '16:9' ? 1080 : 1920} fps={30} controls loop style={{ width: '100%', aspectRatio: aspectRatio.replace(':', ' / ') }} />
              </div>
              <p className="mt-3 text-xs text-slate-500">The preview combines sequential handwriting, SBA illustration cues and scene-level narration. Change the format in Export settings to preview the selected frame shape.</p>
            </div>
          </section>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-lg font-black text-slate-900">Export history</h2><p className="text-sm text-slate-500">Saved videos remain drafts until you review and approve them in Social Engine.</p></div><span className="text-xs text-slate-500">Auto-refreshes every 5 seconds</span></div>
          {!exportJobs.length ? <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">No Tegaki exports yet.</p> : <div className="space-y-2">{exportJobs.map(job => <div key={job.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3"><div className="min-w-0"><p className="truncate text-sm font-bold text-slate-900">{job.title}</p><p className="text-xs text-slate-500">{job.aspect_ratio} · {job.duration_seconds || '—'}s · {job.stage_message || job.status}</p>{job.error_message && <p className="mt-1 text-xs text-red-700">{job.error_message}</p>}</div><div className="flex flex-wrap items-center gap-2">{job.status === 'ready' && job.video_url && <a href={job.video_url} target="_blank" rel="noreferrer" className="rounded-lg bg-emerald-100 px-3 py-2 text-xs font-bold text-emerald-800">Open MP4</a>}{job.status === 'ready' && <a href="/admin/social-engine" className="rounded-lg bg-blue-100 px-3 py-2 text-xs font-bold text-blue-800">Open Social Drafts</a>}{job.status === 'failed' && <button type="button" onClick={() => retryExport(job.id)} className="rounded-lg bg-amber-100 px-3 py-2 text-xs font-bold text-amber-800">Retry</button>}<span className={`rounded-full px-3 py-1 text-xs font-bold ${job.status === 'ready' ? 'bg-emerald-100 text-emerald-800' : job.status === 'failed' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>{job.status}</span></div></div>)}</div>}
        </section>
      </div>
    </main>
  );
}
