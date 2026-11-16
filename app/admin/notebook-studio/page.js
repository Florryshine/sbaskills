'use client';

import { useEffect, useMemo, useState } from 'react';
import { createBrowserClient } from '@/lib/supabase';

const CATEGORIES = [
  ['topic_of_the_day', 'Topic of the Day'],
  ['question_of_the_day', 'Question of the Day'],
  ['fact_of_the_day', 'Fact of the Day'],
  ['lesson_note', 'Lesson Notes'],
  ['quick_revision', 'Quick Revision'],
  ['exam_tips', 'Exam Tips'],
];

const TEMPLATES = [
  { id: 'classic', name: 'Classic Notebook', description: 'Ruled exercise-book paper and blue-ink handwriting.' },
  { id: 'premium', name: 'Premium Blue Notes', description: 'Cleaner paper, soft blue accents and spacious layout.' },
  { id: 'revision', name: 'Exam Revision Sheet', description: 'Compact revision layout for quick exam preparation.' },
];

export default function NotebookStudioPage() {
  const supabase = useMemo(() => createBrowserClient(), []);
  const [subjects, setSubjects] = useState([]);
  const [selected, setSelected] = useState([]);
  const [template, setTemplate] = useState('classic');
  const [imageCount, setImageCount] = useState(1);
  const [category, setCategory] = useState('lesson_note');
  const [loadingSubjects, setLoadingSubjects] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState('');
  const [batch, setBatch] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    async function load() {
      const { data, error: loadError } = await supabase
        .from('knowledge_assets')
        .select('subject')
        .contains('exam_type', ['JAMB'])
        .not('subject', 'is', null)
        .order('subject');
      if (!alive) return;
      if (loadError) setError(loadError.message);
      const unique = [...new Set((data || []).map((row) => row.subject).filter(Boolean))].sort();
      setSubjects(unique);
      setLoadingSubjects(false);
    }
    load();
    return () => { alive = false; };
  }, [supabase]);

  const toggleSubject = (subject) => setSelected((current) =>
    current.includes(subject) ? current.filter((item) => item !== subject) : [...current, subject]
  );

  const generate = async () => {
    if (!selected.length || generating) return;
    setGenerating(true);
    setError('');
    setBatch(null);
    setProgress(`Generating ${imageCount === 30 ? 'the full 30-image batch' : `${imageCount} ${category.replace(/_/g, ' ')} image(s)`}. This may take a few minutes.`);
    try {
      const response = await fetch('/api/admin/notebook-studio/generate-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subjects: selected, template, count: imageCount, category: imageCount === 30 ? 'all' : category }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Notebook generation failed.');
      setBatch(data);
      setProgress('');
      if (data.failures?.length) setError(`${data.failed} item(s) failed. Successful images have been saved and are available below.`);
    } catch (generationError) {
      setError(generationError.message);
      setProgress('');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-7">
        <header className="rounded-3xl bg-gradient-to-r from-blue-950 via-blue-800 to-sky-600 p-7 text-white shadow-lg">
          <p className="text-xs font-bold uppercase tracking-[.25em] text-sky-200">Shiney Brain Academy</p>
          <h1 className="mt-2 text-3xl font-black md:text-4xl">Notebook Studio</h1>
          <p className="mt-2 max-w-2xl text-sm text-blue-100">Turn JAMB Knowledge Assets into consistent, handwritten classroom content — ready for review and publishing.</p>
        </header>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">1. Choose JAMB subjects</h2>
            <p className="mt-1 text-sm text-slate-500">The engine rotates through available Knowledge Assets across your selected subjects.</p>
            {loadingSubjects ? <p className="py-8 text-sm text-slate-500">Loading subjects…</p> : (
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {subjects.map((subject) => (
                  <button key={subject} type="button" onClick={() => toggleSubject(subject)}
                    className={`rounded-xl border px-3 py-3 text-left text-sm font-semibold transition ${selected.includes(subject) ? 'border-blue-600 bg-blue-50 text-blue-800 ring-2 ring-blue-100' : 'border-slate-200 text-slate-700 hover:border-blue-300'}`}>
                    {selected.includes(subject) ? '✓ ' : ''}{subject}
                  </button>
                ))}
                {!subjects.length && <p className="col-span-full py-5 text-sm text-amber-700">No JAMB subjects with Knowledge Assets were found.</p>}
              </div>
            )}
            <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
              <span className="text-sm text-slate-500">{selected.length} subject(s) selected</span>
              <button type="button" onClick={() => setSelected(subjects)} className="text-sm font-bold text-blue-700">Select all</button>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900">2. Choose a visual template</h2>
              <div className="mt-4 space-y-3">
                {TEMPLATES.map((item) => (
                  <button key={item.id} type="button" onClick={() => setTemplate(item.id)}
                    className={`w-full rounded-xl border p-4 text-left ${template === item.id ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-100' : 'border-slate-200 hover:border-blue-300'}`}>
                    <span className="block font-bold text-slate-800">{item.name}</span>
                    <span className="mt-1 block text-xs text-slate-500">{item.description}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900">3. Generation plan</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-semibold text-slate-700">Number of images
                  <select value={imageCount} onChange={(event) => { const next = Number(event.target.value); setImageCount(next); if (next === 30) setCategory('all'); else if (category === 'all') setCategory('lesson_note'); }} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-3">
                    <option value={1}>1 image</option><option value={2}>2 images</option><option value={5}>5 images</option><option value={30}>Full batch — 30 images</option>
                  </select>
                </label>
                <label className="text-sm font-semibold text-slate-700">Content type
                  <select value={imageCount === 30 ? 'all' : category} onChange={(event) => setCategory(event.target.value)} disabled={imageCount === 30} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 disabled:bg-slate-100 disabled:text-slate-500">
                    <option value="all">All six categories (batch)</option>{CATEGORIES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                  </select>
                </label>
              </div>
              <div className="mt-3 rounded-lg bg-blue-50 p-3 text-sm text-blue-900">{imageCount === 30 ? 'Creates the original full batch: 5 posts in each of the 6 categories.' : `Creates exactly ${imageCount} ${category.replace(/_/g, ' ')} image(s). The full 30-image batch remains available.`}</div>
              <button type="button" disabled={!selected.length || generating || loadingSubjects} onClick={generate}
                className="mt-5 w-full rounded-xl bg-blue-700 px-5 py-3 font-bold text-white shadow-sm transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50">
                {generating ? `Generating ${imageCount} image(s)…` : `Generate ${imageCount === 30 ? '30 notebook posts' : `${imageCount} notebook image(s)`}`}
              </button>
              {progress && <p className="mt-3 text-sm text-blue-700">{progress}</p>}
              {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            </div>
          </div>
        </section>

        {batch && (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div><h2 className="text-xl font-black text-slate-900">Generation results</h2><p className="mt-1 text-sm text-slate-500">Batch {batch.batchId}</p></div>
              <div className="flex gap-4 text-sm"><span className="font-bold text-emerald-700">{batch.generated} saved</span><span className="font-bold text-red-600">{batch.failed} failed</span></div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl bg-blue-50 p-4 text-sm text-blue-900"><span>These drafts are saved in the existing Social Engine. Review, edit, and approve them there before publishing.</span><a href="/admin/social-engine" className="rounded-lg bg-blue-700 px-4 py-2 font-bold text-white hover:bg-blue-800">Open Social Engine →</a></div>
            {batch.failures?.length > 0 && (
              <details className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-800">
                <summary className="cursor-pointer font-bold">Why {batch.failures.length} item(s) failed</summary>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {batch.failures.map((failure, index) => (
                    <li key={`${failure.category}-${index}`}><span className="font-semibold">{String(failure.category || '').replace(/_/g, ' ')}{failure.topic ? ` · ${failure.topic}` : ''}:</span> {failure.error}</li>
                  ))}
                </ul>
              </details>
            )}
            <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {batch.results.map((item) => (
                <article key={item.id} className="overflow-hidden rounded-xl border border-slate-200">
                  <a href={item.imageUrl} target="_blank" rel="noopener noreferrer" title="Open full-size image">
                    <img src={item.imageUrl} alt={item.title} loading="lazy" className="aspect-[3/4] w-full bg-slate-50 object-contain" />
                  </a>
                  <div className="p-3"><p className="font-bold text-slate-800">{item.title}</p><p className="mt-1 text-xs text-slate-500">{item.subject} · {item.topic}</p><p className="mt-1 text-xs font-semibold uppercase tracking-wide text-blue-700">{item.category.replace(/_/g, ' ')}</p></div>
                </article>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
