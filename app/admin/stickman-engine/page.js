'use client';

// app/admin/stickman-engine/page.js
// Stickman Animation Studio: generate an original stickman lesson from a
// topic or a selected Knowledge Asset (AI), or paste a SceneScript JSON.
// Mirrors the Whiteboard Studio conventions: server-owned stages, job list
// polling, worker liveness + dispatch banners, retry for failed jobs, and an
// in-browser timeline preview. The finished MP4 is a plain <video> element.

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { createBrowserClient } from '@/lib/supabase';
import { StickmanEngineComposition } from './StickmanEngineComposition';

const SUBJECTS = ['biology', 'chemistry', 'physics', 'mathematics', 'general'];

// Each step is only shown as running when the backend has really reached it:
// the stage column is advanced by the worker (claim_stickman_job + setStage),
// never by the UI.
const STAGES = [
  { key: 'queued', label: 'Queued' },
  { key: 'scripting', label: 'Writing stickman script (AI)' },
  { key: 'narrating', label: 'Generating narration (free TTS)' },
  { key: 'rendering', label: 'Rendering stickman animation' },
  { key: 'uploading', label: 'Uploading video' },
  { key: 'completed', label: 'Completed' },
];
const STALE_LEASE_MS = 5 * 60 * 1000;

const SAMPLE_SCRIPT_NOTE =
  'Leave empty and enable AI above, or paste a SceneScript JSON (see stickman-engine/src/rig/character.ts).';

// Vercel/proxy errors come back as plain text ("An error occurred…"), not JSON.
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

function prettyJson(text) {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return String(text || '');
  }
}

export default function StickmanEnginePage() {
  const [useAI, setUseAI] = useState(true);
  const [topic, setTopic] = useState('');
  const [subject, setSubject] = useState('physics');
  const [assets, setAssets] = useState([]);
  const [kaId, setKaId] = useState('');
  const [autoPublish, setAutoPublish] = useState(true);

  const [script, setScript] = useState('');
  const [title, setTitle] = useState('');
  const [editingScriptId, setEditingScriptId] = useState(null);
  const [savedScripts, setSavedScripts] = useState([]);

  const [jobs, setJobs] = useState([]);
  const [jobId, setJobId] = useState(null);
  const [job, setJob] = useState(null);
  const [worker, setWorker] = useState(null);
  const [dispatch, setDispatch] = useState(null);
  const [pollError, setPollError] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [now, setNow] = useState(Date.now());
  const pollRef = useRef(null);

  // Lesson picker: same pattern as lesson-loops — the admin RLS on
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

  const loadScripts = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/stickman-engine/scripts', { cache: 'no-store' });
      const data = await readJson(res);
      if (res.ok) setSavedScripts(data.scripts || []);
    } catch { /* the library list is best-effort */ }
  }, []);

  useEffect(() => { loadScripts(); }, [loadScripts]);

  const loadJobs = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/stickman-engine', { cache: 'no-store' });
      const data = await readJson(res);
      if (!res.ok) throw new Error(data.error || 'Could not load stickman jobs.');
      setJobs(data.jobs || []);
      if (data.worker) setWorker(data.worker);
      if (data.dispatch) setDispatch(data.dispatch);
      setPollError('');
    } catch (err) {
      setPollError(err.message || 'Job list check failed');
    }
  }, []);

  const refreshJob = useCallback(async (id) => {
    const res = await fetch(`/api/admin/stickman-engine?id=${encodeURIComponent(id)}`, { cache: 'no-store' });
    const data = await readJson(res);
    if (!res.ok) throw new Error(data.error || 'Could not refresh stickman job.');
    if (data.worker) setWorker(data.worker);
    if (data.dispatch) setDispatch(data.dispatch);
    if (data.job) setJob(data.job);
    return data.job;
  }, []);

  useEffect(() => {
    loadJobs();
    pollRef.current = setInterval(loadJobs, 8000);
    return () => clearInterval(pollRef.current);
  }, [loadJobs]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

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
      const payload = useAI
        ? { useAI: true, topic, subject, knowledgeAssetId: kaId || undefined, autoPublish }
        : { title: title || undefined, subject, script, knowledgeAssetId: kaId || undefined, autoPublish };
      const res = await fetch('/api/admin/stickman-engine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await readJson(res);
      if (!res.ok) {
        const problems = Array.isArray(data.problems) && data.problems.length
          ? `\n${data.problems.join('\n')}`
          : '';
        setError(`${data.error || 'Failed to create job'}${problems}`);
      } else {
        setNotice(useAI ? `Queued AI script generation — job ${data.job.id}` : `Queued job ${data.job.id}`);
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
      const res = await fetch('/api/admin/stickman-engine', {
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
        setJobId(null); // restart the polling loop for the same job
        setTimeout(() => selectJob(job.id), 0);
        loadJobs();
      }
    } finally {
      setRetrying(false);
    }
  };

  const saveScript = async () => {
    setError('');
    if (!script.trim()) {
      setError('Nothing to save — the script editor is empty.');
      return;
    }
    try {
      const res = await fetch('/api/admin/stickman-engine/scripts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingScriptId, title: title || undefined, subject, script }),
      });
      const data = await readJson(res);
      if (!res.ok) {
        const problems = Array.isArray(data.problems) && data.problems.length ? `\n${data.problems.join('\n')}` : '';
        setError(`${data.error || 'Save failed'}${problems}`);
      } else {
        setEditingScriptId(data.script.id);
        setTitle(data.script.title);
        setNotice(data.updated ? `Saved updates to "${data.script.title}"` : `Saved to script library as "${data.script.title}"`);
        loadScripts();
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const loadScriptFromLibrary = (s) => {
    setEditingScriptId(s.id);
    setTitle(s.title);
    setSubject(SUBJECTS.includes(s.subject) ? s.subject : 'general');
    const found = savedScripts.find((x) => x.id === s.id);
    if (found?.script_text) setScript(prettyJson(found.script_text));
    setUseAI(false);
    setNotice(`Loaded "${s.title}" into the editor`);
  };

  const deleteScript = async (s) => {
    if (!window.confirm(`Delete saved script "${s.title}"?`)) return;
    const res = await fetch(`/api/admin/stickman-engine/scripts?id=${encodeURIComponent(s.id)}`, { method: 'DELETE' });
    if (res.ok) {
      if (editingScriptId === s.id) setEditingScriptId(null);
      loadScripts();
    }
  };

  const reuseJobScript = async (j) => {
    try {
      const res = await fetch(`/api/admin/stickman-engine?id=${encodeURIComponent(j.id)}`, { cache: 'no-store' });
      const data = await readJson(res);
      if (!res.ok || !data.job?.script_text) throw new Error(data.error || 'This job has no script to reuse yet.');
      setScript(prettyJson(data.job.script_text));
      setTitle(data.job.title || '');
      setSubject(SUBJECTS.includes(data.job.subject) ? data.job.subject : 'general');
      setEditingScriptId(null);
      setUseAI(false);
      setNotice(`Loaded the script from "${data.job.title}" — edit it and queue a new job, or save it to the library`);
    } catch (err) {
      setError(err.message);
    }
  };

  const stage = deriveStage(job);
  const stepIndex = STAGES.findIndex((st) => st.key === stage);
  const active = !!job && job.status !== 'ready' && job.status !== 'failed';
  const heartbeatAge = job?.heartbeat_at ? now - new Date(job.heartbeat_at).getTime() : null;
  const leaseStale = active && stage !== 'queued' && heartbeatAge !== null && heartbeatAge > STALE_LEASE_MS;
  const queuedFor = job && stage === 'queued' ? now - new Date(job.created_at).getTime() : 0;
  const workerOffline = !!worker && !worker.unknown && !worker.online;
  const hasTimeline = !!job?.timeline && Array.isArray(job.timeline.audio);
  const audioUrlsReady = Array.isArray(job?.audio_files) && job.audio_files.some((a) => a && a.publicUrl);

  return (
    <div className="p-6 max-w-6xl mx-auto pb-24">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">Stickman Animation Studio</h1>
        <p className="text-sm text-gray-500 mt-1">
          Skeletal stickman lessons — pick a topic or a lesson, the AI writes an original SceneScript
          (two characters, actions, camera, formulas), the worker narrates it with free TTS and renders the MP4.
          Worker is {worker?.unknown ? 'unknown (apply migration 20261118210000)' : workerOnline(worker) ? 'online' : 'offline — start local-video-renderer/stickman-worker.js'}.
        </p>
      </header>

      <section className="grid gap-6 md:grid-cols-2">
        {/* Form */}
        <div className="rounded-xl border p-4 space-y-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={useAI} onChange={(e) => setUseAI(e.target.checked)} />
            Generate an original script with AI
          </label>

          {useAI && (
            <>
              <div>
                <label className="text-sm font-medium block mb-1">Topic</label>
                <input
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. Friction — why surfaces grip"
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Lesson (optional — grounds the story in real course content)</label>
                <select
                  value={kaId}
                  onChange={(e) => {
                    setKaId(e.target.value);
                    const found = assets.find((a) => a.id === e.target.value);
                    if (found?.keyword && !topic) setTopic(found.keyword);
                  }}
                  className="w-full rounded-lg border px-3 py-2 text-sm bg-white"
                >
                  <option value="">No lesson — free topic</option>
                  {assets.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.keyword} {a.subject ? `— ${a.subject}` : ''}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">
                  Reuses the lesson&apos;s Knowledge Asset instead of creating a duplicate one.
                </p>
              </div>
            </>
          )}

          {!useAI && (
            <div>
              <label className="text-sm font-medium block mb-1">SceneScript JSON</label>
              <textarea
                value={script}
                onChange={(e) => setScript(e.target.value)}
                rows={16}
                spellCheck={false}
                placeholder={SAMPLE_SCRIPT_NOTE}
                className="w-full rounded-lg border px-3 py-2 text-xs font-mono bg-gray-50"
              />
              <p className="text-xs text-gray-400 mt-1">
                {SAMPLE_SCRIPT_NOTE}
              </p>
            </div>
          )}

          {!useAI && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium block mb-1">Title override</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="defaults to script title"
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Subject</label>
                <select
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm bg-white"
                >
                  {SUBJECTS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
          {useAI && (
            <div>
              <label className="text-sm font-medium block mb-1">Subject</label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm bg-white"
              >
                {SUBJECTS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          )}

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={autoPublish} onChange={(e) => setAutoPublish(e.target.checked)} />
            Auto-queue social publishing when the video is ready
          </label>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={submit}
              disabled={submitting || (useAI ? !topic.trim() : !script.trim())}
              className="rounded-lg bg-sky-700 text-white px-4 py-2.5 text-sm font-medium hover:bg-sky-800 disabled:opacity-50"
            >
              {submitting ? (useAI ? 'Queueing AI generation…' : 'Validating script…') : useAI ? 'Generate stickman video' : 'Queue animation'}
            </button>
            {!useAI && (
              <button
                onClick={saveScript}
                disabled={!script.trim()}
                className="rounded-lg border border-sky-700 text-sky-700 px-3 py-2.5 text-sm hover:bg-sky-50 disabled:opacity-50"
              >
                {editingScriptId ? 'Save changes to library' : 'Save to library'}
              </button>
            )}
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm p-3 whitespace-pre-wrap">
              {error}
            </div>
          )}
          {notice && !error && (
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm p-3">
              {notice}
            </div>
          )}

          {/* Script library */}
          {!useAI && savedScripts.length > 0 && (
            <div>
              <h3 className="font-semibold text-sm mb-2">Script library ({savedScripts.length})</h3>
              <div className="rounded-lg border divide-y max-h-48 overflow-y-auto">
                {savedScripts.map((s) => (
                  <div key={s.id} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span className="truncate mr-2">
                      {s.title} <span className="text-xs text-gray-400">({s.subject}{s.topic ? `, ${s.topic}` : ''})</span>
                    </span>
                    <span className="flex gap-2 shrink-0">
                      <button onClick={() => loadScriptFromLibrary(s)} className="text-sky-700 hover:underline text-xs">Load</button>
                      <button onClick={() => deleteScript(s)} className="text-red-600 hover:underline text-xs">Delete</button>
                    </span>
                  </div>
                ))}
              </div>
              {editingScriptId && (
                <button
                  onClick={() => { setEditingScriptId(null); }}
                  className="text-xs text-gray-500 hover:underline mt-1"
                >
                  Save as a new script instead
                </button>
              )}
            </div>
          )}
        </div>

        {/* Status + preview */}
        <div className="rounded-xl border p-4 space-y-4">
          <h2 className="font-semibold text-sm">Job status</h2>
          {!job && <p className="text-sm text-gray-400">No active job. Create one on the left or pick one below.</p>}
          {job && (
            <>
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium">{job.title}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    job.status === 'ready'
                      ? 'bg-emerald-100 text-emerald-700'
                      : job.status === 'failed'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {stage === 'failed' ? 'failed' : stage === 'completed' ? 'ready' : (STAGES.find((st) => st.key === stage)?.label || job.status)}
                </span>
                {job.duration_seconds ? <span className="text-gray-400 text-xs">{Math.round(job.duration_seconds)}s</span> : null}
              </div>
              {job.stage_message && stage !== 'failed' && stage !== 'completed' && (
                <p className="text-xs text-gray-500">{job.stage_message}</p>
              )}

              {job.status === 'failed' && (
                <div className="space-y-2">
                  <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm p-3 whitespace-pre-wrap">
                    {job.error_message || 'The job failed without an error message.'}
                  </div>
                  <button
                    onClick={retry}
                    disabled={retrying}
                    className="rounded-lg border border-sky-700 text-sky-700 px-3 py-1.5 text-sm hover:bg-sky-50 disabled:opacity-50"
                  >
                    {retrying ? 'Re-queuing…' : 'Retry job'}
                  </button>
                </div>
              )}

              {active && (
                <div className="space-y-1 text-xs text-gray-500">
                  {STAGES.filter((st) => st.key !== 'completed').map((st, i) => {
                    const done = stepIndex > i;
                    const running = stepIndex === i;
                    return (
                      <div key={st.key} className="flex items-center gap-2">
                        <span className={done ? 'text-emerald-600' : running ? 'text-amber-500' : 'text-gray-300'}>
                          {done ? '✓' : '●'}
                        </span>
                        <span className={running ? 'text-gray-800 font-medium' : ''}>{st.label}</span>
                        {running && st.key !== 'queued' && <span className="animate-pulse">…</span>}
                        {running && st.key !== 'queued' && job.stage_message && (
                          <span className="text-gray-400">— {job.stage_message}</span>
                        )}
                      </div>
                    );
                  })}
                  {job.worker_id && (
                    <p className="pt-1 text-gray-400">
                      Worker {job.worker_id.slice(0, 28)} · attempt {job.attempt_count}
                      {heartbeatAge !== null && ` · last heartbeat ${Math.round(heartbeatAge / 1000)}s ago`}
                    </p>
                  )}
                </div>
              )}

              {active && stage === 'queued' && workerOffline && (
                <div className="rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm p-3">
                  {dispatch?.latest?.error_message?.startsWith('missing_token')
                    ? 'Automatic renderer dispatch is not configured. Add the GitHub dispatch token to Supabase Vault as github_dispatch_token.'
                    : dispatch?.latest?.http_status === 204
                      ? 'GitHub accepted the renderer request. The runner is starting and will claim this job automatically.'
                      : dispatch?.latest?.http_status >= 400
                        ? `GitHub rejected the renderer request (HTTP ${dispatch.latest.http_status}). Check the dispatch token permissions and repository access.`
                        : dispatch?.latest && !dispatch.latest.completed_at
                          ? 'Renderer start request sent. Waiting for GitHub to confirm the dispatch.'
                          : dispatch?.unknown
                            ? `Renderer dispatch status is unavailable: ${dispatch.reason}`
                            : 'No worker online. Start local-video-renderer/stickman-worker.js, or wait for the automatic GitHub runner dispatch.'}
                </div>
              )}
              {active && stage === 'queued' && worker?.last_error && (
                <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm p-3">
                  The worker is online but cannot claim jobs: {worker.last_error}
                </div>
              )}
              {active && stage === 'queued' && worker?.unknown && (
                <div className="rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm p-3">
                  Worker status is unavailable ({worker.reason}). Apply migration
                  20261118210000_stickman_engine_reliability.sql.
                </div>
              )}
              {active && stage === 'queued' && !workerOffline && !worker?.unknown && queuedFor > 120000 && (
                <div className="rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm p-3">
                  Queued for {Math.round(queuedFor / 60000)} min — a worker is online but busy with another job.
                </div>
              )}
              {leaseStale && (
                <div className="rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm p-3">
                  The worker stopped reporting {Math.round(heartbeatAge / 60000)} min ago. The job is picked up
                  again automatically, or marked failed after 3 interrupted attempts.
                </div>
              )}
              {pollError && (
                <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm p-3">
                  Can&apos;t refresh status: {pollError}. Still retrying…
                </div>
              )}

              {job.status === 'ready' && job.video_url && (
                <div className="space-y-2">
                  <video
                    key={job.id}
                    src={job.video_url}
                    controls
                    className="w-full rounded-lg bg-black"
                    style={{ maxHeight: 420 }}
                  />
                  <a
                    href={job.video_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block text-sky-700 text-sm hover:underline"
                  >
                    Open rendered video
                  </a>
                </div>
              )}

              {hasTimeline && audioUrlsReady && job.status !== 'failed' && (
                <div>
                  <h3 className="font-semibold text-sm mb-2">
                    Timeline preview ({job.timeline.scenes ? `${job.timeline.scenes.length} scenes` : `${Math.round((job.timeline.durationFrames || 0) / (job.timeline.fps || 30))}s`})
                  </h3>
                  <div className="rounded-lg overflow-hidden border bg-black" style={{ aspectRatio: `${job.timeline.width || 720} / ${job.timeline.height || 1280}`, maxHeight: 480, margin: '0 auto' }}>
                    <StickmanEngineComposition job={job} />
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    Plays the compiled timeline with the real narration audio; the MP4 render is identical.
                  </p>
                </div>
              )}

              {Array.isArray(job.warnings) && job.warnings.length > 0 && (
                <details className="text-xs text-gray-500">
                  <summary className="cursor-pointer">{job.warnings.length} note(s)</summary>
                  <ul className="list-disc pl-4 pt-1 space-y-1">
                    {job.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </details>
              )}

              {job.script_text && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-gray-500">Generated SceneScript</summary>
                  <pre className="mt-2 p-2 rounded bg-gray-50 overflow-auto max-h-64 text-[10px] font-mono whitespace-pre-wrap">{prettyJson(job.script_text)}</pre>
                  <button onClick={() => reuseJobScript(job)} className="text-sky-700 hover:underline mt-1">
                    Load this script into the editor to edit or reuse
                  </button>
                </details>
              )}
            </>
          )}

          {/* Recent jobs */}
          <div>
            <h2 className="font-semibold text-sm mb-2">Recent jobs</h2>
            <div className="rounded-lg border divide-y max-h-72 overflow-y-auto">
              {jobs.length === 0 && <p className="text-sm text-gray-400 p-3">No jobs yet.</p>}
              {jobs.map((j) => (
                <button
                  key={j.id}
                  onClick={() => selectJob(j.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-gray-50 text-left ${jobId === j.id ? 'bg-sky-50' : ''}`}
                >
                  <span className="truncate mr-2">
                    {j.title}
                    <span className="text-xs text-gray-400 ml-2">{j.subject || j.topic || ''}</span>
                  </span>
                  <span className={`text-xs shrink-0 ${
                    j.status === 'ready' ? 'text-emerald-700' : j.status === 'failed' ? 'text-red-600' : 'text-amber-600'
                  }`}>
                    {j.status === 'ready' ? 'ready' : j.stage || j.status}
                  </span>
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-1">Click a job, then open “Generated SceneScript” to reuse its script.</p>
          </div>
        </div>
      </section>

      <p className="text-xs text-gray-400 mt-8">
        Engine reference, the SceneScript schema and the renderer live in{' '}
        <code>stickman-engine/</code>. This page is protected by the admin
        middleware — see <Link href="/admin/dashboard" className="underline">Dashboard</Link>.
      </p>
    </div>
  );
}

function workerOnline(worker) {
  return !!worker && !worker.unknown && worker.online;
}
