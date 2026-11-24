'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const MODES = [
  ['educational', 'Educational explainer'], ['product_ad', 'Product advertisement'],
  ['product_demo', 'Product demonstration'], ['scientific', 'Scientific explanation'],
  ['technical', 'Technical explanation'], ['documentary', 'Documentary'], ['general', 'General explainer'],
];

const inputClass = 'w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none';
const labelClass = 'mb-1 block text-xs font-semibold text-slate-400';

function percent(value, total) {
  return total ? Math.max(0, Math.min(100, (Number(value) / total) * 100)) : 0;
}

export default function ImageExplainerStudioPage() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [mode, setMode] = useState('educational');
  const [instruction, setInstruction] = useState('Explain the important parts of this image. Distinguish what is visible from what needs research, and use supporting visuals where helpful.');
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [job, setJob] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [selectedComponent, setSelectedComponent] = useState(0);

  async function loadJobs() {
    try {
      const response = await fetch('/api/admin/image-explainer', { cache: 'no-store' });
      const data = await response.json();
      if (response.ok) setJobs(data.jobs || []);
    } catch { /* the page remains usable if the history request fails */ }
  }

  useEffect(() => { loadJobs(); }, []);

  function setComponents(next) {
    setJob((current) => ({
      ...current,
      vision_analysis: { ...current.vision_analysis, components: next },
    }));
  }

  function updateComponent(index, patch) {
    const next = [...(job?.vision_analysis?.components || [])];
    next[index] = { ...next[index], ...patch };
    setComponents(next);
  }

  function updateRegion(index, key, value) {
    const current = job.vision_analysis.components[index];
    const region = { ...current.region, [key]: Number(value) };
    delete region.normalized;
    updateComponent(index, { region });
  }

  function onFile(selected) {
    if (!selected) return;
    if (preview) URL.revokeObjectURL(preview);
    setFile(selected);
    setPreview(URL.createObjectURL(selected));
    setSourceUrl('');
    setJob(null);
    setError('');
    setNotice('');
  }

  async function submit(event) {
    event.preventDefault();
    if (!file) return;
    setBusy(true); setError(''); setNotice(''); setJob(null);
    try {
      const form = new FormData();
      form.append('image', file);
      form.append('productionMode', mode);
      form.append('instruction', instruction);
      form.append('title', title || file.name);
      form.append('aspect', '16:9');
      form.append('duration', '90');
      const response = await fetch('/api/admin/image-explainer', { method: 'POST', body: form });
      const data = await response.json();
      if (!response.ok) {
        if (data.jobId) await openProject(data.jobId);
        throw new Error(data.error || 'Image analysis failed.');
      }
      setJob(data.job);
      setSelectedComponent(0);
      setNotice('Image analysis complete. Review the detected regions and correct anything inaccurate before production.');
      await loadJobs();
    } catch (err) {
      setError(err.message || 'Could not analyse image.');
    } finally { setBusy(false); }
  }

  async function openProject(id) {
    setError(''); setNotice('');
    try {
      const response = await fetch(`/api/admin/image-explainer?id=${encodeURIComponent(id)}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not open project.');
      setJob(data.job);
      setSourceUrl(data.sourceUrl || '');
      setPreview('');
      setFile(null);
      setTitle(data.job.title || '');
      setMode(data.job.production_mode || 'educational');
      setSelectedComponent(0);
    } catch (err) { setError(err.message); }
  }

  async function retryAnalysis() {
    if (!job?.id) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/admin/image-explainer', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: job.id, action: 'retry-analysis' }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not retry image analysis.');
      setJob(data.job);
      setSelectedComponent(0);
      setNotice('Image analysis retry completed. Review the detected regions.');
      await loadJobs();
    } catch (err) { setError(err.message || 'Could not retry image analysis.'); }
    finally { setBusy(false); }
  }

  async function saveRegions() {
    if (!job?.id) return;
    setSaving(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/admin/image-explainer', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: job.id, components: job.vision_analysis?.components || [] }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not save image regions.');
      setJob((current) => ({ ...current, ...data.job }));
      setNotice('Your component names, descriptions and image regions have been saved.');
      await loadJobs();
    } catch (err) { setError(err.message || 'Could not save corrections.'); }
    finally { setSaving(false); }
  }

  function addComponent() {
    const dims = job?.vision_analysis?.image_dimensions;
    if (!dims?.width || !dims?.height) return;
    const components = [...(job.vision_analysis.components || []), {
      id: `manual-${Date.now()}`, name: 'New component', label_text: '',
      description: '', function: '', confidence: 1, needs_verification: true,
      region: {
        x: Math.round(dims.width * 0.25), y: Math.round(dims.height * 0.25),
        width: Math.round(dims.width * 0.25), height: Math.round(dims.height * 0.25),
      },
    }];
    setComponents(components);
    setSelectedComponent(components.length - 1);
  }

  function removeComponent(index) {
    setComponents(job.vision_analysis.components.filter((_, i) => i !== index));
    setSelectedComponent(Math.max(0, Math.min(index, job.vision_analysis.components.length - 2)));
  }

  const analysis = job?.vision_analysis;
  const dimensions = analysis?.image_dimensions || job?.source_images?.[0] || {};
  const components = analysis?.components || [];
  const imageSrc = preview || sourceUrl;

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white">
      <div className="mx-auto max-w-7xl">
        <Link href="/admin" className="text-sm text-sky-300 hover:text-sky-200">← Admin dashboard</Link>
        <header className="mb-8 mt-5">
          <p className="text-xs uppercase tracking-[.24em] text-sky-300">Shiney Brain Academy · Video production</p>
          <h1 className="mt-2 text-3xl font-bold md:text-4xl">Image-to-Explainer Studio</h1>
          <p className="mt-2 max-w-3xl text-slate-400">Upload a diagram, product photo, chart or technical image. AI identifies what is visible, locates components and prepares a reviewable image map.</p>
        </header>

        <div className="grid gap-6 xl:grid-cols-[390px_minmax(0,1fr)]">
          <aside className="space-y-5">
            <form onSubmit={submit} className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <div>
                <label className={labelClass}>Source image</label>
                <label className="flex min-h-48 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-700 bg-slate-950 p-4 text-center hover:border-sky-500">
                  {preview ? <img src={preview} alt="Selected source" className="max-h-56 max-w-full rounded-lg object-contain" /> : <><span className="text-4xl">＋</span><span className="mt-2 text-sm font-semibold">Choose an image</span><span className="mt-1 text-xs text-slate-500">JPG, PNG or WEBP · maximum 10 MB</span></>}
                  <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => onFile(event.target.files?.[0])} />
                </label>
              </div>
              <div><label className={labelClass}>Production mode</label><select value={mode} onChange={(event) => setMode(event.target.value)} className={inputClass}>{MODES.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></div>
              <div><label className={labelClass}>Project title</label><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Understanding the human heart" className={inputClass} /></div>
              <div><label className={labelClass}>What should the video explain?</label><textarea value={instruction} onChange={(event) => setInstruction(event.target.value)} rows={4} className={inputClass} /></div>
              {error && <p role="alert" className="rounded-lg bg-red-950 p-3 text-sm text-red-200">{error}</p>}
              {notice && <p role="status" className="rounded-lg bg-emerald-950 p-3 text-sm text-emerald-200">{notice}</p>}
              <button disabled={!file || busy} className="w-full rounded-xl bg-sky-400 px-4 py-3 font-bold text-slate-950 disabled:opacity-50">{busy ? 'Uploading and analysing…' : 'Analyse image'}</button>
              <p className="text-xs leading-5 text-slate-500">Images are stored in a private bucket. The analysis endpoint checks actual file format and image dimensions before sending pixels to the vision model.</p>
            </form>

            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <div className="flex items-center justify-between"><h2 className="font-semibold">Recent projects</h2><button onClick={loadJobs} type="button" className="text-xs text-sky-300">Refresh</button></div>
              <div className="mt-3 space-y-2">
                {jobs.length === 0 && <p className="text-sm text-slate-500">No saved image projects yet.</p>}
                {jobs.map((item) => <button key={item.id} type="button" onClick={() => openProject(item.id)} className={`block w-full rounded-lg p-3 text-left ${job?.id === item.id ? 'bg-sky-950 ring-1 ring-sky-700' : 'bg-slate-950 hover:bg-slate-800'}`}>
                  <span className="block text-sm font-medium">{item.title}</span>
                  <span className="mt-1 block text-xs text-slate-500">{item.status} · {new Date(item.created_at).toLocaleString()}</span>
                  {item.error_message && <span className="mt-1 block text-xs text-red-300">{item.error_message}</span>}
                </button>)}
              </div>
            </section>
          </aside>

          <section className="min-w-0 space-y-5">
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><h2 className="text-lg font-semibold">Visual region review</h2><p className="mt-1 text-sm text-slate-400">Select a numbered region to edit its name, explanation and exact bounding box.</p></div>
                {job && <div className="flex items-center gap-2"><span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-sky-200">{job.status}</span>{job.status === 'failed' && !job.vision_analysis && <button type="button" onClick={retryAnalysis} disabled={busy} className="rounded-lg border border-amber-700 px-3 py-1 text-xs text-amber-200 disabled:opacity-50">{busy ? 'Retrying…' : 'Retry analysis'}</button>}</div>}
              </div>
              {!job ? <div className="flex min-h-72 items-center justify-center text-center text-sm text-slate-500">Analyse a new image or open a saved project to review its visual map.</div> : <>
                <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
                  <div className="min-w-0">
                    {imageSrc ? <div className="relative inline-block w-full overflow-hidden rounded-xl bg-black">
                      <img src={imageSrc} alt="Source image with detected component regions" className="block h-auto w-full" />
                      {components.map((component, index) => {
                        const region = component.region || {};
                        const active = selectedComponent === index;
                        return <button key={component.id || index} type="button" title={component.name} onClick={() => setSelectedComponent(index)} className={`absolute border-2 ${active ? 'border-amber-300 bg-amber-300/20' : 'border-sky-400 bg-sky-400/10'}`} style={{ left: `${percent(region.x, dimensions.width)}%`, top: `${percent(region.y, dimensions.height)}%`, width: `${percent(region.width, dimensions.width)}%`, height: `${percent(region.height, dimensions.height)}%` }}>
                          <span className={`absolute -left-2 -top-5 rounded px-1.5 py-0.5 text-[10px] font-bold ${active ? 'bg-amber-300 text-slate-950' : 'bg-sky-400 text-slate-950'}`}>{index + 1}</span>
                        </button>;
                      })}
                    </div> : <div className="flex min-h-72 items-center justify-center rounded-xl bg-slate-950 text-sm text-slate-500">Source preview unavailable. Reopen the project to request a fresh private preview link.</div>}
                    <p className="mt-2 text-xs text-slate-500">{dimensions.width && dimensions.height ? `Original dimensions: ${dimensions.width} × ${dimensions.height} px` : 'Image dimensions unavailable'} · {components.length} mapped components</p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between"><h3 className="font-semibold">Detected components</h3><button type="button" onClick={addComponent} className="text-xs font-semibold text-sky-300">＋ Add region</button></div>
                    {components.length === 0 && <p className="rounded-lg bg-slate-950 p-3 text-sm text-slate-500">No regions detected. Add a region manually if needed.</p>}
                    <div className="max-h-64 space-y-2 overflow-y-auto">
                      {components.map((component, index) => <button key={component.id || index} type="button" onClick={() => setSelectedComponent(index)} className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left ${selectedComponent === index ? 'border-amber-400 bg-amber-400/10' : 'border-slate-800 bg-slate-950'}`}>
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-800 text-xs font-bold">{index + 1}</span>
                        <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{component.name}</span><span className="block truncate text-xs text-slate-500">{component.label_text || component.description || 'No description yet'}</span></span>
                      </button>)}
                    </div>
                    {components[selectedComponent] && <div className="space-y-3 border-t border-slate-800 pt-4">
                      <div><label className={labelClass}>Component name</label><input value={components[selectedComponent].name || ''} onChange={(event) => updateComponent(selectedComponent, { name: event.target.value })} className={inputClass} /></div>
                      <div><label className={labelClass}>Visible label text</label><input value={components[selectedComponent].label_text || ''} onChange={(event) => updateComponent(selectedComponent, { label_text: event.target.value })} className={inputClass} /></div>
                      <div><label className={labelClass}>What is visibly shown?</label><textarea rows={2} value={components[selectedComponent].description || ''} onChange={(event) => updateComponent(selectedComponent, { description: event.target.value })} className={inputClass} /></div>
                      <div><label className={labelClass}>Function / explanation (verify if uncertain)</label><textarea rows={2} value={components[selectedComponent].function || ''} onChange={(event) => updateComponent(selectedComponent, { function: event.target.value })} className={inputClass} /></div>
                      <div><p className={labelClass}>Bounding box · pixels</p><div className="grid grid-cols-2 gap-2">{['x', 'y', 'width', 'height'].map((key) => <label key={key} className="text-[11px] text-slate-500">{key}<input type="number" min="0" value={Math.round(components[selectedComponent].region?.[key] || 0)} onChange={(event) => updateRegion(selectedComponent, key, event.target.value)} className={`${inputClass} mt-1`} /></label>)}</div></div>
                      <label className="flex items-center gap-2 text-xs text-amber-200"><input type="checkbox" checked={Boolean(components[selectedComponent].needs_verification)} onChange={(event) => updateComponent(selectedComponent, { needs_verification: event.target.checked })} /> Needs factual verification during research</label>
                      <button type="button" onClick={() => removeComponent(selectedComponent)} className="text-xs text-red-300 hover:text-red-200">Remove this region</button>
                    </div>}
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 pt-4">
                  <div><p className="font-semibold">{analysis?.subject || job.title}</p><p className="mt-1 text-xs text-slate-500">{analysis?.image_type || 'Image'} · {Math.round((analysis?.confidence || 0) * 100)}% overall confidence · {analysis?.provider || 'Vision analysis'}</p></div>
                  <button type="button" onClick={saveRegions} disabled={saving || !['analysed', 'failed'].includes(job.status)} className="rounded-lg bg-sky-400 px-5 py-2.5 text-sm font-bold text-slate-950 disabled:opacity-50">{saving ? 'Saving…' : 'Save image map'}</button>
                </div>
                {analysis?.summary && <p className="mt-4 rounded-lg bg-slate-950 p-3 text-sm leading-6 text-slate-300">{analysis.summary}</p>}
                {(analysis?.detected_text || []).length > 0 && <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950 p-3"><p className="text-xs font-semibold text-slate-300">Text detected in image ({analysis.detected_text.length})</p><div className="mt-2 flex flex-wrap gap-2">{analysis.detected_text.map((item, index) => <span key={item.id || index} title={`Region: ${Math.round(item.region.x)}, ${Math.round(item.region.y)}`} className="rounded-md bg-slate-800 px-2 py-1 text-xs text-slate-200">{item.text}</span>)}</div></div>}
                {(analysis?.uncertainties || []).length > 0 && <div className="mt-3 rounded-lg border border-amber-900/60 bg-amber-950/30 p-3"><p className="text-xs font-semibold text-amber-200">Needs further investigation</p><ul className="mt-2 list-inside list-disc space-y-1 text-xs text-amber-100">{analysis.uncertainties.map((item, index) => <li key={index}>{item}</li>)}</ul></div>}
              </>}
            </div>

            <div className="rounded-xl border border-sky-900/60 bg-sky-950/30 p-4 text-sm text-sky-100">
              <strong>Phase 1 scope:</strong> secure image intake, image validation, persistent project records, AI visual analysis, component coordinates, private source previews and administrator correction of the image map. Research, storyboard, narration and video rendering are separate upcoming phases.
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
