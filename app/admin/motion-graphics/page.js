'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Player } from '@remotion/player';
import {
  AlertCircle, CheckCircle2, Clapperboard, Download, Film, Loader2,
  Music4, Pause, Play, Plus, RefreshCw, Sparkles, Trash2, Volume2, Wand2, X,
} from 'lucide-react';
import { MotionGraphicsVideo } from '@/remotion/motion/MotionGraphicsVideo';

const ORIENTATIONS = ['9:16', '16:9', '1:1'];
const INTENSITIES = ['calm', 'balanced', 'bold'];
const MUSIC_STYLES = [
  { value: 'auto', label: 'Auto (fits the direction)' },
  { value: 'pulse', label: 'Pulse — rhythmic, energetic' },
  { value: 'tech', label: 'Tech — arpeggios, digital' },
  { value: 'cinematic', label: 'Cinematic — pads, swells' },
  { value: 'epic', label: 'Epic — drums, brass swells' },
  { value: 'chill', label: 'Chill — soft, editorial' },
  { value: 'dark', label: 'Dark — tension, drone' },
  { value: 'bright', label: 'Bright — pop, cheerful' },
];

const STAGES = [
  { key: 'queued', label: 'Queued' },
  { key: 'direction', label: 'Creative Direction' },
  { key: 'narrating', label: 'Narration' },
  { key: 'audio', label: 'Music & SFX' },
  { key: 'rendering', label: 'Render' },
  { key: 'uploading', label: 'Upload' },
  { key: 'done', label: 'Ready' },
];

const LAYOUT_LABELS = {
  kineticHeadline: 'Kinetic headline',
  counterFocus: 'Number counter',
  dataViz: 'Data visualization',
  splitCompare: 'Split comparison',
  flowSteps: 'Step-by-step flow',
  staggerList: 'Staggered list',
  questionReveal: 'Question reveal',
  quoteCard: 'Quote card',
  definitionCard: 'Definition card',
  radialBurst: 'Radial burst',
  gridReveal: 'Grid reveal',
  spotlight: 'Spotlight',
  timelineTrack: 'Timeline',
  waveFocus: 'Waveform focus',
};

const ACTIVE_PROJECT_STATUSES = new Set(['queued', 'directing', 'rendering']);

function stageIndex(stage) {
  if (!stage) return 0;
  if (stage === 'direction_ready') return STAGES.length - 1;
  const idx = STAGES.findIndex((s) => s.key === stage);
  return idx === -1 ? 0 : idx;
}

function formatBytes(bytes) {
  if (!bytes) return '—';
  if (bytes > 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

function formatDuration(seconds) {
  const s = Math.round(seconds || 0);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function PaletteSwatches({ palette }) {
  if (!palette) return null;
  const colors = [
    ['Background', palette.bg], ['Alt', palette.bgAlt], ['Ink', palette.ink],
    ['Accent', palette.accent], ['Accent 2', palette.accent2],
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {colors.map(([label, color]) => (
        <div key={label} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5">
          <span className="h-4 w-4 rounded border border-slate-300" style={{ background: color }} />
          <span className="text-xs font-medium text-slate-600">{label}</span>
          <code className="text-[11px] text-slate-400">{color}</code>
        </div>
      ))}
    </div>
  );
}

export default function MotionGraphicsStudioPage() {
  const [projects, setProjects] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [project, setProject] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [sceneDrafts, setSceneDrafts] = useState({});
  const [regenerating, setRegenerating] = useState(null);
  const [savingScenes, setSavingScenes] = useState(false);
  const [previewPlaying, setPreviewPlaying] = useState(true);
  const pollRef = useRef(null);

  // form state
  const [script, setScript] = useState('');
  const [topic, setTopic] = useState('');
  const [orientation, setOrientation] = useState('9:16');
  const [visualIntensity, setVisualIntensity] = useState('balanced');
  const [musicStyle, setMusicStyle] = useState('auto');
  const [narrationMode, setNarrationMode] = useState('tts');
  const [narrationUrl, setNarrationUrl] = useState('');
  const [useSfx, setUseSfx] = useState(true);
  const [subtitles, setSubtitles] = useState(true);

  const workerOnline = useMemo(() => {
    if (!workers.length) return false;
    const last = Math.max(...workers.map((w) => new Date(w.last_seen_at).getTime()));
    return Date.now() - last < 90_000;
  }, [workers]);

  const loadList = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/motion-graphics', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not load projects.');
      setProjects(data.projects || []);
      setWorkers(data.workers || []);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadProject = useCallback(async (id) => {
    const response = await fetch(`/api/admin/motion-graphics?id=${id}`, { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Could not load the project.');
    setProject(data.project);
    setJobs(data.jobs || []);
    return data.project;
  }, []);

  useEffect(() => { loadList(); }, [loadList]);

  useEffect(() => {
    const anyActive = projects.some((p) => ACTIVE_PROJECT_STATUSES.has(p.status));
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      await loadList();
      if (selectedId) loadProject(selectedId).catch(() => {});
    }, anyActive || selectedId ? 5000 : 20000);
    return () => clearInterval(pollRef.current);
  }, [projects, selectedId, loadList, loadProject]);

  const selectProject = async (id) => {
    setSelectedId(id);
    setProject(null);
    setSceneDrafts({});
    try {
      await loadProject(id);
    } catch (err) {
      setError(err.message);
    }
  };

  const createProject = async () => {
    setCreating(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/motion-graphics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          script,
          topic,
          orientation,
          visualIntensity,
          musicStyle: musicStyle === 'auto' ? null : musicStyle,
          narrationMode,
          narrationUrl,
          useSfx,
          subtitles,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not create the project.');
      setScript('');
      setTopic('');
      await loadList();
      await selectProject(data.project.id);
      setNotice('Project created — the creative direction is being generated.');
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const enqueue = async (jobType) => {
    setError(null);
    try {
      const response = await fetch('/api/admin/motion-graphics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'enqueue', projectId: project.id, jobType }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not queue the job.');
      await loadList();
      await loadProject(project.id);
    } catch (err) {
      setError(err.message);
    }
  };

  const saveSceneText = async () => {
    setSavingScenes(true);
    setError(null);
    try {
      const scenes = project.scenes.map((scene) => ({
        id: scene.id,
        heading: sceneDrafts[scene.id]?.heading ?? scene.heading,
        narration: sceneDrafts[scene.id]?.narration ?? scene.narration,
      }));
      const response = await fetch('/api/admin/motion-graphics', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update', projectId: project.id, scenes }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not save scene edits.');
      setProject(data.project);
      setSceneDrafts({});
      setNotice('Scene text saved.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingScenes(false);
    }
  };

  const regenerateScene = async (sceneId) => {
    setRegenerating(sceneId);
    setError(null);
    try {
      const response = await fetch('/api/admin/motion-graphics', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'regen-scene', projectId: project.id, sceneId, bump: Date.now() % 997 }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not regenerate the scene.');
      await loadProject(project.id);
      setNotice('Scene composition regenerated.');
    } catch (err) {
      setError(err.message);
    } finally {
      setRegenerating(null);
    }
  };

  const updateSettings = async (patch) => {
    setError(null);
    try {
      const response = await fetch('/api/admin/motion-graphics', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update', projectId: project.id, ...patch }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not update settings.');
      setProject(data.project);
    } catch (err) {
      setError(err.message);
    }
  };

  const deleteProject = async (id) => {
    if (!window.confirm('Delete this project and its jobs?')) return;
    await fetch(`/api/admin/motion-graphics?id=${id}`, { method: 'DELETE' });
    if (selectedId === id) { setSelectedId(null); setProject(null); }
    await loadList();
  };

  const direction = project?.direction?.direction;
  const previewSpec = useMemo(() => {
    if (!project?.direction?.direction || !project?.scenes?.length) return null;
    return {
      direction: project.direction.direction,
      scenes: project.scenes,
      musicPlan: project.direction.musicPlan,
      title: project.title,
      seed: project.direction.seed,
    };
  }, [project]);
  const previewAudio = useMemo(() => {
    if (!project) return {};
    return {
      musicUrl: project.audio_meta?.music?.url || null,
      narration: project.narration || {},
      sfx: project.use_sfx === false ? {} : (project.audio_meta?.sfx || {}),
    };
  }, [project]);
  const previewFrames = useMemo(() => {
    if (!previewSpec) return 90;
    return Math.max(60, Math.ceil((previewSpec.scenes.reduce((a, s) => a + (s.durationSeconds || 3), 0) + 0.5) * 30));
  }, [previewSpec]);
  const previewDimensions = previewSpec
    ? (project.orientation === '16:9' ? { width: 1920, height: 1080 }
      : project.orientation === '1:1' ? { width: 1080, height: 1080 }
      : { width: 1080, height: 1920 })
    : { width: 1080, height: 1920 };

  const stageOfProject = (p) => {
    if (p.status === 'direction_ready') return STAGES.length - 1;
    if (p.status === 'ready') return STAGES.length - 1;
    if (p.status === 'failed') return -1;
    return stageIndex(p.stage);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-extrabold text-slate-900">
            <Clapperboard className="h-7 w-7 text-brand-blue" />
            Motion Graphics Studio
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Dynamic motion graphics engine — every video gets its own visual language built from the script.
          </p>
        </div>
        <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold ${workerOnline ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
          <span className={`h-2 w-2 rounded-full ${workerOnline ? 'bg-emerald-500' : 'bg-amber-500'}`} />
          {workerOnline ? 'Render worker online' : 'No worker seen in the last 90s'}
        </div>
      </header>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600"><X className="h-4 w-4" /></button>
        </div>
      )}
      {notice && (
        <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)} className="ml-auto text-emerald-400 hover:text-emerald-600"><X className="h-4 w-4" /></button>
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-500">
          <Plus className="h-4 w-4" /> New project
        </h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <label className="block text-sm font-medium text-slate-700">
              Script <span className="text-slate-400">(optional — leave empty and the engine writes one from the topic)</span>
            </label>
            <textarea
              value={script}
              onChange={(e) => setScript(e.target.value)}
              rows={7}
              placeholder={'Paste a narration script. Short sentences work best — one idea per sentence.'}
              className="w-full rounded-xl border border-slate-300 p-3 text-sm focus:border-brand-blue focus:outline-none"
            />
            <div className="flex items-center gap-2">
              <input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Topic (used when no script, and as the project title)"
                className="flex-1 rounded-xl border border-slate-300 p-3 text-sm focus:border-brand-blue focus:outline-none"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700">Format</label>
              <select value={orientation} onChange={(e) => setOrientation(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-sm">
                {ORIENTATIONS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Visual intensity</label>
              <select value={visualIntensity} onChange={(e) => setVisualIntensity(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-sm">
                {INTENSITIES.map((i) => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700">Music</label>
              <select value={musicStyle} onChange={(e) => setMusicStyle(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-sm">
                {MUSIC_STYLES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Narration</label>
              <select value={narrationMode} onChange={(e) => setNarrationMode(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-sm">
                <option value="tts">AI voice-over</option>
                <option value="uploaded">Uploaded track</option>
                <option value="silent">Silent (music only)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Sound effects</label>
              <div className="mt-1 flex h-[42px] items-center gap-4 rounded-xl border border-slate-300 px-3">
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={useSfx} onChange={(e) => setUseSfx(e.target.checked)} /> SFX</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={subtitles} onChange={(e) => setSubtitles(e.target.checked)} /> Subtitles</label>
              </div>
            </div>
            {narrationMode === 'uploaded' && (
              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-700">Narration audio URL (mp3/wav, scenes are mapped to it automatically)</label>
                <input
                  value={narrationUrl}
                  onChange={(e) => setNarrationUrl(e.target.value)}
                  placeholder="https://.../narration.mp3"
                  className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-sm"
                />
              </div>
            )}
            <div className="col-span-2">
              <button
                type="button"
                onClick={createProject}
                disabled={creating || (!script.trim() && !topic.trim())}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-blue px-4 py-3 text-sm font-bold text-white transition hover:bg-brand-blue/90 disabled:opacity-50"
              >
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                {creating ? 'Creating...' : 'Create project & generate creative direction'}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 p-5">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Projects</h2>
        </div>
        {loading ? (
          <div className="flex items-center gap-2 p-6 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading...</div>
        ) : projects.length === 0 ? (
          <div className="p-6 text-sm text-slate-500">No projects yet — create your first motion graphics video above.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {projects.map((p) => {
              const stageIdx = stageOfProject(p);
              return (
                <div key={p.id} className={`p-4 transition ${selectedId === p.id ? 'bg-slate-50' : 'hover:bg-slate-50/60'}`}>
                  <div className="flex flex-wrap items-center gap-3">
                    <button type="button" onClick={() => selectProject(p.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white">
                        <Film className="h-5 w-5 text-brand-blue" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-bold text-slate-900">{p.title}</span>
                        <span className="block text-xs text-slate-500">
                          {p.orientation} · {p.visual_intensity} · {p.narration_mode}
                          {p.direction_label ? ` · ${p.direction_label}` : ''}
                          {p.duration_seconds ? ` · ${formatDuration(p.duration_seconds)}` : ''}
                        </span>
                      </span>
                    </button>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                        p.status === 'ready' ? 'bg-emerald-100 text-emerald-700'
                        : p.status === 'failed' ? 'bg-red-100 text-red-700'
                        : p.status === 'direction_ready' ? 'bg-sky-100 text-sky-700'
                        : 'bg-amber-100 text-amber-700'}`}>
                        {p.status}
                      </span>
                      {p.video_url && (
                        <a href={p.video_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100">
                          <Download className="h-3.5 w-3.5" /> MP4 {formatBytes(p.video_size_bytes)}
                        </a>
                      )}
                      <button type="button" onClick={() => deleteProject(p.id)} className="rounded-lg border border-slate-200 p-2 text-slate-400 hover:bg-red-50 hover:text-red-500" aria-label="Delete project">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  {ACTIVE_PROJECT_STATUSES.has(p.status) && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>{p.stage_message || p.stage}</span>
                        <span>{p.progress}%</span>
                      </div>
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-brand-blue transition-all" style={{ width: `${p.progress}%` }} />
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {STAGES.map((s, i) => (
                          <span key={s.key} className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            p.status === 'failed' && p.stage === s.key ? 'bg-red-100 text-red-600'
                            : i < stageIdx ? 'bg-emerald-100 text-emerald-600'
                            : i === stageIdx ? 'bg-brand-blue text-white' : 'bg-slate-100 text-slate-400'}`}>
                            {s.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {p.status === 'failed' && p.error_message && (
                    <p className="mt-2 text-xs text-red-600">{p.error_message}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {project && (
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-lg font-extrabold text-slate-900">
              <Sparkles className="h-5 w-5 text-brand-blue" /> {project.title}
            </h2>
            <div className="flex flex-wrap gap-2">
              {project.status === 'direction_ready' && (
                <button type="button" onClick={() => enqueue('render')} className="flex items-center gap-2 rounded-xl bg-brand-blue px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-blue/90">
                  <Clapperboard className="h-4 w-4" /> Generate video
                </button>
              )}
              {['direction_ready', 'ready'].includes(project.status) && (
                <button type="button" onClick={() => enqueue('direction')} className="flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                  <RefreshCw className="h-4 w-4" /> Regenerate direction
                </button>
              )}
              {project.status === 'failed' && (
                <button
                  type="button"
                  onClick={() => enqueue(jobs[0]?.job_type === 'render' ? 'render' : 'direction')}
                  className="flex items-center gap-2 rounded-xl border border-red-300 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50"
                >
                  <RefreshCw className="h-4 w-4" /> Retry failed job
                </button>
              )}
            </div>
          </div>

          {project.status === 'failed' && project.error_message && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{project.error_message}</div>
          )}

          {direction && (
            <div className="grid gap-4 lg:grid-cols-[1fr_1.25fr]">
              {/* Direction preview */}
              <div className="space-y-3 rounded-xl border border-slate-200 p-4">
                <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Creative direction</h3>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-brand-blue px-3 py-1 text-xs font-bold text-white">{direction.label}</span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{project.direction.analysis?.domain}</span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{direction.motion?.personality}</span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">energy {Math.round((direction.motion?.energy || 0.6) * 100)}%</span>
                </div>
                <PaletteSwatches palette={direction.palette} />
                <div className="text-sm text-slate-600">
                  <p><span className="font-semibold">Typography:</span> {direction.typography?.display} + {direction.typography?.body}</p>
                  <p className="mt-1 flex items-center gap-2"><Music4 className="h-4 w-4 text-slate-400" /> {project.direction.musicPlan?.style} · {project.direction.musicPlan?.tempo} BPM</p>
                  <p className="mt-1 flex items-center gap-2"><Volume2 className="h-4 w-4 text-slate-400" /> SFX: {direction.sfxKit?.join(', ')}</p>
                  <p className="mt-1">Transitions: {direction.transitions?.join(', ')}</p>
                </div>
                {/* Live player preview */}
                {previewSpec && (
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Visual preview</h3>
                      <button type="button" onClick={() => setPreviewPlaying((v) => !v)} className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800">
                        {previewPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                        {previewPlaying ? 'Pause' : 'Play'}
                      </button>
                    </div>
                    <div className="flex justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-950 p-3">
                      <div style={{ maxHeight: 420, display: 'flex' }}>
                        <Player
                          key={`${project.id}-${previewFrames}-${project.scenes?.length}-${project.audio_meta?.music?.url || 'nomusic'}`}
                          component={MotionGraphicsVideo}
                          durationInFrames={previewFrames}
                          fps={30}
                          compositionWidth={previewDimensions.width}
                          compositionHeight={previewDimensions.height}
                          autoPlay={previewPlaying}
                          controls
                          loop
                          style={{ maxWidth: '100%', maxHeight: 400 }}
                          inputProps={{
                            spec: previewSpec,
                            audio: previewAudio,
                            orientation: project.orientation,
                            subtitles: project.subtitles !== false,
                            brandLine: project.brand_line || 'Shiney Brain Academy',
                          }}
                        />
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-slate-400">
                      In-browser preview of the exact composition the worker renders (narration plays once audio is generated).
                    </p>
                  </div>
                )}
                {project.video_url && (
                  <div>
                    <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Rendered video</h3>
                    <video src={project.video_url} controls className="w-full rounded-xl border border-slate-200" />
                    <a href={project.video_url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-brand-blue hover:underline">
                      <Download className="h-3.5 w-3.5" /> Download MP4 ({formatBytes(project.video_size_bytes)})
                    </a>
                  </div>
                )}
              </div>

              {/* Scene list */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    Scenes ({project.scenes?.length || 0})
                    {project.status === 'direction_ready' ? ' — editable' : ''}
                  </h3>
                  {project.status === 'direction_ready' && project.scenes?.length > 0 && (
                    <button
                      type="button"
                      onClick={saveSceneText}
                      disabled={savingScenes || Object.keys(sceneDrafts).length === 0}
                      className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
                    >
                      {savingScenes ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                      Save text edits
                    </button>
                  )}
                </div>
                <div className="max-h-[560px] space-y-3 overflow-y-auto pr-1">
                  {(project.scenes || []).map((scene) => (
                    <div key={scene.id} className="rounded-xl border border-slate-200 p-3.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-md bg-slate-900 px-2 py-0.5 text-[11px] font-bold text-white">{scene.id}</span>
                        <span className="rounded-md bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700">{LAYOUT_LABELS[scene.layout] || scene.layout}</span>
                        <span className="text-[11px] text-slate-400">{scene.camera} · {scene.transition?.type} · {scene.durationSeconds}s</span>
                        {project.status === 'direction_ready' && (
                          <button
                            type="button"
                            onClick={() => regenerateScene(scene.id)}
                            disabled={regenerating === scene.id}
                            className="ml-auto flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                          >
                            {regenerating === scene.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                            New composition
                          </button>
                        )}
                      </div>
                      <p className="mt-2 text-xs font-bold uppercase tracking-wide text-slate-500">{scene.heading}</p>
                      {project.status === 'direction_ready' ? (
                        <textarea
                          rows={2}
                          value={sceneDrafts[scene.id]?.narration ?? scene.narration}
                          onChange={(e) => setSceneDrafts((d) => ({ ...d, [scene.id]: { ...(d[scene.id] || {}), narration: e.target.value } }))}
                          className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-sm"
                        />
                      ) : (
                        <p className="mt-1 text-sm text-slate-700">{scene.narration}</p>
                      )}
                      {scene.emphasis?.length > 0 && (
                        <p className="mt-1.5 text-xs text-slate-400">Emphasis: {scene.emphasis.join(', ')}</p>
                      )}
                    </div>
                  ))}
                </div>

                <div className="rounded-xl border border-slate-200 p-4">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Render settings</h3>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <label className="text-xs font-semibold text-slate-600">
                      Music
                      <select
                        value={project.music_style || project.direction?.musicPlan?.style || 'auto'}
                        onChange={(e) => updateSettings({ musicStyle: e.target.value === 'auto' ? null : e.target.value })}
                        className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm"
                      >
                        <option value="auto">Auto</option>
                        {MUSIC_STYLES.filter((m) => m.value !== 'auto').map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                      </select>
                    </label>
                    <div className="flex flex-col justify-end gap-2 pb-2">
                      <label className="flex items-center gap-2 text-sm text-slate-700">
                        <input type="checkbox" checked={project.use_sfx !== false} onChange={(e) => updateSettings({ useSfx: e.target.checked })} /> Sound effects
                      </label>
                      <label className="flex items-center gap-2 text-sm text-slate-700">
                        <input type="checkbox" checked={project.subtitles !== false} onChange={(e) => updateSettings({ subtitles: e.target.checked })} /> Subtitles
                      </label>
                    </div>
                  </div>
                  {project.audio_meta?.music && (
                    <p className="mt-2 text-xs text-slate-400">
                      Music bed: {project.audio_meta.music.style} {project.audio_meta.music.tempo ? `· ${project.audio_meta.music.tempo} BPM` : ''} — re-rendered automatically when you change the style.
                    </p>
                  )}
                </div>

                {jobs.length > 0 && (
                  <div className="rounded-xl border border-slate-200 p-4">
                    <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Recent jobs</h3>
                    <div className="mt-2 space-y-1.5 text-xs text-slate-600">
                      {jobs.slice(0, 5).map((job) => (
                        <div key={job.id} className="flex items-center justify-between gap-2">
                          <span className="font-semibold">{job.job_type}</span>
                          <span className={job.status === 'completed' ? 'text-emerald-600' : job.status === 'failed' ? 'text-red-600' : 'text-amber-600'}>
                            {job.status} · attempt {job.attempt_count}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {!direction && !ACTIVE_PROJECT_STATUSES.has(project.status) && project.status !== 'failed' && (
            <p className="text-sm text-slate-500">Queue the creative direction to plan scenes and compositions.</p>
          )}
        </section>
      )}
    </div>
  );
}
