'use client';
import { readApiResponse } from '@/lib/client/read-api-response';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

const COMPONENTS = [
  ['master_script', 'Master teaching script', 'Reusable lesson narration and teaching beats.'],
  ['short_script', 'Short-form video script', 'Reusable 30–60 second vertical video script.'],
  ['carousel_slides', 'Carousel slides', 'Shared educational slides for Instagram, Facebook, Telegram, LinkedIn and X.'],
  ['caption_base', 'Caption foundation', 'Platform-neutral caption starting point.'],
  ['seo_meta', 'SEO metadata', 'Search title, description, keywords and FAQs.'],
  ['mcq_set', 'MCQ question set', 'Ten questions with answers and explanations.'],
  ['visual_instructions', 'Visual instructions', 'Reusable scene and visual guidance for production engines.'],
];

export default function KnowledgeAssetPackagePage() {
  const params = useParams();
  const assetId = params?.assetId;
  const [asset, setAsset] = useState(null);
  const [components, setComponents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [force, setForce] = useState(false);
  const [message, setMessage] = useState('');
  const [selected, setSelected] = useState(COMPONENTS.map(([type]) => type));

  const load = useCallback(async () => {
    if (!assetId) return;
    setLoading(true);
    try {
      const response = await fetch('/api/admin/ka-package?assetId=' + encodeURIComponent(assetId));
      const data = await readApiResponse(response);
      if (!response.ok) throw new Error(data.error || 'Unable to load content package');
      setAsset(data.asset);
      setComponents(data.components || []);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }, [assetId]);

  useEffect(() => { load(); }, [load]);

  const generate = async () => {
    if (!selected.length) return;
    setGenerating(true);
    setMessage('Generating selected components in sequence. Existing fresh components will be reused.');
    try {
      const response = await fetch('/api/admin/ka-package', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetId, componentTypes: selected, force }),
      });
      const data = await readApiResponse(response);
      if (!response.ok) throw new Error(data.error || 'Generation failed');
      const failed = (data.results || []).filter((item) => item.status !== 'ready');
      setMessage(failed.length
        ? 'Finished with ' + failed.length + ' component(s) needing attention. ' + failed.map((x) => x.componentType + ': ' + x.error).join(' | ')
        : 'Package ready. Fresh components were reused; only missing, stale or forced components were generated.');
      await load();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setGenerating(false);
    }
  };

  const componentMap = new Map(components.map((item) => [item.component_type, item]));
  const toggle = (type) => setSelected((current) => current.includes(type)
    ? current.filter((item) => item !== type) : [...current, type]);

  return (
    <main className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <Link href="/admin/knowledge-assets" className="text-sm text-blue-700 hover:underline">← Knowledge Assets</Link>
          <h1 className="text-2xl font-bold text-slate-900 mt-2">Content Package</h1>
          <p className="text-slate-500">{asset?.keyword || 'Loading Knowledge Asset…'} {asset?.subject ? '· ' + asset.subject : ''}</p>
        </div>
        <button onClick={load} disabled={loading || generating} className="px-4 py-2 rounded-lg border font-semibold disabled:opacity-50">Refresh</button>
      </div>

      <section className="bg-white border rounded-2xl p-4 md:p-6 space-y-4">
        <div>
          <h2 className="font-bold text-lg">Generate reusable components</h2>
          <p className="text-sm text-slate-500">The library checks freshness first. It reuses valid content and generates only what is missing or stale.</p>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          {COMPONENTS.map(([type, title, description]) => (
            <label key={type} className="flex gap-3 border rounded-xl p-3 cursor-pointer">
              <input type="checkbox" checked={selected.includes(type)} onChange={() => toggle(type)} disabled={generating} />
              <span className="min-w-0">
                <span className="block font-semibold text-sm">{title}</span>
                <span className="block text-xs text-slate-500">{description}</span>
              </span>
            </label>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-amber-800">
          <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} disabled={generating} />
          Force regeneration (creates a new version even when the current component is fresh)
        </label>
        <button onClick={generate} disabled={generating || loading || !selected.length} className="bg-blue-700 text-white px-5 py-3 rounded-xl font-bold disabled:opacity-50">
          {generating ? 'Generating…' : 'Generate / Reuse Selected'}
        </button>
        {message && <p aria-live="polite" className="text-sm text-slate-700 break-words">{message}</p>}
      </section>

      <section className="space-y-3">
        <h2 className="font-bold text-lg">Library status</h2>
        {loading ? <p className="text-slate-500">Loading components…</p> : COMPONENTS.map(([type, title]) => {
          const item = componentMap.get(type);
          return (
            <article key={type} className="bg-white border rounded-xl p-4">
              <div className="flex justify-between gap-3 items-start">
                <div>
                  <h3 className="font-semibold">{title}</h3>
                  <p className="text-xs text-slate-500">Version {item?.version || '—'} · {item?.status || 'Not generated'}</p>
                </div>
                <span className={'text-xs font-bold rounded-full px-3 py-1 ' + (
                  item?.stale ? 'bg-amber-100 text-amber-800' :
                  item?.status === 'ready' ? 'bg-emerald-100 text-emerald-800' :
                  item?.status === 'failed' ? 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-700'
                )}>{item?.stale ? 'Stale' : item?.status || 'Missing'}</span>
              </div>
              {item?.last_error && <p className="text-sm text-red-700 mt-2">{item.last_error}</p>}
              {item?.body && <details className="mt-3"><summary className="cursor-pointer text-sm text-blue-700 font-semibold">Preview component JSON</summary>
                <pre className="mt-2 text-xs whitespace-pre-wrap break-words bg-slate-50 rounded-lg p-3 overflow-auto max-h-96">{JSON.stringify(item.body, null, 2)}</pre>
              </details>}
            </article>
          );
        })}
      </section>
    </main>
  );
}
