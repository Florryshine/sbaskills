'use client';

import { useCallback, useEffect, useState } from 'react';
import { Film, Plus, RefreshCw, Play, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

const activeStatuses = new Set(['queued', 'scripting', 'narrating', 'rendering', 'uploading']);

export default function CartoonStudioPage() {
  const [projects, setProjects] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [topic, setTopic] = useState('');
  const [subject, setSubject] = useState('Biology');
  const [orientation, setOrientation] = useState('9:16');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/cartoon-studio', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not load Cartoon Studio.');
      setProjects(data.projects || []);
      setWorkers(data.workers || []);
      setError('');
    } catch (err) {
      setError(err.message || 'Could not load Cartoon Studio.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!projects.some(project => activeStatuses.has(project.status))) return;
    const timer = setInterval(load, 12000);
    return () => clearInterval(timer);
  }, [projects, load]);

  async function createProject(event) {
    event.preventDefault();
    if (!topic.trim()) return;
    setCreating(true);
    setError('');
    try {
      const response = await fetch('/api/admin/cartoon-studio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', topic: topic.trim(), title: topic.trim(), subject, orientation, subtitles: true }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not queue the cartoon.');
      setTopic('');
      await load();
    } catch (err) {
      setError(err.message || 'Could not create the project.');
    } finally {
      setCreating(false);
    }
  }

  async function enqueueRender(projectId, jobType = 'render') {
    setBusyId(projectId);
    setError('');
    try {
      const response = await fetch('/api/admin/cartoon-studio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'enqueue', projectId, jobType }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not queue rendering.');
      await load();
    } catch (err) {
      setError(err.message || 'Could not queue rendering.');
    } finally {
      setBusyId('');
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-sky-300">
              <Film size={17} /> Shiney Brain Academy
            </div>
            <h1 className="text-3xl font-bold sm:text-4xl">Cartoon Animation Studio</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">Create an educational cartoon, generate its storyboard and narration, then render the finished video into the SBA content library.</p>
          </div>
          <button onClick={load} className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800">
            <RefreshCw size={16} /> Refresh
          </button>
        </div>

        <section className="mb-8 grid gap-5 lg:grid-cols-[1fr_300px]">
          <form onSubmit={createProject} className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <h2 className="mb-4 text-lg font-semibold">Create a cartoon lesson</h2>
            <label className="mb-2 block text-sm text-slate-300" htmlFor="cartoon-topic">Topic</label>
            <input id="cartoon-topic" value={topic} onChange={e => setTopic(e.target.value)} placeholder="e.g. Photosynthesis, Human Circulation..." className="mb-4 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-sky-500" required maxLength={180} />
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm text-slate-300">Subject
                <select value={subject} onChange={e => setSubject(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-white">
                  {['Biology','Chemistry','Physics','Mathematics','General'].map(item => <option key={item}>{item}</option>)}
                </select>
              </label>
              <label className="text-sm text-slate-300">Video format
                <select value={orientation} onChange={e => setOrientation(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-white">
                  <option value="9:16">Vertical · 9:16</option>
                  <option value="16:9">Landscape · 16:9</option>
                  <option value="1:1">Square · 1:1</option>
                </select>
              </label>
            </div>
            <button disabled={creating || !topic.trim()} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-sky-500 px-5 py-3 font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50">
              {creating ? <Loader2 className="animate-spin" size={17} /> : <Plus size={17} />}
              {creating ? 'Queuing...' : 'Generate storyboard + narration'}
            </button>
          </form>

          <aside className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <h2 className="mb-3 font-semibold">Worker status</h2>
            {workers.length ? workers.slice(0, 3).map(worker => (
              <div key={worker.worker_id} className="mb-3 rounded-xl bg-slate-950 p-3">
                <div className="flex items-center gap-2 text-sm font-medium"><span className={`h-2 w-2 rounded-full ${Date.now() - new Date(worker.last_seen_at).getTime() < 90000 ? 'bg-emerald-400' : 'bg-amber-400'}`} />{Date.now() - new Date(worker.last_seen_at).getTime() < 90000 ? 'Online' : 'Last seen earlier'}</div>
                <p className="mt-1 truncate text-xs text-slate-500">{worker.worker_id}</p>
                <p className="mt-1 text-xs text-slate-500">{worker.current_job_id ? 'Processing a job' : 'Waiting for work'}</p>
                {worker.info?.last_error && <p className="mt-2 text-xs text-rose-400">{worker.info.last_error}</p>}
              </div>
            )) : <p className="text-sm text-slate-500">No worker heartbeat recorded yet. The scheduled worker becomes active after the Phase B branch is deployed and the database migration is applied.</p>}
          </aside>
        </section>

        {error && <div className="mb-5 flex items-start gap-2 rounded-xl border border-rose-900 bg-rose-950/50 p-4 text-sm text-rose-200"><AlertCircle size={18} className="mt-0.5 shrink-0" />{error}</div>}

        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Production queue</h2>
            <span className="text-sm text-slate-500">{projects.length} project(s)</span>
          </div>
          {loading ? <div className="py-12 text-center text-slate-500">Loading projects...</div> :
            projects.length ? <div className="grid gap-4 md:grid-cols-2">
              {projects.map(project => (
                <article key={project.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold">{project.title}</h3>
                      <p className="mt-1 text-xs text-slate-500">{project.orientation} · {project.status}</p>
                    </div>
                    {project.status === 'ready' ? <CheckCircle2 className="text-emerald-400" /> : activeStatuses.has(project.status) ? <Loader2 className="animate-spin text-sky-400" /> : <Film className="text-slate-500" />}
                  </div>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-800">
                    <div className="h-full rounded-full bg-sky-500 transition-all" style={{ width: `${Math.max(0, Math.min(100, project.progress || 0))}%` }} />
                  </div>
                  <div className="mt-2 flex justify-between text-xs text-slate-500"><span>{project.stage_message || project.stage}</span><span>{project.progress || 0}%</span></div>
                  {project.error_message && <p className="mt-3 rounded-lg bg-rose-950/40 p-3 text-xs text-rose-300">{project.error_message}</p>}
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    {project.has_spec && (project.status === 'cast_ready' || project.status === 'failed') ? (
                      <button onClick={() => enqueueRender(project.id, 'render')} disabled={busyId === project.id} className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50">
                        {busyId === project.id ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />} Render video
                      </button>
                    ) : null}
                    {!project.has_spec && project.status === 'failed' ? (
                      <button onClick={() => enqueueRender(project.id, 'script')} disabled={busyId === project.id} className="inline-flex items-center gap-2 rounded-lg bg-sky-500 px-3 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50">
                        {busyId === project.id ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />} Retry storyboard
                      </button>
                    ) : null}
                    {project.video_url && <a href={project.video_url} target="_blank" rel="noreferrer" className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-sky-300 hover:bg-slate-800">Open video</a>}
                    {project.duration_seconds ? <span className="text-xs text-slate-500">{Math.round(project.duration_seconds)}s</span> : null}
                  </div>
                </article>
              ))}
            </div> : <div className="rounded-2xl border border-dashed border-slate-800 py-16 text-center text-slate-500">No cartoon projects yet. Create the first lesson above.</div>}
        </section>
      </div>
    </main>
  );
}
