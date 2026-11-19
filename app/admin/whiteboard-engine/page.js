'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { WhiteboardEngineComposition } from './WhiteboardEngineComposition';

const SUBJECTS = ['biology', 'chemistry', 'physics', 'mathematics', 'general'];

const SAMPLE_SCRIPT = `@title Photosynthesis
@subject biology

scene title
heading: Photosynthesis
sub: How green plants make their own food
narration: Welcome to Shiney Brain Academy. Today we explore photosynthesis, the remarkable process green plants use to manufacture their own food.
draw: biology.plant scale:1.0
highlight: Photosynthesis style:underline

scene concept
heading: The Three Ingredients
narration: Photosynthesis needs three key ingredients. First, sunlight provides the energy. Second, water is absorbed from the soil through the roots.
draw: biology.sun scale:0.95 sync:sunlight
draw: biology.water-drop scale:0.95 sync:water
text: Light + Water + Carbon Dioxide
highlight: Three Ingredients style:underline
`;

// Each step is only shown as running when the backend has really reached it:
// the stage column is advanced by the worker (claim_whiteboard_job + setStage), never by the UI.
const STAGES = [
  { key: 'queued', label: 'Queued' },
  { key: 'scripting', label: 'Planning explanation & script' },
  { key: 'narrating', label: 'Generating narration' },
  { key: 'timeline', label: 'Building timeline' },
  { key: 'rendering', label: 'Rendering animation' },
  { key: 'uploading', label: 'Uploading video' },
  { key: 'completed', label: 'Completed' },
];
const STALE_LEASE_MS = 5 * 60 * 1000;

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
  // Rows from before the stage column: only claimed jobs are really running.
  return job.claim_token ? job.status : 'queued';
}

export default function WhiteboardEnginePage() {
  const [topic, setTopic] = useState('');
  const [subject, setSubject] = useState('biology');
  const [useAI, setUseAI] = useState(true);
  const [script, setScript] = useState(SAMPLE_SCRIPT);
  const [jobId, setJobId] = useState(null);
  const [job, setJob] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [jobs, setJobs] = useState([]);
  const [worker, setWorker] = useState(null);
  const [dispatch, setDispatch] = useState(null);
  const [pollError, setPollError] = useState('');
  const [retrying, setRetrying] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const refreshJob = useCallback(async (id) => {
    const res = await fetch(`/api/admin/whiteboard-engine?id=${encodeURIComponent(id)}`);
    const data = await readJson(res);
    if (!res.ok) throw new Error(data.error || 'Could not refresh whiteboard job.');
    setPollError('');
    if (data.worker) setWorker(data.worker);
    if (data.dispatch) setDispatch(data.dispatch);
    if (data.job) setJob(data.job);
    return data.job;
  }, []);

  const loadJobs = useCallback(async () => {
    const res = await fetch('/api/admin/whiteboard-engine');
    const data = await readJson(res);
    if (!res.ok) throw new Error(data.error || 'Could not load whiteboard jobs.');
    if (data.jobs) setJobs(data.jobs);
    if (data.worker) setWorker(data.worker);
    if (data.dispatch) setDispatch(data.dispatch);
  }, []);

  useEffect(() => {
    loadJobs().catch((err) => console.error('Whiteboard jobs could not be loaded:', err));
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
          loadJobs().catch((err) => console.error('Whiteboard job list refresh failed:', err));
          return;
        }
      } catch (err) {
        console.error('Whiteboard job polling failed:', err);
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

  const submit = async () => {
    setError('');
    setSubmitting(true);
    setJob(null);
    try {
      const res = await fetch('/api/admin/whiteboard-engine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, subject, script, useAI }),
      });
      const data = await readJson(res);
      if (!res.ok) {
        setError(data.error || 'Failed to create job');
      } else {
        setJobId(data.jobId);
        refreshJob(data.jobId);
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
      const res = await fetch('/api/admin/whiteboard-engine', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: job.id, action: 'retry' }),
      });
      const data = await readJson(res);
      if (!res.ok) {
        setError(data.error || 'Retry failed');
      } else {
        setError('');
        setJobId(null); // restart the polling loop for the same job
        setTimeout(() => setJobId(job.id), 0);
      }
    } finally {
      setRetrying(false);
    }
  };

  const stage = deriveStage(job);
  const stepIndex = STAGES.findIndex((st) => st.key === stage);
  const active = !!job && job.status !== 'ready' && job.status !== 'failed';
  const heartbeatAge = job?.heartbeat_at ? now - new Date(job.heartbeat_at).getTime() : null;
  const leaseStale = active && stage !== 'queued' && heartbeatAge !== null && heartbeatAge > STALE_LEASE_MS;
  const queuedFor = job && stage === 'queued' ? now - new Date(job.created_at).getTime() : 0;
  const workerOffline = !!worker && !worker.unknown && !worker.online;

  return (
    <div className="p-6 max-w-5xl mx-auto pb-24">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">Whiteboard Studio v3</h1>
        <p className="text-sm text-gray-500 mt-1">
          Paste an explainer script (or generate one with AI) — the engine progressively writes, draws and narrates
          the explanation in a synced whiteboard video.
        </p>
      </header>

      <section className="grid gap-6 md:grid-cols-2">
        {/* Form */}
        <div className="rounded-xl border p-4 space-y-4">
          <div>
            <label className="text-sm font-medium block mb-1">Topic (for AI generation)</label>
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. Osmosis and Diffusion"
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

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={useAI} onChange={(e) => setUseAI(e.target.checked)} />
            Generate the script with AI from the topic
          </label>

          {!useAI && (
            <div>
              <label className="text-sm font-medium block mb-1">Lesson script</label>
              <textarea
                value={script}
                onChange={(e) => setScript(e.target.value)}
                rows={14}
                spellCheck={false}
                className="w-full rounded-lg border px-3 py-2 text-xs font-mono bg-gray-50"
              />
              <p className="text-xs text-gray-400 mt-1">
                Directives: scene title|concept|diagram|list|equation|summary, narration:, heading:, sub:,
                draw: &lt;asset&gt; sync:&lt;phrase&gt;, text:, arrow:, highlight:, equation:, callout:, tick:
              </p>
            </div>
          )}

          <button
            onClick={submit}
            disabled={submitting || (useAI ? !topic.trim() : !script.trim())}
            className="w-full rounded-lg bg-emerald-700 text-white py-2.5 text-sm font-medium hover:bg-emerald-800 disabled:opacity-50"
          >
            {submitting ? (useAI ? 'Generating script…' : 'Validating script…') : 'Generate whiteboard video'}
          </button>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm p-3 whitespace-pre-wrap">
              {error}
            </div>
          )}
        </div>

        {/* Status + preview */}
        <div className="rounded-xl border p-4 space-y-4">
          <h2 className="font-semibold text-sm">Job status</h2>
          {!job && <p className="text-sm text-gray-400">No active job. Create one on the left.</p>}
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

              {job.status === 'failed' && (
                <div className="space-y-2">
                  <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm p-3 whitespace-pre-wrap">
                    {job.error_message || 'The job failed without an error message.'}
                  </div>
                  <button
                    onClick={retry}
                    disabled={retrying}
                    className="rounded-lg border border-emerald-700 text-emerald-700 px-3 py-1.5 text-sm hover:bg-emerald-50 disabled:opacity-50"
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
                      Worker {job.worker_id.slice(0, 24)} · attempt {job.attempt_count}
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
                            : 'Waiting for the automatic renderer dispatch. The database will retry if no worker claims this job.'}
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
                  20261115_whiteboard_engine_observability.sql.
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
                <a
                  href={job.video_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block rounded-lg bg-emerald-700 text-white px-4 py-2 text-sm hover:bg-emerald-800"
                >
                  Open rendered video
                </a>
              )}

              {job.timeline && job.audio_files && (
                <div>
                  <h3 className="font-semibold text-sm mb-2">Preview ({job.timeline.scenes.length} scenes)</h3>
                  <div className="rounded-lg overflow-hidden border bg-gray-900" style={{ aspectRatio: '16 / 9' }}>
                    <WhiteboardEngineComposition job={job} />
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    Preview streams the real narration audio; the MP4 render adds the final encode.
                  </p>
                </div>
              )}

              {job.warnings?.length > 0 && (
                <details className="text-xs text-gray-500">
                  <summary className="cursor-pointer">{job.warnings.length} build warning(s)</summary>
                  <ul className="list-disc pl-4 pt-1 space-y-1">
                    {job.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </details>
              )}
            </>
          )}
        </div>
      </section>

      {/* Recent jobs */}
      <section className="mt-8">
        <h2 className="font-semibold text-sm mb-2">Recent jobs</h2>
        {jobs.length === 0 ? (
          <p className="text-sm text-gray-400">No jobs yet.</p>
        ) : (
          <div className="rounded-xl border divide-y">
            {jobs.map((j) => (
              <button
                key={j.id}
                onClick={() => {
                  setJobId(j.id);
                  refreshJob(j.id);
                }}
                className="w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-gray-50 text-left"
              >
                <span>{j.title}</span>
                <span className="text-xs text-gray-400">{deriveStage(j) === 'completed' ? 'ready' : deriveStage(j)}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      <p className="text-xs text-gray-400 mt-8">
        Engine reference, demo scripts and the renderer live in{' '}
        <code>whiteboard-engine/</code>. This page is protected by the admin
        middleware — see <Link href="/admin/dashboard" className="underline">Dashboard</Link>.
      </p>
    </div>
  );
}
