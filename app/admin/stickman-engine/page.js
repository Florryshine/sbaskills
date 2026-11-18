'use client';

// app/admin/stickman-engine/page.js
// Stickman Animation Engine admin: paste a SceneScript, queue it, watch the
// stages, preview the finished MP4. Mirrors the whiteboard-engine page
// conventions (job list polling + stage display), no preview composition -
// the finished video is a plain <video> element.

import { useCallback, useEffect, useRef, useState } from 'react';
import SAMPLE_SCRIPT from '../../../stickman-engine/scenes/friction-story.json';

const STAGES = [
  { key: 'queued', label: 'Queued' },
  { key: 'narrating', label: 'Narrating (free TTS)' },
  { key: 'rendering', label: 'Rendering stickman animation' },
  { key: 'uploading', label: 'Uploading video' },
  { key: 'ready', label: 'Completed' },
];

function stageIndex(job) {
  if (!job) return -1;
  if (job.status === 'failed') return -2;
  const i = STAGES.findIndex((s) => s.key === (job.stage || job.status));
  return i >= 0 ? i : 0;
}

export default function StickmanEnginePage() {
  const [jobs, setJobs] = useState([]);
  const [workerOnline, setWorkerOnline] = useState(false);
  const [script, setScript] = useState(JSON.stringify(SAMPLE_SCRIPT, null, 2));
  const [title, setTitle] = useState('');
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const pollRef = useRef(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/stickman-engine', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      setJobs(data.jobs || []);
      setWorkerOnline(!!(data.worker && data.worker.online));
    } catch {
      /* polling errors are non-fatal */
    }
  }, []);

  useEffect(() => {
    refresh();
    pollRef.current = setInterval(refresh, 5000);
    return () => clearInterval(pollRef.current);
  }, [refresh]);

  const submit = useCallback(async () => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/stickman-engine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, script }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({
          kind: 'error',
          text: (data.problems || [data.error || 'Request failed']).join(' | '),
        });
      } else {
        setMessage({ kind: 'ok', text: `Queued job ${data.job.id}` });
        setSelected(data.job.id);
        refresh();
      }
    } catch (e) {
      setMessage({ kind: 'error', text: e.message });
    } finally {
      setBusy(false);
    }
  }, [script, title, refresh]);

  const current = jobs.find((j) => j.id === selected) || jobs[0] || null;
  const idx = stageIndex(current);

  return (
    <div style={{ padding: 24, fontFamily: 'system-ui, sans-serif', color: '#1a2530' }}>
      <h1 style={{ fontSize: 26, marginBottom: 4 }}>Stickman Animation Engine</h1>
      <p style={{ margin: '0 0 18px', color: '#5a6b7a' }}>
        Skeletal stickman videos from a SceneScript - walk, run, push, point, talk,
        interact, with camera moves, transitions and word-synced narration.
        Worker is {workerOnline ? 'online' : 'offline (start local-video-renderer/stickman-worker.js)'}.
      </p>

      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 420px', minWidth: 320 }}>
          <h2 style={{ fontSize: 16 }}>New animation</h2>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title (optional - falls back to script title)"
            style={{ width: '100%', padding: 10, marginBottom: 10, border: '1px solid #bfced6', borderRadius: 8 }}
          />
          <textarea
            value={script}
            onChange={(e) => setScript(e.target.value)}
            placeholder="Paste SceneScript JSON here..."
            style={{ width: '100%', minHeight: 320, padding: 10, fontFamily: 'monospace', fontSize: 12, border: '1px solid #bfced6', borderRadius: 8 }}
          />
          <div style={{ marginTop: 10, display: 'flex', gap: 10, alignItems: 'center' }}>
            <button
              onClick={submit}
              disabled={busy || !script}
              style={{ padding: '10px 18px', background: '#2285b7', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: busy ? 'wait' : 'pointer' }}
            >
              {busy ? 'Queueing...' : 'Queue animation'}
            </button>
            {message && (
              <span style={{ color: message.kind === 'error' ? '#934d47' : '#3b7950', fontSize: 13 }}>
                {message.text}
              </span>
            )}
          </div>
        </div>

        <div style={{ flex: '1 1 420px', minWidth: 320 }}>
          <h2 style={{ fontSize: 16 }}>Recent jobs</h2>
          <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid #bfced6', borderRadius: 8 }}>
            {jobs.length === 0 && <p style={{ padding: 12, color: '#848a8d' }}>No jobs yet.</p>}
            {jobs.map((j) => (
              <div
                key={j.id}
                onClick={() => setSelected(j.id)}
                style={{
                  padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid #e9ecee',
                  background: current && current.id === j.id ? '#eef5fa' : '#fff',
                }}
              >
                <b>{j.title}</b>
                <span style={{ float: 'right', color: j.status === 'ready' ? '#3b7950' : j.status === 'failed' ? '#934d47' : '#937842' }}>
                  {j.status}
                </span>
                <div style={{ fontSize: 12, color: '#7c8386' }}>
                  {j.stage_message || j.stage || ''} {j.duration_seconds ? `- ${Number(j.duration_seconds).toFixed(0)}s` : ''}
                </div>
              </div>
            ))}
          </div>

          {current && (
            <div style={{ marginTop: 16 }}>
              <h2 style={{ fontSize: 16 }}>Pipeline</h2>
              <ol style={{ listStyle: 'none', padding: 0, margin: '8px 0 16px' }}>
                {STAGES.map((s, i) => (
                  <li key={s.key} style={{
                    padding: '6px 10px', borderRadius: 6, margin: '4px 0',
                    background: idx >= i && idx !== -2 ? '#dcf0fa' : '#f1f2f3',
                    color: idx >= i && idx !== -2 ? '#14637f' : '#848a8d',
                    fontWeight: idx === i ? 700 : 400,
                  }}>
                    {s.label}
                  </li>
                ))}
              </ol>
              {current.status === 'ready' && current.video_url && (
                <video
                  key={current.id}
                  src={current.video_url}
                  controls
                  style={{ width: '100%', maxWidth: 360, borderRadius: 12, background: '#000' }}
                />
              )}
              {current.status === 'failed' && (
                <p style={{ color: '#934d47', fontSize: 13, whiteSpace: 'pre-wrap' }}>
                  {current.error_message}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
