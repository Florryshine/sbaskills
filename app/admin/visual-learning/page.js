'use client';

// app/admin/visual-learning/page.js
// Visual Learning Studio: produce complete educational videos from a topic
// (or a pasted episode script) — script, narration, illustrations, music,
// motion and render happen on the free worker fleet. Mirrors the Stickman/
// Whiteboard studio conventions: server-owned stages, job list polling,
// worker liveness banner, retry for failed jobs, and an in-browser preview
// via @remotion/player (preview == render, same deterministic timeline).
//
// Pacing: every scene cycles through multiple images and no single image
// stays on screen longer than maxShotSeconds (default 3 seconds).

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { createBrowserClient } from '@/lib/supabase';
import { VisualLearningComposition } from './VisualLearningComposition';

const ASPECTS = [
  { value: '16:9', label: 'Widescreen 16:9 (YouTube)' },
  { value: '9:16', label: 'Vertical 9:16 (Shorts/TikTok)' },
  { value: '1:1', label: 'Square 1:1 (feed posts)' },
];
const STYLES = [
  { value: 'cartoon', label: 'Flat cartoon (explainer)' },
  { value: 'photo', label: 'Documentary photo (stock)' },
  { value: 'sketch', label: 'Ink sketch' },
];
const VOICES = [
  { value: 'warm_male', label: 'Warm male narrator (US)' },
  { value: 'bright_female', label: 'Bright female narrator (US)' },
  { value: 'calm_male', label: 'Calm documentary male (US)' },
  { value: 'friendly_female', label: 'Friendly female (Nigerian)' },
  { value: 'nigerian_male', label: 'Nigerian male (Nigerian)' },
  { value: 'uk_male', label: 'British male (UK)' },
];
const SHOT_PACES = [
  { value: 2, label: 'Fast — max 2s per image' },
  { value: 3, label: 'Standard — max 3s per image' },
  { value: 4, label: 'Relaxed — max 4s per image' },
];

const STAGES = [
  { key: 'queued', label: 'Queued' },
  { key: 'scripting', label: 'Writing script' },
  { key: 'imagery', label: 'Preparing shot illustrations' },
  { key: 'narrating', label: 'Narrating (free TTS)' },
  { key: 'timeline', label: 'Building timeline' },
  { key: 'rendering', label: 'Rendering video' },
  { key: 'saving', label: 'Saving + publishing' },
  { key: 'completed', label: 'Completed' },
];

const SAMPLE_SCRIPT_NOTE =
  'Leave empty to let the worker write the script (free LLM chain or built-in architect), or paste an episode JSON (scene grammar in visual-learning-engine/src/types.ts).';

async function readJson(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { error: `Server returned ${res.status} ${res.statusText || ''}: ${text.slice(0, 160).trim() || 'empty response'}` };
  }
}

function deriveStage(job) {
  if (!job) return null;
  if (job.status === 'ready') return 'completed';
  if (job.status === 'failed') return 'failed';
  if (job.stage) return job.stage;
  return job.claim_token ? job.status : 'queued';
}

function fmtDuration(seconds) {
  const s = Math.round(Number(seconds) || 0);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export default function VisualLearningPage() {
  const [mode, setMode] = useState('topic'); // topic | script
  const [topic, setTopic] = useState('');
  const [title, setTitle] = useState('');
  const [audience, setAudience] = useState('secondary school students preparing for exams');
  const [tone, setTone] = useState('warm, curious, slightly playful');
  const [targetSeconds, setTargetSeconds] = useState(120);
  const [aspect, setAspect] = useState('16:9');
  const [style, setStyle] = useState('cartoon');
  const [voice, setVoice] = useState('warm_male');
  const [maxShotSeconds, setMaxShotSeconds] = useState(3);
  const [music, setMusic] = useState(true);
  const [subtitles, setSubtitles] = useState(true);
  const [keyPoints, setKeyPoints] = useState('');
  const [autoPublish, setAutoPublish] = useState(true);
  const [script, setScript] = useState('');

  const [assets, setAssets] = useState([]);
  const [kaId, setKaId] = useState('');

  const [jobs, setJobs] = useState([]);
  const [jobId, setJobId] = useState(null);
  const [job, setJob] = useState(null);
  const [worker, setWorker] = useState(null);
  const [pollError, setPollError] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const pollRef = useRef(null);

  // Lesson picker: same pattern as the other studios — the admin RLS on
  // knowledge_assets lets the browser client read id/keyword/subject.
  useEffect(() => {
    const supabase = createBrowserClient();
    supabase
      .from('knowledge_assets')
      .select('id, keyword, subject')
      .order('created_at', { ascending: false })
      .limit(200)
      .then(({ data }) => setAssets(data || []));
  }, []);

  const loadJobs = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/visual-learning', { cache: 'no-store' });
      const data = await readJson(res);
      if (!res.ok) throw new Error(data.error || 'Could not load visual learning jobs.');
      setJobs(data.jobs || []);
      if (data.worker) setWorker(data.worker);
      setPollError('');
    } catch (err) {
      setPollError(err.message || 'Job list check failed');
    }
  }, []);

  const refreshJob = useCallback(async (id) => {
    const res = await fetch(`/api/admin/visual-learning?id=${encodeURIComponent(id)}`, { cache: 'no-store' });
    const data = await readJson(res);
    if (!res.ok) throw new Error(data.error || 'Could not refresh the job.');
    if (data.worker) setWorker(data.worker);
    if (data.job) setJob(data.job);
    return data.job;
  }, []);

  useEffect(() => {
    loadJobs();
    pollRef.current = setInterval(loadJobs, 8000);
    return () => clearInterval(pollRef.current);
  }, [loadJobs]);

  useEffect(() => {
    if (!jobId) return undefined;
    let cancelled = false;
    let timer = null;
    const poll = async () => {
      try {
        const current = await refreshJob(jobId);
        if (cancelled) return;
        if (current && (current.status === 'ready' || current.status === 'failed')) {
          loadJobs().catch(() => {});
          return; // terminal: stop polling
        }
      } catch (err) {
        if (!cancelled) setPollError(err.message || 'Status check failed');
      }
      if (!cancelled) timer = setTimeout(poll, 4000);
    };
    poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [jobId, refreshJob, loadJobs]);

  const selectJob = (id) => {
    setJobId(id);
    setJob(null);
    refreshJob(id).catch(() => {});
  };

  const submit = async () => {
    setError('');
    setNotice('');
    setSubmitting(true);
    try {
      const base = {
        title: title || undefined,
        audience,
        tone,
        targetSeconds,
        aspect,
        style,
        voice,
        maxShotSeconds,
        music,
        subtitles,
        knowledgeAssetId: kaId || undefined,
        autoPublish,
      };
      const payload =
        mode === 'topic'
          ? { ...base, useAI: true, topic, keyPoints: keyPoints.split('\n').map((k) => k.trim()).filter(Boolean) }
          : { ...base, topic: topic || undefined, script };
      const res = await fetch('/api/admin/visual-learning', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await readJson(res);
      if (!res.ok) {
        const problems = Array.isArray(data.problems) && data.problems.length ? `\n${data.problems.join('\n')}` : '';
        setError(`${data.error || 'Failed to create job'}${problems}`);
      } else {
        setNotice(mode === 'topic' ? `Queued — job ${data.job.id}. The worker writes the script, prepares shots, narrates and renders.` : `Queued job ${data.job.id}`);
        selectJob(data.job.id);
        loadJobs();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const retry = async () => {
    if (!job) return;
    setRetrying(true);
    try {
      const res = await fetch('/api/admin/visual-learning', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: job.id, action: 'retry' }),
      });
      const data = await readJson(res);
      if (!res.ok) {
        setError(data.error || 'Retry failed');
      } else {
        setError('');
        setNotice(`Re-queued — resuming at ${data.status}`);
        setJobId(null);
        setTimeout(() => selectJob(job.id), 0);
        loadJobs();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setRetrying(false);
    }
  };

  const stageIndex = (() => {
    const stage = deriveStage(job);
    const idx = STAGES.findIndex((s) => s.key === stage);
    return idx >= 0 ? idx : -1;
  })();
  const workerOnline = worker?.online;
  const activeJobs = jobs.filter((j) => !['ready', 'failed'].includes(j.status)).length;
  const shotCount = job?.image_manifest?.assets?.length || 0;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-4 md:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Visual Learning Studio</h1>
          <p className="text-sm text-gray-400 mt-1">
            Topic → script → narration → shot illustrations (≤{maxShotSeconds}s per image) → music → rendered video. 100% free pipeline.
          </p>
        </div>
        <Link href="/admin" className="text-sm text-indigo-300 hover:text-indigo-200 whitespace-nowrap">← Back to admin</Link>
      </div>

      {pollError ? (
        <div className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Job list check failed: {pollError}
        </div>
      ) : null}
      {worker && !worker.unknown && !workerOnline ? (
        <div className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          No render process is running right now. The GitHub Actions worker checks the queue automatically every 5 minutes, so new jobs should be picked up shortly. For an immediate test, run <strong>Visual Learning Worker</strong> from the repository's Actions tab.
        </div>
      ) : null}
      {worker?.online && activeJobs > 0 ? (
        <div className="mb-4 rounded-lg border border-indigo-500/40 bg-indigo-500/10 px-4 py-3 text-sm text-indigo-200">
          Worker online — {activeJobs} job(s) in progress.
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* -------- Creation form -------- */}
        <div className="lg:col-span-2 rounded-2xl border border-gray-800 bg-gray-900 p-5">
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setMode('topic')}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium ${mode === 'topic' ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
            >
              From topic
            </button>
            <button
              onClick={() => setMode('script')}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium ${mode === 'script' ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
            >
              Paste script
            </button>
          </div>

          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Topic</label>
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. Why your brain learns while you sleep"
            className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm mb-3 focus:border-indigo-500 outline-none"
          />

          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Episode title (optional)</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Sleep and Memory"
            className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm mb-3 focus:border-indigo-500 outline-none"
          />

          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Audience</label>
              <input
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm focus:border-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Tone</label>
              <input
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm focus:border-indigo-500 outline-none"
              />
            </div>
          </div>

          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">
            Target length: <span className="text-indigo-300">{fmtDuration(targetSeconds)}</span>
          </label>
          <input
            type="range"
            min={30}
            max={600}
            step={10}
            value={targetSeconds}
            onChange={(e) => setTargetSeconds(Number(e.target.value))}
            className="w-full mb-3"
          />

          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Format</label>
              <select value={aspect} onChange={(e) => setAspect(e.target.value)} className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm">
                {ASPECTS.map((a) => (
                  <option key={a.value} value={a.value}>{a.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Visual style</label>
              <select value={style} onChange={(e) => setStyle(e.target.value)} className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm">
                {STYLES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Narrator voice</label>
              <select value={voice} onChange={(e) => setVoice(e.target.value)} className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm">
                {VOICES.map((v) => (
                  <option key={v.value} value={v.value}>{v.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Image pacing</label>
              <select value={maxShotSeconds} onChange={(e) => setMaxShotSeconds(Number(e.target.value))} className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm">
                {SHOT_PACES.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
          </div>

          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Key points to cover (one per line, optional)</label>
          <textarea
            value={keyPoints}
            onChange={(e) => setKeyPoints(e.target.value)}
            rows={3}
            placeholder={'Sleep moves memories to long-term storage\nDeep sleep before midnight matters most\nNaps under 25 minutes boost recall'}
            className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm mb-3 focus:border-indigo-500 outline-none"
          />

          {mode === 'script' ? (
            <>
              <label className="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Episode script JSON</label>
              <textarea
                value={script}
                onChange={(e) => setScript(e.target.value)}
                rows={8}
                placeholder='{ "meta": {...}, "scenes": [ ... ] }'
                className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-xs font-mono mb-1 focus:border-indigo-500 outline-none"
              />
              <p className="text-xs text-gray-500 mb-3">{SAMPLE_SCRIPT_NOTE}</p>
            </>
          ) : null}

          <div className="grid grid-cols-2 gap-3 mb-3">
            <label className="flex items-center gap-2 text-sm text-gray-300">
              <input type="checkbox" checked={music} onChange={(e) => setMusic(e.target.checked)} className="rounded border-gray-600 bg-gray-950" />
              Background music
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-300">
              <input type="checkbox" checked={subtitles} onChange={(e) => setSubtitles(e.target.checked)} className="rounded border-gray-600 bg-gray-950" />
              Word-synced captions
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-300">
              <input type="checkbox" checked={autoPublish} onChange={(e) => setAutoPublish(e.target.checked)} className="rounded border-gray-600 bg-gray-950" />
              Auto-queue publishing
            </label>
          </div>

          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Ground in a lesson (optional)</label>
          <select value={kaId} onChange={(e) => setKaId(e.target.value)} className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm mb-4">
            <option value="">— no lesson —</option>
            {assets.map((a) => (
              <option key={a.id} value={a.id}>
                {(a.subject || 'general').toUpperCase()} · {a.keyword}
              </option>
            ))}
          </select>

          <button
            onClick={submit}
            disabled={submitting || (mode === 'topic' ? !topic.trim() : !script.trim())}
            className="w-full rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-400 px-4 py-3 text-sm font-semibold"
          >
            {submitting ? 'Queuing…' : mode === 'topic' ? 'Generate + render video' : 'Render video from script'}
          </button>

          {error ? <div className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200 whitespace-pre-wrap">{error}</div> : null}
          {notice ? <div className="mt-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">{notice}</div> : null}
        </div>

        {/* -------- Job detail + preview -------- */}
        <div className="lg:col-span-3 space-y-6">
          {job ? (
            <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <h2 className="font-semibold text-lg">{job.title}</h2>
                  <p className="text-xs text-gray-400">
                    {job.id} · attempt {job.attempt_count ?? 1} · {job.aspect || ''} {job.style ? `· ${job.style}` : ''}
                    {job.script_provider ? ` · script: ${job.script_provider}${job.used_fallback ? ' (fallback)' : ''}` : ''}
                    {shotCount ? ` · ${shotCount} image shots` : ''}
                  </p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap ${
                    job.status === 'ready'
                      ? 'bg-emerald-500/15 text-emerald-300'
                      : job.status === 'failed'
                        ? 'bg-red-500/15 text-red-300'
                        : 'bg-indigo-500/15 text-indigo-300'
                  }`}
                >
                  {job.status}
                </span>
              </div>

              {/* Stage stepper */}
              <div className="flex flex-wrap gap-1.5 mb-4">
                {STAGES.map((s, i) => {
                  const done = stageIndex > i || job.status === 'ready';
                  const active = deriveStage(job) === s.key;
                  const failed = job.status === 'failed' && active;
                  return (
                    <span
                      key={s.key}
                      className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                        failed
                          ? 'bg-red-500/15 text-red-300'
                          : active
                            ? 'bg-indigo-600 text-white'
                            : done
                              ? 'bg-emerald-500/15 text-emerald-300'
                              : 'bg-gray-800 text-gray-500'
                      }`}
                    >
                      {s.label}
                    </span>
                  );
                })}
              </div>

              {job.stage_message ? <p className="text-xs text-gray-400 mb-3">{job.stage_message}</p> : null}
              {job.error_message ? (
                <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200 mb-3 whitespace-pre-wrap">
                  {job.error_message}
                  {job.status === 'failed' ? (
                    <button onClick={retry} disabled={retrying} className="ml-2 underline hover:no-underline">
                      {retrying ? 'Retrying…' : 'Retry'}
                    </button>
                  ) : null}
                </div>
              ) : null}

              {job.status === 'ready' && job.video_url ? (
                <video src={job.video_url} controls className="w-full rounded-xl bg-black" />
              ) : job.timeline && job.script ? (
                <div>
                  <p className="text-xs text-gray-400 mb-2">Live preview (same deterministic timeline the renderer uses):</p>
                  <div className="rounded-xl overflow-hidden bg-gray-950" style={{ maxHeight: 520 }}>
                    <VisualLearningComposition job={job} />
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-gray-700 p-6 text-center text-sm text-gray-500">
                  Preview appears once the worker has built the timeline.
                </div>
              )}

              {job.duration_seconds ? (
                <p className="text-xs text-gray-400 mt-3">Duration: {fmtDuration(job.duration_seconds)}</p>
              ) : null}
              {job.video_url ? (
                <a href={job.video_url} target="_blank" rel="noreferrer" className="inline-block mt-2 text-xs text-indigo-300 hover:text-indigo-200">
                  Open video URL ↗
                </a>
              ) : null}
            </div>
          ) : null}

          {/* -------- Job list -------- */}
          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">Recent jobs</h2>
              <span className="text-xs text-gray-500">
                worker: {worker ? (worker.online ? 'online' : worker.unknown ? `unknown (${worker.reason || 'no table yet'})` : 'offline') : 'checking…'}
              </span>
            </div>
            {jobs.length === 0 ? (
              <p className="text-sm text-gray-500">No jobs yet — create your first visual learning video.</p>
            ) : (
              <ul className="divide-y divide-gray-800">
                {jobs.map((j) => (
                  <li key={j.id} className="py-3 flex items-center justify-between gap-3">
                    <button onClick={() => selectJob(j.id)} className="text-left min-w-0 flex-1 group">
                      <p className="text-sm font-medium truncate group-hover:text-indigo-300">{j.title}</p>
                      <p className="text-xs text-gray-500 truncate">
                        {new Date(j.created_at).toLocaleString()} · {j.status}
                        {j.duration_seconds ? ` · ${fmtDuration(j.duration_seconds)}` : ''}
                      </p>
                    </button>
                    <div className="flex items-center gap-2 whitespace-nowrap">
                      {j.status === 'failed' ? (
                        <button
                          onClick={async () => {
                            const res = await fetch('/api/admin/visual-learning', {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ id: j.id, action: 'retry' }),
                            });
                            if (res.ok) loadJobs();
                          }}
                          className="text-xs rounded-lg bg-gray-800 hover:bg-gray-700 px-2.5 py-1.5"
                        >
                          Retry
                        </button>
                      ) : null}
                      {j.status === 'ready' ? (
                        <a href={j.video_url} target="_blank" rel="noreferrer" className="text-xs rounded-lg bg-emerald-500/15 text-emerald-300 px-2.5 py-1.5 hover:bg-emerald-500/25">
                          Watch ↗
                        </a>
                      ) : (
                        <span className="text-xs text-indigo-300">{deriveStage(j)}</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
