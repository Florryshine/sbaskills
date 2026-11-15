'use client';
import { readApiResponse } from '@/lib/client/read-api-response';

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
    setProgress('Generating 6 content batches, then rendering and saving up to 30 branded notebook images. This may take a few minutes.');
    try {
      const response = await fetch('/api/admin/notebook-studio/generate-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subjects: selected, template, perCategory: 5 }),
      });
      const data = await readApiResponse(response);
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
              <div className="mt-4 space-y-2">
                {CATEGORIES.map(([key, label]) => <div key={key} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm"><span className="text-slate-700">{label}</span><strong className="text-blue-800">5 posts</strong></div>)}
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
                <span className="font-bold text-slate-900">Total batch</span><span className="text-2xl font-black text-blue-800">30</span>
              </div>
              <button type="button" disabled={!selected.length || generating || loadingSubjects} onClick={generate}
                className="mt-5 w-full rounded-xl bg-blue-700 px-5 py-3 font-bold text-white shadow-sm transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50">
                {generating ? 'Generating 30 posts…' : 'Generate 30 notebook posts'}
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
            <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {batch.results.map((item) => (
                <article key={item.id} className="overflow-hidden rounded-xl border border-slate-200">
                  <img src={item.imageUrl} alt={item.title} className="aspect-[3/4] w-full bg-slate-50 object-cover" />
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
