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
  const [researching, setResearching] = useState(false);
  const [generatingScript, setGeneratingScript] = useState(false);
  const [savingScript, setSavingScript] = useState(false);
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

  async function runResearch() {
    if (!job?.id) return;
    setResearching(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/admin/image-explainer', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: job.id, action: 'research' }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Research could not be completed.');
      setJob((current) => ({ ...current, ...data.job }));
      setNotice('Research completed. Review the source references and media licences before using any asset.');
      await loadJobs();
    } catch (err) { setError(err.message || 'Research failed.'); }
    finally { setResearching(false); }
  }

  async function generateScript() {
    if (!job?.id) return;
    setGeneratingScript(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/admin/image-explainer', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: job.id, action: 'generate-script' }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Script generation failed.');
      setJob((current) => ({ ...current, ...data.job }));
      setNotice('Draft script and storyboard generated. Review every scene before approval.');
      await loadJobs();
    } catch (err) { setError(err.message || 'Script generation failed.'); }
    finally { setGeneratingScript(false); }
  }

  function updateScene(index, patch) {
    setJob((current) => {
      const scenes = [...(current.script?.scenes || [])];
      scenes[index] = { ...scenes[index], ...patch };
      const script = { ...current.script, scenes, total_duration_seconds: scenes.reduce((sum, scene) => sum + Number(scene.duration_seconds || 0), 0), review_status: 'needs_admin_review' };
      return { ...current, script, storyboard: scenes };
    });
  }

  async function saveScript() {
    if (!job?.id || !job?.script) return;
    setSavingScript(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/admin/image-explainer', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: job.id, action: 'save-script', script: job.script }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not save script.');
      setJob((current) => ({ ...current, ...data.job }));
      setNotice('Reviewed script and storyboard saved. Rendering has not started.');
      await loadJobs();
    } catch (err) { setError(err.message || 'Could not save script.'); }
    finally { setSavingScript(false); }
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
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={saveRegions} disabled={saving || !['analysed', 'failed'].includes(job.status)} className="rounded-lg border border-slate-600 px-4 py-2.5 text-sm font-semibold text-slate-200 disabled:opacity-50">{saving ? 'Saving…' : 'Save image map'}</button>
                    <button type="button" onClick={runResearch} disabled={researching || !['analysed', 'failed'].includes(job.status) || !analysis?.subject} className="rounded-lg bg-sky-400 px-5 py-2.5 text-sm font-bold text-slate-950 disabled:opacity-50">{researching ? 'Researching sources & assets…' : job.research_bundle ? 'Refresh research' : 'Research subject & find assets'}</button>
                  </div>
                </div>
                {analysis?.summary && <p className="mt-4 rounded-lg bg-slate-950 p-3 text-sm leading-6 text-slate-300">{analysis.summary}</p>}
                {(analysis?.detected_text || []).length > 0 && <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950 p-3"><p className="text-xs font-semibold text-slate-300">Text detected in image ({analysis.detected_text.length})</p><div className="mt-2 flex flex-wrap gap-2">{analysis.detected_text.map((item, index) => <span key={item.id || index} title={`Region: ${Math.round(item.region.x)}, ${Math.round(item.region.y)}`} className="rounded-md bg-slate-800 px-2 py-1 text-xs text-slate-200">{item.text}</span>)}</div></div>}
                {(analysis?.uncertainties || []).length > 0 && <div className="mt-3 rounded-lg border border-amber-900/60 bg-amber-950/30 p-3"><p className="text-xs font-semibold text-amber-200">Needs further investigation</p><ul className="mt-2 list-inside list-disc space-y-1 text-xs text-amber-100">{analysis.uncertainties.map((item, index) => <li key={index}>{item}</li>)}</ul></div>}
              </>}
            </div>

            {job?.research_bundle && <section className="space-y-5 rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-lg font-semibold">Research & asset discovery</h2><p className="mt-1 text-xs text-slate-400">Retrieved {new Date(job.research_bundle.researched_at).toLocaleString()} · {job.research_bundle.queries?.length || 0} search queries</p></div><span className="rounded-full bg-emerald-950 px-3 py-1 text-xs text-emerald-200">Research saved</span></div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg bg-slate-950 p-3"><p className="text-2xl font-bold">{job.research_bundle.sources?.length || 0}</p><p className="text-xs text-slate-400">Reference sources</p></div>
                <div className="rounded-lg bg-slate-950 p-3"><p className="text-2xl font-bold">{job.research_bundle.assets?.filter((a) => a.media_type === 'image').length || 0}</p><p className="text-xs text-slate-400">Image candidates</p></div>
                <div className="rounded-lg bg-slate-950 p-3"><p className="text-2xl font-bold">{job.research_bundle.assets?.filter((a) => a.media_type === 'video').length || 0}</p><p className="text-xs text-slate-400">Video candidates</p></div>
              </div>
              <div><h3 className="mb-2 font-semibold">Research references</h3><div className="grid gap-3 md:grid-cols-2">
                {(job.research_bundle.sources || []).map((source, index) => <article key={source.url || index} className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                  <div className="flex items-center justify-between gap-2"><span className="text-[10px] uppercase tracking-wide text-sky-300">{source.source} · {source.source_type}</span>{source.year && <span className="text-xs text-slate-500">{source.year}</span>}</div>
                  <h4 className="mt-2 text-sm font-semibold">{source.title}</h4>
                  {source.authors?.length > 0 && <p className="mt-1 text-xs text-slate-500">{source.authors.join(', ')}</p>}
                  {source.extract && <p className="mt-2 text-xs leading-5 text-slate-300">{source.extract}</p>}
                  {source.abstract && <p className="mt-2 text-xs leading-5 text-slate-400">{source.abstract}</p>}
                  {source.url && <a href={source.url} target="_blank" rel="noreferrer" className="mt-3 inline-block text-xs font-semibold text-sky-300 hover:underline">Open original source ↗</a>}
                </article>)}
              </div></div>
              <div><h3 className="mb-2 font-semibold">Supporting media candidates</h3><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {(job.research_bundle.assets || []).map((asset, index) => <article key={asset.media_url || index} className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
                  {asset.preview_url && asset.media_type === 'image' && <img src={asset.preview_url} alt={asset.title} loading="lazy" className="h-36 w-full object-cover" />}
                  <div className="p-3"><div className="flex items-center justify-between gap-2"><span className="text-[10px] uppercase text-sky-300">{asset.provider} · {asset.media_type}</span><span className="rounded bg-amber-950 px-2 py-0.5 text-[10px] text-amber-200">Review licence</span></div>
                    <p className="mt-2 text-sm font-medium">{asset.title}</p><p className="mt-1 text-xs text-slate-500">Creator: {asset.creator}</p><p className="mt-1 text-xs text-slate-400">{asset.license}</p>
                    {asset.source_url && <a href={asset.source_url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs font-semibold text-sky-300 hover:underline">View source & licence ↗</a>}
                  </div>
                </article>)}
                {(job.research_bundle.assets || []).length === 0 && <p className="text-sm text-slate-500">No supporting media candidates were returned by the configured providers.</p>}
              </div></div>
              <div className="rounded-lg border border-amber-900/60 bg-amber-950/30 p-3 text-xs leading-5 text-amber-100"><strong>Research safeguard:</strong> These are discovery results, not approved facts or assets. Check primary references before using factual claims. Open each asset's source page and verify its exact licence, attribution and commercial-use terms. Media is not automatically downloaded or inserted into a video.</div>
            </section>}
            {job && <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-sky-300">Phase 3 · Script & storyboard</p><h2 className="mt-1 text-xl font-bold">Narrative and visual direction</h2><p className="mt-1 text-sm text-slate-400">Generate scene-by-scene narration and a directed visual plan from the reviewed image map and research.</p></div>
                <button type="button" onClick={generateScript} disabled={generatingScript || savingScript || !analysis?.reviewed_by_admin || !job.research_bundle} className="rounded-lg bg-sky-400 px-4 py-2.5 text-sm font-bold text-slate-950 disabled:opacity-50">{generatingScript ? "Writing and directing…" : job.script ? "Regenerate draft" : "Generate script & storyboard"}</button></div>
              {!analysis?.reviewed_by_admin && <p className="rounded-lg border border-amber-900/60 bg-amber-950/30 p-3 text-xs text-amber-100">Save the corrected image map first.</p>}
              {!job.research_bundle && <p className="rounded-lg border border-amber-900/60 bg-amber-950/30 p-3 text-xs text-amber-100">Complete research and asset discovery first.</p>}
              {job.script && <><div className="grid gap-3 sm:grid-cols-3"><div className="rounded-lg bg-slate-950 p-3"><p className="text-2xl font-bold">{job.script.scenes?.length || 0}</p><p className="text-xs text-slate-400">Directed scenes</p></div><div className="rounded-lg bg-slate-950 p-3"><p className="text-2xl font-bold">{Math.round(job.script.total_duration_seconds || 0)}s</p><p className="text-xs text-slate-400">Estimated runtime</p></div><div className="rounded-lg bg-slate-950 p-3"><p className="text-sm font-semibold">{job.script.review_status === "admin_reviewed" ? "Admin reviewed" : "Needs review"}</p><p className="text-xs text-slate-400">Draft status</p></div></div>
                <div className="space-y-3">{(job.script.scenes || []).map((scene, index) => <article key={scene.id} className="rounded-xl border border-slate-800 bg-slate-950 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">{String(index + 1).padStart(2, "0")} · {scene.headline}</h3><span className="rounded bg-slate-800 px-2 py-1 text-xs">{scene.duration_seconds}s · {scene.visual?.treatment}</span></div>
                  <div className="mt-3 grid gap-3 lg:grid-cols-2"><div><label className={labelClass}>Scene heading</label><input className={inputClass} value={scene.headline || ""} onChange={(e) => updateScene(index, { headline: e.target.value })} /><label className="mb-1 mt-3 block text-xs font-semibold text-slate-400">Spoken narration</label><textarea rows={5} className={inputClass} value={scene.narration || ""} onChange={(e) => updateScene(index, { narration: e.target.value })} /><label className="mb-1 mt-3 block text-xs font-semibold text-slate-400">Scene purpose</label><textarea rows={2} className={inputClass} value={scene.purpose || ""} onChange={(e) => updateScene(index, { purpose: e.target.value })} /></div>
                  <div><label className={labelClass}>Visual direction</label><textarea rows={4} className={inputClass} value={scene.visual?.description || ""} onChange={(e) => updateScene(index, { visual: { ...scene.visual, description: e.target.value } })} /><label className="mb-1 mt-3 block text-xs font-semibold text-slate-400">Camera movement</label><input className={inputClass} value={scene.visual?.camera_move || ""} onChange={(e) => updateScene(index, { visual: { ...scene.visual, camera_move: e.target.value } })} /><label className="mb-1 mt-3 block text-xs font-semibold text-slate-400">Duration (seconds)</label><input type="number" min="2" max="45" className={inputClass} value={scene.duration_seconds || 0} onChange={(e) => updateScene(index, { duration_seconds: Number(e.target.value) })} /><p className="mt-2 text-xs text-slate-500">Linked components: {(scene.visual?.component_ids || []).join(", ") || "None"}</p><p className="mt-1 text-xs text-slate-500">On-screen text: {(scene.on_screen_text || []).join(" · ") || "None"}</p></div></div>
                  {(scene.fact_check_notes || []).length > 0 && <p className="mt-3 rounded-lg border border-amber-900/50 bg-amber-950/20 p-3 text-xs text-amber-100">Fact-check: {scene.fact_check_notes.join(" · ")}</p>}</article>)}</div>
                {(job.script.key_takeaways || []).length > 0 && <div className="rounded-lg bg-slate-950 p-3 text-sm">Key takeaways: {job.script.key_takeaways.join(" · ")}</div>}
                <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-slate-500">Review accuracy, pacing and visual continuity before saving.</p><button type="button" onClick={saveScript} disabled={savingScript || generatingScript} className="rounded-lg bg-emerald-400 px-5 py-2.5 text-sm font-bold text-slate-950 disabled:opacity-50">{savingScript ? "Saving…" : "Save reviewed script & storyboard"}</button></div></>}
            </section>}
            <div className="rounded-xl border border-sky-900/60 bg-sky-950/30 p-4 text-sm text-sky-100">
              <strong>Current scope:</strong> Phases 1–3 provide secure image intake, visual mapping, research discovery, and a reviewable narration script with scene-by-scene visual direction. Narration recording, timeline execution, durable rendering and final video delivery are still separate phases.
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
