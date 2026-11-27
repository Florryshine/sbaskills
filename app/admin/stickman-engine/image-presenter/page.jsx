'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';

const MODES = [
  ['auto', 'Automatic'],
  ['single-image', 'Single image'],
  ['two-image-comparison', 'Two-image comparison'],
  ['multi-image-sequence', 'Multi-image sequence'],
  ['diagram-explanation', 'Diagram explanation'],
];

async function readJson(response) {
  const raw = await response.text();
  try { return JSON.parse(raw); }
  catch { return { error: `Server returned ${response.status}: ${raw.slice(0, 180)}` }; }
}

export default function StickmanImagePresenterPage() {
  const [topic, setTopic] = useState('');
  const [script, setScript] = useState('');
  const [mode, setMode] = useState('auto');
  const [aspectRatio, setAspectRatio] = useState('9:16');
  const [plan, setPlan] = useState(null);
  const [assets, setAssets] = useState({});
  const [warnings, setWarnings] = useState([]);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [job, setJob] = useState(null);

  const needs = useMemo(() => plan?.scenes?.flatMap(scene => scene.imageNeeds.map(need => ({ ...need, sceneTitle: scene.title }))) || [], [plan]);
  const run = async (action) => {
    setBusy(action); setError(''); setNotice('');
    try {
      const response = await fetch('/api/admin/stickman-image-presenter', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, topic, script, mode, aspectRatio, ...(action === 'acquire' && plan ? { plan } : {}) }),
      });
      const data = await readJson(response);
      if (!response.ok || !data.success) throw new Error(data.error || 'Request failed.');
      setPlan(data.plan);
      if (action === 'acquire') {
        setAssets(data.assets || {});
        setWarnings(data.warnings || []);
        setNotice(`Acquisition finished: ${Object.keys(data.assets || {}).length} of ${data.plan.scenes.reduce((n, scene) => n + scene.imageNeeds.length, 0)} image needs resolved. Images are stored in the existing lesson-videos bucket.`);
      } else {
        setAssets({}); setWarnings(data.plan.warnings || []);
        setNotice('Scene plan created. Review the beats and image searches before acquiring images.');
      }
    } catch (err) { setError(err.message || 'Something went wrong.'); }
    finally { setBusy(''); }
  };

  const createVideo = async () => {
    if (!plan || needs.some(need => !assets[need.id])) return;
    setBusy('enqueue'); setError(''); setNotice('');
    try {
      const assetFor = need => {
        const a = assets[need.id];
        return { id: need.id, subject: need.subject, title: a.title || need.subject, alt: a.alt || need.subject, mediaUrl: a.mediaUrl, sourceUrl: a.sourceUrl, provider: a.provider, mimeType: a.mimeType || 'image/jpeg', width: a.width, height: a.height, license: a.license, attribution: a.attribution, attributionRequired: a.attributionRequired, licenseVerified: a.licenseVerified, contentHash: a.contentHash };
      };
      const project = { version: 1, id: 'image-presenter-' + Date.now(), title: plan.title, subject: plan.subject || plan.title, aspectRatio: plan.aspectRatio, mode: plan.mode, presenterId: 'prof', fps: 30, scenes: plan.scenes.map(scene => {
        const cue = { characterId: 'prof', gesture: scene.presenter.gesture, position: scene.presenter.position, ...(scene.presenter.target ? { target: scene.presenter.target } : {}) };
        const base = { id: scene.id, title: scene.title, narration: scene.narration, caption: { text: scene.caption || scene.narration }, presenter: cue, durationSeconds: 4.5, transitionIn: 'fade' };
        if (scene.type === 'single-image') return { ...base, type: scene.type, image: assetFor(scene.imageNeeds[0]) };
        if (scene.type === 'two-image-comparison') { const left = scene.imageNeeds.find(n => n.role === 'left'); const right = scene.imageNeeds.find(n => n.role === 'right'); return { ...base, type: scene.type, left: { label: left.subject, image: assetFor(left) }, right: { label: right.subject, image: assetFor(right) }, activeSide: 'both' }; }
        if (scene.type === 'multi-image-sequence') return { ...base, type: scene.type, items: scene.imageNeeds.map((need, index) => ({ id: need.id, narration: need.subject, caption: { text: String(index + 1) + '. ' + need.subject }, image: assetFor(need), durationSeconds: 3 })) };
        return { ...base, type: 'diagram-explanation', image: assetFor(scene.imageNeeds[0]), annotations: [] };
      }) };
      const response = await fetch('/api/admin/stickman-image-presenter', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'enqueue', topic, subject: 'general', project, autoPublish: false }) });
      const data = await readJson(response);
      if (!response.ok || !data.success) throw new Error(data.error || 'Could not queue video.');
      setJob(data.job); setNotice('Video job queued. The existing Stickman worker will narrate, compile and render it.');
    } catch (err) { setError(err.message || 'Could not queue video.'); }
    finally { setBusy(''); }
  };
  return (
    <main className="mx-auto max-w-6xl space-y-6 p-4 pb-24 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/admin/stickman-engine" className="text-sm text-blue-600 hover:underline">← Original Stickman Studio</Link>
          <h1 className="mt-2 text-2xl font-bold">Stickman 2 · Image Presenter</h1>
          <p className="mt-1 max-w-3xl text-sm text-gray-600">Create presenter-led lessons around real images, comparisons, ordered visual steps or labelled diagrams. This is an additional mode; the original Stickman workflow remains unchanged.</p>
        </div>
        <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800">New production mode</span>
      </header>

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.8fr)]">
        <div className="space-y-4 rounded-xl border bg-white p-4">
          <div>
            <label className="mb-1 block text-sm font-semibold">Lesson topic</label>
            <input value={topic} onChange={e => setTopic(e.target.value)} maxLength={300} placeholder="e.g. Photosynthesis, Type 1 vs Type 2 diabetes" className="w-full rounded-lg border px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold">Script or lesson beats <span className="font-normal text-gray-500">(optional)</span></label>
            <textarea value={script} onChange={e => setScript(e.target.value)} rows={7} maxLength={12000} placeholder={'Paste a script, one idea per line, or numbered steps. Leave blank to create a topic-based starter plan.'} className="w-full rounded-lg border px-3 py-2 text-sm" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-semibold">Production mode
              <select value={mode} onChange={e => setMode(e.target.value)} className="mt-1 block w-full rounded-lg border bg-white px-3 py-2 font-normal">
                {MODES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="text-sm font-semibold">Video format
              <select value={aspectRatio} onChange={e => setAspectRatio(e.target.value)} className="mt-1 block w-full rounded-lg border bg-white px-3 py-2 font-normal">
                <option value="9:16">9:16 · Reels / TikTok</option>
                <option value="16:9">16:9 · YouTube</option>
                <option value="1:1">1:1 · Square</option>
              </select>
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <button disabled={!topic.trim() || !!busy} onClick={() => run('plan')} className="rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-50">{busy === 'plan' ? 'Planning…' : 'Build scene plan'}</button>
            <button disabled={!topic.trim() || !!busy} onClick={() => run('acquire')} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy === 'acquire' ? 'Finding and saving images…' : 'Acquire images'}</button>
          </div>
          <p className="text-xs text-gray-500">Planning is deterministic and uses no AI credits. Image acquisition uses the existing free/keyless providers and stores successful downloads in the existing Supabase lesson-videos bucket.</p>
        </div>

        <aside className="rounded-xl border bg-slate-50 p-4">
          <h2 className="font-semibold">What happens next</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-gray-600">
            <li>Choose a mode or let the planner infer it from your topic/script.</li>
            <li>Review scene beats and search subjects.</li>
            <li>Acquire images; each result keeps its source, creator and licence details.</li>
            <li>Check image coverage and provenance before rendering integration.</li>
          </ol>
          <p className="mt-4 rounded-lg border bg-white p-3 text-xs text-gray-600">Phase 6 connects the planning and acquisition workflow to a usable Studio screen. Final Remotion image-track rendering and export remain Phase 7 work.</p>
        </aside>
      </section>

      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
      {notice && <div role="status" className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">{notice}</div>}

      {job && <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm"><p className="font-semibold">Render job queued: {job.title}</p><p className="mt-1">Job ID: {job.id}</p><Link href="/admin/stickman-engine" className="mt-2 inline-block text-blue-700 underline">Open Stickman Studio to monitor progress</Link></div>}

      {plan && <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div><h2 className="text-xl font-bold">{plan.title}</h2><p className="text-sm text-gray-500">{plan.mode} · {plan.aspectRatio} · {plan.scenes.length} scene(s)</p></div>
          <span className="rounded-full bg-gray-100 px-3 py-1 text-xs">{Object.keys(assets).length}/{needs.length} images acquired</span>
        </div>
        {(plan.warnings || []).concat(warnings).map((warning, i) => <p key={i} className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{warning}</p>)}
        {plan && needs.length > 0 && <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-white p-4"><button disabled={!!busy || Object.keys(assets).length !== needs.length} onClick={createVideo} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy === 'enqueue' ? 'Queueing render…' : 'Create video with narrator'}</button><span className="text-xs text-gray-500">Requires every image need to be acquired. Rendering uses the existing Stickman worker and TTS pipeline.</span></div>}
        <div className="grid gap-4 md:grid-cols-2">
          {plan.scenes.map((scene, index) => <article key={scene.id} className="space-y-3 rounded-xl border bg-white p-4">
            <div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Scene {index + 1} · {scene.layout}</span><span className="text-xs text-gray-500">{scene.type}</span></div>
            <input aria-label="Scene title" value={scene.title} onChange={e => setPlan(current => ({ ...current, scenes: current.scenes.map(s => s.id === scene.id ? { ...s, title: e.target.value } : s) }))} className="w-full rounded border px-2 py-1 font-semibold" />
            <textarea aria-label="Scene narration" value={scene.narration} onChange={e => setPlan(current => ({ ...current, scenes: current.scenes.map(s => s.id === scene.id ? { ...s, narration: e.target.value, caption: e.target.value } : s) }))} rows={3} className="w-full rounded border px-2 py-2 text-sm" />
            <div className="space-y-2">
              {scene.imageNeeds.map(need => {
                const asset = assets[need.id];
                return <div key={need.id} className="rounded-lg bg-gray-50 p-2">
                  <div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold">{need.role.toUpperCase()} · {need.subject}</span><span className="text-xs text-gray-500">{asset ? 'Saved' : 'Not acquired'}</span></div>
                  {asset ? <div className="mt-2 flex gap-3">
                    <img src={asset.mediaUrl} alt={asset.alt || need.subject} className="h-24 w-24 rounded object-cover" />
                    <div className="min-w-0 text-xs text-gray-600"><p className="font-semibold">{asset.title}</p><p>{asset.provider} · {asset.license || 'Licence metadata unavailable'}</p>{asset.attribution && <p>By {asset.attribution}</p>}<a href={asset.sourceUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-blue-600 underline">View source</a></div>
                  </div> : <p className="mt-1 text-xs text-gray-500">Search: {need.searchQuery}</p>}
                </div>;
              })}
            </div>
          </article>)}
        </div>
      </section>}
    </main>
  );
}
