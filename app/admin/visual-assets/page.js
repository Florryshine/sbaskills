'use client';

import { useCallback, useEffect, useState } from 'react';
import { ImagePlus, Search, Upload, RefreshCw, Loader2, AlertCircle } from 'lucide-react';

export default function VisualAssetLibraryPage() {
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
      event.currentTarget.reset();
      await load('');
    } catch (err) {
      setError(err.message || 'Asset upload failed.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-sky-300"><ImagePlus size={17} /> SBA Shared Library</div>
          <h1 className="text-3xl font-bold sm:text-4xl">Visual Asset Library</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-400">One reusable catalogue for Cartoon, Whiteboard, Notebook and future Mixed Media engines. Keep the source, licence and attribution attached to every asset.</p>
        </div>

        <section className="mb-8 grid gap-5 lg:grid-cols-[380px_1fr]">
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
            <label className="mb-2 block text-sm text-slate-300">File (SVG, PNG, JPG, WEBP, GIF · max 12 MB)</label>
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
            {notice && <p className="mb-4 rounded-lg bg-emerald-950/50 p-3 text-sm text-emerald-300">{notice}</p>}
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
      </div>
    </main>
  );
}
