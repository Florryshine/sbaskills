'use client';
import { useEffect, useState } from 'react';
import { createBrowserClient } from '@/lib/supabase';

export default function QuestionOfTheDayPage() {
  const [assets, setAssets] = useState([]);
  const [assetId, setAssetId] = useState('');
  const [difficulty, setDifficulty] = useState('Hard');
  const [templateReady, setTemplateReady] = useState(false);
  const [templateFile, setTemplateFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [history, setHistory] = useState([]);
  const [active, setActive] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    createBrowserClient().from('knowledge_assets').select('id,keyword,subject').order('created_at', { ascending: false }).limit(300)
      .then(({ data }) => { const rows = data || []; setAssets(rows); if (rows.length) setAssetId(rows[0].id); });
    checkTemplate(); loadHistory();
  }, []);
  async function checkTemplate() {
    try { const r = await fetch('/api/admin/question-of-day/template'); const j = await r.json(); setTemplateReady(Boolean(j.uploaded)); } catch {}
  }
  async function loadHistory() {
    try { const r = await fetch('/api/admin/question-of-day'); const j = await r.json(); if (r.ok) setHistory(j.data || []); } catch {}
  }
  async function uploadTemplate() {
    if (!templateFile) return;
    setUploading(true); setError('');
    try {
      const form = new FormData(); form.append('template', templateFile);
      const r = await fetch('/api/admin/question-of-day/template', { method: 'POST', body: form });
      const j = await r.json(); if (!r.ok) throw new Error(j.error || 'Upload failed');
      setTemplateReady(true); setTemplateFile(null);
    } catch (e) { setError(e.message); } finally { setUploading(false); }
  }
  async function generate() {
    if (!assetId) return;
    setGenerating(true); setError(''); setActive(null);
    try {
      const r = await fetch('/api/admin/question-of-day', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ knowledgeAssetId: assetId, difficulty }) });
      const j = await r.json(); if (!r.ok) throw new Error(j.error || 'Generation failed');
      setActive(j.question); await loadHistory();
    } catch (e) { setError(e.message); } finally { setGenerating(false); }
  }
  async function copyCaption() {
    await navigator.clipboard.writeText(active.caption || ''); setCopied(true); setTimeout(() => setCopied(false), 1500);
  }
  function selectHistory(item) {
    setActive({
      id: item.id, question: item.body, subject: item.metadata.subject, topic: item.metadata.topic,
      difficulty: item.metadata.difficulty, options: item.metadata.options || [],
      correctOptionId: item.metadata.correctOptionId, explanation: item.metadata.explanation,
      imageUrl: item.media_files && item.media_files[0] ? item.media_files[0].url : item.metadata.image_url,
      caption: item.metadata.caption
    });
  }

  return <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
    <header>
      <p className="text-xs font-bold uppercase tracking-widest text-yellow-600">Shiney Brain Academy · Publishing</p>
      <h1 className="mt-1 text-2xl font-extrabold text-brand-blue md:text-3xl">Question of the Day</h1>
      <p className="mt-2 max-w-2xl text-sm text-gray-500">Generate an original JAMB-style question, render it on the reusable classroom photograph, and save it as a draft in the existing Social Engine.</p>
    </header>

    <section className="rounded-2xl border bg-white p-4 shadow-sm md:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="font-bold text-gray-900">1. Classroom template</h2><p className="mt-1 text-sm text-gray-500">Upload the second classroom image once. The engine keeps the photograph and replaces the whiteboard writing.</p></div>
        <span className={'rounded-full px-3 py-1 text-xs font-bold ' + (templateReady ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700')}>{templateReady ? 'Template ready' : 'Template required'}</span>
      </div>
      {!templateReady && <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input type="file" accept="image/*" onChange={(e) => setTemplateFile(e.target.files && e.target.files[0])} className="min-w-0 flex-1 text-sm" />
        <button onClick={uploadTemplate} disabled={!templateFile || uploading} className="rounded-xl bg-brand-blue px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{uploading ? 'Uploading…' : 'Save template'}</button>
      </div>}
      {templateReady && <p className="mt-3 text-sm text-green-700">✓ Saved. You only need to upload again if you change the template.</p>}
    </section>

    <section className="rounded-2xl border bg-white p-4 shadow-sm md:p-5">
      <h2 className="font-bold text-gray-900">2. Generate a JAMB question</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_160px_auto]">
        <select value={assetId} onChange={(e) => setAssetId(e.target.value)} className="rounded-xl border px-3 py-3 text-sm">
          <option value="">Select a topic from Knowledge Assets…</option>
          {assets.map((a) => <option key={a.id} value={a.id}>{a.subject ? a.subject + ' — ' : ''}{a.keyword}</option>)}
        </select>
        <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className="rounded-xl border px-3 py-3 text-sm"><option>Easy</option><option>Medium</option><option>Hard</option></select>
        <button onClick={generate} disabled={!templateReady || !assetId || generating} className="rounded-xl bg-brand-blue px-6 py-3 text-sm font-bold text-white disabled:opacity-50">{generating ? 'Generating & rendering…' : '✨ Generate image'}</button>
      </div>
      <p className="mt-2 text-xs text-gray-400">Uses the existing SBA AI fallback chain. Review the answer before publishing.</p>
      {error && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    </section>

    {active && <section className="grid gap-5 lg:grid-cols-[minmax(0,420px)_1fr]">
      <div className="overflow-hidden rounded-2xl border bg-white shadow-sm"><img src={active.imageUrl} alt="Generated SBA question" className="h-auto w-full" /></div>
      <div className="space-y-4 rounded-2xl border bg-white p-4 shadow-sm md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-bold text-gray-900">3. Review before publishing</h2><span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">Draft · Not published</span></div>
        <p className="text-sm font-semibold text-brand-blue">{active.subject} · {active.topic} · {active.difficulty}</p>
        <p className="font-semibold text-gray-900">{active.question}</p>
        <div className="space-y-2">{(active.options || []).map((o) => <div key={o.id} className={'rounded-lg border p-2 text-sm ' + (o.id === active.correctOptionId ? 'border-green-300 bg-green-50' : '')}><b>{o.id}.</b> {o.text} {o.id === active.correctOptionId && <span className="font-bold text-green-700">✓ Correct</span>}</div>)}</div>
        <div className="rounded-xl bg-blue-50 p-3"><p className="text-xs font-bold uppercase text-blue-800">Explanation</p><p className="mt-1 text-sm text-blue-950">{active.explanation}</p></div>
        <div className="flex flex-wrap gap-2">
          <a href={active.imageUrl} target="_blank" rel="noreferrer" className="rounded-lg border px-4 py-2 text-sm font-bold text-gray-700">Open image</a>
          <button onClick={copyCaption} className="rounded-lg border px-4 py-2 text-sm font-bold text-gray-700">{copied ? 'Copied!' : 'Copy caption'}</button>
          <a href="/admin/social-engine" className="rounded-lg bg-brand-blue px-4 py-2 text-sm font-bold text-white">Open Social Engine →</a>
        </div>
      </div>
    </section>}

    <section>
      <div className="mb-3 flex items-center justify-between"><h2 className="font-bold text-gray-900">Recent question drafts</h2><button onClick={loadHistory} className="text-sm font-semibold text-brand-blue">Refresh</button></div>
      {!history.length ? <p className="rounded-xl border border-dashed p-6 text-center text-sm text-gray-400">No questions generated yet.</p> : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {history.map((item) => <button key={item.id} onClick={() => selectHistory(item)} className="flex gap-3 rounded-xl border bg-white p-3 text-left hover:border-blue-300">
          {item.media_files && item.media_files[0] && <img src={item.media_files[0].url} alt="" className="h-24 w-16 rounded object-cover" />}
          <span className="min-w-0"><span className="block text-xs font-bold text-brand-blue">{item.metadata.subject || 'JAMB'} · {item.metadata.difficulty || 'Practice'}</span><span className="mt-1 line-clamp-3 block text-sm font-semibold text-gray-800">{item.body}</span><span className="mt-2 block text-xs text-gray-400">{new Date(item.created_at).toLocaleDateString()}</span></span>
        </button>)}
      </div>}
    </section>
  </div>;
}
