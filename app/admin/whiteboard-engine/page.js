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

const STATUS_STEPS = ['narrating', 'rendering', 'ready'];

export default function WhiteboardEnginePage() {
  const [topic, setTopic] = useState('');
  const [subject, setSubject] = useState('biology');
  const [useAI, setUseAI] = useState(false);
  const [script, setScript] = useState(SAMPLE_SCRIPT);
  const [jobId, setJobId] = useState(null);
  const [job, setJob] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [jobs, setJobs] = useState([]);
  const pollRef = useRef(null);

  const refreshJob = useCallback(async (id) => {
    const res = await fetch(`/api/admin/whiteboard-engine?id=${encodeURIComponent(id)}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not refresh whiteboard job.');
    if (data.job) setJob(data.job);
    return data.job;
  }, []);

  const loadJobs = useCallback(async () => {
    const res = await fetch('/api/admin/whiteboard-engine');
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not load whiteboard jobs.');
    if (data.jobs) setJobs(data.jobs);
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
      const data = await res.json();
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

  const stepIndex = job ? STATUS_STEPS.indexOf(job.status) : -1;

  return (
    <div className="p-6 max-w-5xl mx-auto pb-24">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">Whiteboard Studio v3</h1>
        <p className="text-sm text-gray-500 mt-1">
          Paste a lesson script (or generate one with AI) — the engine writes, draws and narrates
          it into a synced whiteboard video.
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
            disabled={submitting || (useAI ? !topic : !script)}
            className="w-full rounded-lg bg-emerald-700 text-white py-2.5 text-sm font-medium hover:bg-emerald-800 disabled:opacity-50"
          >
            {submitting ? 'Creating job…' : 'Create whiteboard job'}
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
                  {job.status}
                </span>
                {job.duration_seconds ? <span className="text-gray-400 text-xs">{Math.round(job.duration_seconds)}s</span> : null}
              </div>

              {job.status === 'failed' && (
                <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm p-3 whitespace-pre-wrap">
                  {job.error_message}
                </div>
              )}

              {job.status !== 'ready' && job.status !== 'failed' && (
                <div className="space-y-1 text-xs text-gray-500">
                  {STATUS_STEPS.map((step, i) => (
                    <div key={step} className="flex items-center gap-2">
                      <span className={stepIndex >= i ? 'text-emerald-600' : 'text-gray-300'}>●</span>
                      {step}
                      {stepIndex === i && <span className="animate-pulse">…</span>}
                    </div>
                  ))}
                  <p className="pt-1 text-gray-400">
                    MP4 rendering runs on the local whiteboard worker
                    (local-video-renderer/whiteboard-worker.js).
                  </p>
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
                <span className="text-xs text-gray-400">{j.status}</span>
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
