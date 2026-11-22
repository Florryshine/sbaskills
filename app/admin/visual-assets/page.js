'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  ImagePlus, Search, Upload, RefreshCw, Loader2, AlertCircle, Globe, CheckCircle2,
  XCircle, Wand2, Clock, Server, HardDrive, ShieldCheck, ExternalLink,
} from 'lucide-react';

const TABS = [
  { id: 'library', label: 'Library', icon: ImagePlus },
  { id: 'discover', label: 'Discover External', icon: Globe },
  { id: 'ephemeral', label: 'Ephemeral', icon: Clock },
  { id: 'providers', label: 'Providers', icon: Server },
  { id: 'storage', label: 'Storage', icon: HardDrive },
];

const KIND_OPTIONS = [
  { id: 'photo', label: 'Photo' },
  { id: 'illustration', label: 'Illustration' },
  { id: 'svg', label: 'SVG / icon' },
  { id: 'diagram', label: 'Diagram' },
  { id: 'video', label: 'Video' },
  { id: '3d', label: '3D model' },
  { id: 'texture', label: 'Texture' },
  { id: 'background', label: 'Background' },
];

const DECISION_STYLES = {
  use: 'bg-emerald-950/60 text-emerald-300 border-emerald-800',
  adapt: 'bg-amber-950/60 text-amber-300 border-amber-800',
  created: 'bg-sky-950/60 text-sky-300 border-sky-800',
  discard: 'bg-rose-950/50 text-rose-300 border-rose-900',
  uncertain: 'bg-slate-800 text-slate-300 border-slate-700',
  'no-match': 'bg-rose-950/50 text-rose-300 border-rose-900',
};

function VerdictBadge({ decision, children }) {
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${DECISION_STYLES[decision] || 'bg-slate-800 text-slate-300 border-slate-700'}`}>
      {children || decision}
    </span>
  );
}

export default function VisualAssetLibraryPage() {
  const [tab, setTab] = useState('library');

  // ── Library state (existing behaviour, unchanged contract) ───────────────
  const [assets, setAssets] = useState([]);
  const [query, setQuery] = useState('');
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('General');
  const [category, setCategory] = useState('object');
  const [license, setLicense] = useState('Unspecified — verify before external use');
  const [keywords, setKeywords] = useState('');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async (term = query) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (term.trim()) params.set('q', term.trim());
      const response = await fetch('/api/admin/visual-assets?' + params.toString(), { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not load assets.');
      setAssets(data.assets || []);
      setError('');
    } catch (err) {
      setError(err.message || 'Could not load the library.');
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => { load(''); }, []);

  async function submit(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    if (!file || !name.trim()) return;
    setUploading(true);
    setError('');
    setNotice('');
    try {
      const form = new FormData();
      form.set('file', file);
      form.set('name', name.trim());
      form.set('subject', subject);
      form.set('category', category);
      form.set('license', license);
      form.set('keywords', keywords);
      const response = await fetch('/api/admin/visual-assets', { method: 'POST', body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Asset upload failed.');
      setNotice(data.reused ? 'This exact asset already exists; the existing library item was reused.' : 'Asset uploaded and added to the shared library.');
      setName('');
      setKeywords('');
      setFile(null);
      formElement.reset();
      await load('');
    } catch (err) {
      setError(err.message || 'Asset upload failed.');
    } finally {
      setUploading(false);
    }
  }

  // ── Discover state ────────────────────────────────────────────────────────
  const [dSubject, setDSubject] = useState('');
  const [dKinds, setDKinds] = useState(['photo', 'illustration', 'svg']);
  const [dStyle, setDStyle] = useState('');
  const [dTransparent, setDTransparent] = useState(false);
  const [dStrict, setDStrict] = useState('normal');
  const [dAllowCreate, setDAllowCreate] = useState(true);
  const [discovering, setDiscovering] = useState(false);
  const [dResult, setDResult] = useState(null);
  const [dError, setDError] = useState('');
  const [savingId, setSavingId] = useState(null);

  async function runDiscover(event) {
    event.preventDefault();
    if (!dSubject.trim()) return;
    setDiscovering(true);
    setDError('');
    setDResult(null);
    try {
      const response = await fetch('/api/admin/visual-intelligence/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: dSubject.trim(),
          query: dSubject.trim(),
          kinds: dKinds,
          style: dStyle || undefined,
          transparent: dTransparent,
          scientificAccuracy: dStrict,
          allowCreate: dAllowCreate,
          includeCandidates: true,
        }),
      });
      const data = await response.json();
      setDResult(data);
      if (data.error) setDError(data.error);
    } catch (err) {
      setDError(err.message || 'Discovery failed.');
    } finally {
      setDiscovering(false);
    }
  }

  async function approveCandidate(candidate) {
    setSavingId(candidate.provider + ':' + candidate.providerAssetId);
    setDError('');
    try {
      const response = await fetch('/api/admin/visual-intelligence/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          request: { subject: dSubject.trim(), query: dSubject.trim(), kinds: dKinds, style: dStyle || undefined, transparent: dTransparent, scientificAccuracy: dStrict },
          select: { provider: candidate.provider, providerAssetId: candidate.providerAssetId },
          subject,
          keywords: keywords.split(',').map((k) => k.trim()).filter(Boolean),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setDError(data.error || 'Could not save the asset.');
      } else {
        setNotice(data.reused
          ? 'Asset already existed in the library (duplicate detected) — reused the existing entry.'
          : `Saved "${data.asset?.name}" to the permanent library.`);
        setTab('library');
        await load('');
      }
    } catch (err) {
      setDError(err.message || 'Could not save the asset.');
    } finally {
      setSavingId(null);
    }
  }

  // ── Ephemeral state ───────────────────────────────────────────────────────
  const [ephItems, setEphItems] = useState([]);
  const [ephLoading, setEphLoading] = useState(false);
  const [ephNotice, setEphNotice] = useState('');

  const loadEphemeral = useCallback(async () => {
    setEphLoading(true);
    try {
      const response = await fetch('/api/admin/visual-intelligence/ephemeral?includeExpired=true', { cache: 'no-store' });
      const data = await response.json();
      setEphItems(data.items || []);
    } catch {
      setEphItems([]);
    } finally {
      setEphLoading(false);
    }
  }, []);

  async function purgeEphemeral() {
    setEphLoading(true);
    setEphNotice('');
    try {
      const response = await fetch('/api/admin/visual-intelligence/ephemeral?dryRun=false', { method: 'DELETE' });
      const data = await response.json();
      setEphNotice(`Purged ${data.purged?.length || 0} expired ephemeral file(s).`);
      await loadEphemeral();
    } catch {
      setEphNotice('Purge failed.');
    } finally {
      setEphLoading(false);
    }
  }

  useEffect(() => { if (tab === 'ephemeral') loadEphemeral(); }, [tab, loadEphemeral]);

  // ── Providers state ───────────────────────────────────────────────────────
  const [providerStatus, setProviderStatus] = useState(null);

  useEffect(() => {
    if (tab !== 'providers') return;
    fetch('/api/admin/visual-intelligence/providers', { cache: 'no-store' })
      .then((r) => r.json())
      .then(setProviderStatus)
      .catch(() => setProviderStatus(null));
  }, [tab]);

  // ── Storage state ─────────────────────────────────────────────────────────
  const [stats, setStats] = useState(null);

  useEffect(() => {
    if (tab !== 'storage') return;
    fetch('/api/admin/visual-intelligence/stats', { cache: 'no-store' })
      .then((r) => r.json())
      .then(setStats)
      .catch(() => setStats(null));
  }, [tab]);

  const fmtBytes = (n) => {
    const v = Number(n) || 0;
    if (v > 1024 * 1024 * 1024) return (v / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
    if (v > 1024 * 1024) return (v / (1024 * 1024)).toFixed(2) + ' MB';
    if (v > 1024) return (v / 1024).toFixed(1) + ' KB';
    return v + ' B';
  };

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-sky-300"><ImagePlus size={17} /> SBA Shared Library</div>
          <h1 className="text-3xl font-bold sm:text-4xl">Visual Asset Library</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-400">One reusable catalogue for Cartoon, Whiteboard, Notebook and future Mixed Media engines. Keep the source, licence and attribution attached to every asset.</p>
        </div>

        <nav className="mb-6 flex flex-wrap gap-2">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition ${tab === id ? 'border-sky-500 bg-sky-500/10 text-sky-300' : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200'}`}>
              <Icon size={15} /> {label}
            </button>
          ))}
        </nav>

        {notice && <p className="mb-4 rounded-lg bg-emerald-950/50 p-3 text-sm text-emerald-300">{notice}</p>}

        {/* ── LIBRARY TAB ─────────────────────────────────────────────── */}
        {tab === 'library' && (
          <section className="grid gap-5 lg:grid-cols-[380px_1fr]">
            <form onSubmit={submit} className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <h2 className="mb-4 font-semibold">Add an asset</h2>
              <label className="mb-2 block text-sm text-slate-300">Asset name</label>
              <input value={name} onChange={e => setName(e.target.value)} required maxLength={160} className="mb-3 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3" placeholder="e.g. Human heart diagram" />
              <div className="mb-3 grid grid-cols-2 gap-3">
                <label className="text-sm text-slate-300">Subject
                  <select value={subject} onChange={e => setSubject(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-2 py-3">
                    {['General','Biology','Chemistry','Physics','Mathematics','Geography','English'].map(x => <option key={x}>{x}</option>)}
                  </select>
                </label>
                <label className="text-sm text-slate-300">Category
                  <select value={category} onChange={e => setCategory(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-2 py-3">
                    {['object','diagram','organ','cell','microorganism','plant','animal','molecule','character','background'].map(x => <option key={x}>{x}</option>)}
                  </select>
                </label>
              </div>
              <label className="mb-2 block text-sm text-slate-300">Keywords (comma separated)</label>
              <input value={keywords} onChange={e => setKeywords(e.target.value)} className="mb-3 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3" placeholder="heart, circulation, anatomy" />
              <label className="mb-2 block text-sm text-slate-300">Licence / usage terms</label>
              <input value={license} onChange={e => setLicense(e.target.value)} className="mb-3 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3" />
              <label className="mb-2 block text-sm text-slate-300">File (SVG, PNG, JPG, WEBP, GIF · max 4 MB)</label>
              <input type="file" accept=".svg,.png,.jpg,.jpeg,.webp,.gif,image/svg+xml,image/png,image/jpeg,image/webp,image/gif" onChange={e => setFile(e.target.files?.[0] || null)} required className="w-full text-sm text-slate-400 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-700 file:px-3 file:py-2 file:text-white" />
              <button disabled={uploading || !file || !name.trim()} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-sky-500 px-4 py-3 font-semibold text-slate-950 disabled:opacity-50">
                {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                {uploading ? 'Uploading...' : 'Add to shared library'}
              </button>
            </form>

            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-semibold">Library assets <span className="ml-1 text-sm font-normal text-slate-500">({assets.length})</span></h2>
                <button onClick={() => load()} className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm"><RefreshCw size={15} /> Refresh</button>
              </div>
              <form onSubmit={e => { e.preventDefault(); load(query); }} className="mb-5 flex gap-2">
                <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by asset name or description..." className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm" />
                <button className="rounded-xl bg-slate-700 px-4"><Search size={17} /></button>
              </form>
              {error && <p className="mb-4 flex gap-2 rounded-lg bg-rose-950/50 p-3 text-sm text-rose-300"><AlertCircle size={16} />{error}</p>}
              {loading ? <p className="py-12 text-center text-sm text-slate-500">Loading library...</p> :
                assets.length ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {assets.map(asset => (
                    <article key={asset.id} className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
                      <div className="flex h-36 items-center justify-center bg-white p-3">
                        <img src={asset.public_url} alt={asset.name} className="max-h-full max-w-full object-contain" loading="lazy" />
                      </div>
                      <div className="p-3">
                        <h3 className="truncate text-sm font-semibold">{asset.name}</h3>
                        <p className="mt-1 text-xs text-slate-500">{asset.subject} · {asset.category}</p>
                        <p className="mt-2 line-clamp-2 text-xs text-slate-400">{asset.license}</p>
                        {asset.attribution_required && <p className="mt-2 text-xs text-amber-300">Attribution required: {asset.attribution || 'Credit the creator.'}</p>}
                      </div>
                    </article>
                  ))}
                </div> : <p className="py-12 text-center text-sm text-slate-500">No assets found. Upload the first reusable visual.</p>}
            </div>
          </section>
        )}

        {/* ── DISCOVER TAB ────────────────────────────────────────────── */}
        {tab === 'discover' && (
          <section className="space-y-5">
            <form onSubmit={runDiscover} className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <h2 className="mb-1 font-semibold">Fetch → Inspect → Decide</h2>
              <p className="mb-4 text-xs text-slate-500">Searches every configured external provider, downloads and visually inspects the candidates, then recommends use / adapt / create with the reason attached.</p>
              <div className="mb-4 grid gap-3 lg:grid-cols-2">
                <label className="text-sm text-slate-300">Subject
                  <input value={dSubject} onChange={e => setDSubject(e.target.value)} required maxLength={160} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3" placeholder="e.g. human skeleton illustration / red blood cell / mitochondrion diagram" />
                </label>
                <div className="text-sm text-slate-300">Visual types
                  <div className="mt-2 flex flex-wrap gap-2">
                    {KIND_OPTIONS.map(k => (
                      <button type="button" key={k.id}
                        onClick={() => setDKinds(prev => prev.includes(k.id) ? (prev.length > 1 ? prev.filter(x => x !== k.id) : prev) : [...prev, k.id])}
                        className={`rounded-full border px-3 py-1.5 text-xs ${dKinds.includes(k.id) ? 'border-sky-500 bg-sky-500/10 text-sky-300' : 'border-slate-700 bg-slate-950 text-slate-400'}`}>
                        {k.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="mb-4 grid gap-3 sm:grid-cols-3">
                <label className="text-sm text-slate-300">Style hint
                  <input value={dStyle} onChange={e => setDStyle(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3" placeholder="cartoon, realistic, flat…" />
                </label>
                <label className="text-sm text-slate-300">Scientific accuracy
                  <select value={dStrict} onChange={e => setDStrict(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3">
                    <option value="strict">Strict (teaching material)</option>
                    <option value="normal">Normal</option>
                    <option value="relaxed">Relaxed</option>
                  </select>
                </label>
                <label className="text-sm text-slate-300">Options
                  <span className="mt-3 flex flex-col gap-2 text-xs">
                    <span className="flex items-center gap-2 text-slate-300"><input type="checkbox" checked={dTransparent} onChange={e => setDTransparent(e.target.checked)} /> needs transparency</span>
                    <span className="flex items-center gap-2 text-slate-300"><input type="checkbox" checked={dAllowCreate} onChange={e => setDAllowCreate(e.target.checked)} /> allow procedural creation as fallback</span>
                  </span>
                </label>
              </div>
              <button disabled={discovering || !dSubject.trim()} className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-5 py-3 font-semibold text-slate-950 disabled:opacity-50">
                {discovering ? <Loader2 size={16} className="animate-spin" /> : <Globe size={16} />}
                {discovering ? 'Fetching & inspecting…' : 'Search external providers'}
              </button>
            </form>

            {dError && <p className="flex gap-2 rounded-lg bg-rose-950/50 p-3 text-sm text-rose-300"><AlertCircle size={16} />{dError}</p>}

            {dResult && (
              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                <div className="mb-4 flex flex-wrap items-center gap-3">
                  <VerdictBadge decision={dResult.decision}>{dResult.decision}</VerdictBadge>
                  <p className="text-sm text-slate-300">{dResult.explanation}</p>
                </div>
                {dResult.asset?.svg && (
                  <div className="mb-4 flex max-h-72 items-center justify-center overflow-hidden rounded-xl bg-white p-4">
                    <img src={`data:image/svg+xml;utf8,${encodeURIComponent(dResult.asset.svg)}`} alt="Procedural asset" className="max-h-full object-contain" />
                  </div>
                )}
                {Array.isArray(dResult.candidates) && dResult.candidates.length > 0 && (
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {dResult.candidates.map(c => (
                      <article key={c.provider + ':' + c.providerAssetId} className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
                        <div className="flex h-36 items-center justify-center bg-white p-3">
                          {c.previewUrl
                            ? <img src={c.previewUrl} alt={c.title || 'candidate'} className="max-h-full max-w-full object-contain" loading="lazy" />
                            : <span className="text-xs text-slate-400">No preview available</span>}
                        </div>
                        <div className="space-y-2 p-3">
                          <div className="flex items-center justify-between gap-2">
                            <VerdictBadge decision={c.decision} />
                            <VerdictBadge decision={c.licenseStatus === 'allowed' ? 'use' : c.licenseStatus === 'unknown' ? 'uncertain' : 'discard'}>{c.licenseStatus}</VerdictBadge>
                          </div>
                          <h3 className="line-clamp-2 text-sm font-semibold">{c.title || '(untitled)'}</h3>
                          <p className="text-xs text-slate-500">{c.provider} · {c.width ? `${c.width}x${c.height}` : 'size n/a'}</p>
                          {c.subjectMatch !== null && c.subjectMatch !== undefined && (
                            <p className="text-xs text-slate-400">Subject match: <span className={c.subjectMatch >= 80 ? 'text-emerald-300' : c.subjectMatch >= 60 ? 'text-amber-300' : 'text-rose-300'}>{c.subjectMatch}/100</span></p>
                          )}
                          {c.visionNote && <p className="text-xs text-amber-300">{c.visionNote}</p>}
                          {c.licenseText && <p className="line-clamp-2 text-xs text-slate-400">{c.licenseText}</p>}
                          {c.adaptations?.length > 0 && (
                            <ul className="list-disc space-y-1 pl-4 text-xs text-amber-200/80">
                              {c.adaptations.map((a, i) => <li key={i}>{a}</li>)}
                            </ul>
                          )}
                          {c.explanation && <p className="line-clamp-3 text-xs text-slate-500">{c.explanation}</p>}
                          <div className="flex flex-wrap gap-2 pt-1">
                            <button
                              onClick={() => approveCandidate(c)}
                              disabled={savingId === c.provider + ':' + c.providerAssetId || c.decision === 'discard' || c.licenseStatus === 'rejected'}
                              className="inline-flex items-center gap-1 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-slate-950 disabled:opacity-40">
                              {savingId === c.provider + ':' + c.providerAssetId ? <Loader2 size={13} className="animate-spin" /> : <ShieldCheck size={13} />}
                              Approve & save
                            </button>
                            {c.pageUrl && (
                              <a href={c.pageUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300">
                                <ExternalLink size={13} /> Source
                              </a>
                            )}
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
                {dResult.decision === 'no-match' && Array.isArray(dResult.decisions) && dResult.decisions.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <h3 className="text-sm font-semibold text-slate-300">Why everything was rejected</h3>
                    {dResult.decisions.map((d, i) => (
                      <p key={i} className="rounded-lg bg-slate-950 p-3 text-xs text-slate-400"><span className="mr-2 font-semibold text-slate-300">{d.provider}:</span>{d.explanation}</p>
                    ))}
                  </div>
                )}
                {dResult.storage && (
                  <p className="mt-4 text-xs text-slate-500">Storage: tier {dResult.storage.tier || '—'} ({dResult.storage.mode}) {dResult.storage.stored ? '· stored' : dResult.storage.reason ? '· ' + dResult.storage.reason : ''}</p>
                )}
              </div>
            )}
          </section>
        )}

        {/* ── EPHEMERAL TAB ───────────────────────────────────────────── */}
        {tab === 'ephemeral' && (
          <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">Ephemeral media (tier B)</h2>
                <p className="text-xs text-slate-500">Files staged for renders or previews. Expired files and their bytes are purged by the <code className="text-slate-400">visual-cache-purge</code> cron.</p>
              </div>
              <div className="flex gap-2">
                <button onClick={loadEphemeral} className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm"><RefreshCw size={15} /> Refresh</button>
                <button onClick={purgeEphemeral} className="rounded-lg bg-rose-500/80 px-3 py-2 text-sm font-semibold text-slate-950">Purge expired now</button>
              </div>
            </div>
            {ephNotice && <p className="mb-3 rounded-lg bg-sky-950/50 p-3 text-sm text-sky-300">{ephNotice}</p>}
            {ephLoading ? <p className="py-10 text-center text-sm text-slate-500">Loading…</p> :
              ephItems.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-xs uppercase text-slate-500">
                      <tr><th className="p-2">Name</th><th className="p-2">For</th><th className="p-2">Size</th><th className="p-2">Expires</th><th className="p-2">Status</th></tr>
                    </thead>
                    <tbody>
                      {ephItems.map(item => {
                        const expired = new Date(item.expires_at) < new Date();
                        return (
                          <tr key={item.id} className="border-t border-slate-800">
                            <td className="p-2"><a href={item.public_url || '#'} target="_blank" rel="noreferrer" className="text-sky-300 hover:underline">{item.name}</a></td>
                            <td className="p-2 text-slate-400">{item.retained_for || '—'}</td>
                            <td className="p-2 text-slate-400">{fmtBytes(item.file_size_bytes)}</td>
                            <td className="p-2 text-slate-400">{new Date(item.expires_at).toLocaleString()}</td>
                            <td className="p-2">{expired ? <VerdictBadge decision="discard">expired</VerdictBadge> : <VerdictBadge decision="use">active</VerdictBadge>}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : <p className="py-10 text-center text-sm text-slate-500">No ephemeral assets staged right now.</p>}
          </section>
        )}

        {/* ── PROVIDERS TAB ───────────────────────────────────────────── */}
        {tab === 'providers' && (
          <section className="space-y-4">
            {providerStatus?.vision && (
              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                <h2 className="mb-2 flex items-center gap-2 font-semibold"><Wand2 size={16} /> Vision inspection</h2>
                <p className={`text-sm ${providerStatus.vision.available ? 'text-emerald-300' : 'text-amber-300'}`}>
                  {providerStatus.vision.available ? 'Active — subject match and scientific accuracy are visually verified with Gemini.' : 'No vision key configured — subject accuracy is reported as UNCERTAIN, never guessed.'}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {providerStatus.vision.credentials.map(c => (
                    <span key={c.env} className={`rounded-full border px-3 py-1 text-xs ${c.configured ? 'border-emerald-800 text-emerald-300' : 'border-slate-700 text-slate-500'}`}>{c.env}: {c.configured ? 'configured' : 'missing'}</span>
                  ))}
                </div>
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              {(providerStatus?.providers || []).map(p => (
                <article key={p.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <h3 className="font-semibold">{p.label}</h3>
                    {p.mode === 'manual'
                      ? <VerdictBadge decision="uncertain">manual import</VerdictBadge>
                      : p.available ? <VerdictBadge decision="use"><CheckCircle2 size={11} className="mr-1 inline" /> ready</VerdictBadge> : <VerdictBadge decision="discard"><XCircle size={11} className="mr-1 inline" /> missing key</VerdictBadge>}
                  </div>
                  <p className="text-xs text-slate-500">Kinds: {p.kinds.join(', ')}</p>
                  <p className="mt-1 text-xs text-slate-400">{p.licenseText}</p>
                  {p.rateLimitNote && <p className="mt-1 text-xs text-slate-500">{p.rateLimitNote}</p>}
                  {p.credentials?.map(c => (
                    <p key={c.env} className={`mt-1 text-xs ${c.configured ? 'text-emerald-300' : c.required ? 'text-rose-300' : 'text-slate-500'}`}>
                      {c.env}: {c.configured ? 'configured' : c.required ? 'missing (provider disabled)' : 'optional — not set'}
                    </p>
                  ))}
                  {p.manualImport && (
                    <p className="mt-2 rounded-lg bg-slate-950 p-2 text-xs text-slate-400">{p.manualImport.tips} <a className="text-sky-300 hover:underline" href={p.manualImport.browseUrl} target="_blank" rel="noreferrer">Browse ↗</a></p>
                  )}
                </article>
              ))}
            </div>
          </section>
        )}

        {/* ── STORAGE TAB ─────────────────────────────────────────────── */}
        {tab === 'storage' && (
          <section className="grid gap-4 sm:grid-cols-2">
            {!stats || stats.error ? (
              <p className="rounded-2xl border border-slate-800 bg-slate-900 p-5 text-sm text-slate-400">{stats ? stats.error || 'Stats unavailable.' : 'Loading…'}</p>
            ) : (
              <>
                <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                  <h2 className="mb-3 font-semibold">Permanent library (tier C)</h2>
                  <p className="text-3xl font-bold text-sky-300">{stats.library.count}</p>
                  <p className="text-sm text-slate-400">{fmtBytes(stats.library.bytes)} stored</p>
                  <div className="mt-3 space-y-1 text-xs text-slate-400">
                    {Object.entries(stats.library.byType || {}).map(([k, v]) => <p key={k}>{k}: {v}</p>)}
                    {stats.library.pendingApproval > 0 && <p className="text-amber-300">Pending approval: {stats.library.pendingApproval}</p>}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                  <h2 className="mb-3 font-semibold">Ephemeral (tier B) & cache (tier A)</h2>
                  <p className="text-3xl font-bold text-amber-300">{stats.ephemeral.count}</p>
                  <p className="text-sm text-slate-400">{fmtBytes(stats.ephemeral.bytes)} staged</p>
                  <p className="mt-3 text-xs text-slate-400">Active search-cache entries: {stats.searchCache.activeEntries}</p>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:col-span-2">
                  <h2 className="mb-3 font-semibold">By source</h2>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(stats.library.bySource || {}).map(([k, v]) => (
                      <span key={k} className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-xs text-slate-300">{k}: {v}</span>
                    ))}
                  </div>
                </div>
              </>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
