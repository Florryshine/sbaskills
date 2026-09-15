'use client';

import { useEffect, useMemo, useState } from 'react';
import { createBrowserClient } from '@/lib/supabase';

const emptyBlueprint = {
  objectives: [],
  concepts: [],
  prerequisites: [],
  misconceptions: [],
  teachingStrategy: 'concept_mastery',
  difficulty: 'beginner',
};

function diagnosticsFor(lesson) {
  return Array.isArray(lesson?.generation_diagnostics) ? lesson.generation_diagnostics : [];
}

export default function BiteSizedLessonEditor({ lesson, onLessonUpdated }) {
  const supabase = useMemo(() => createBrowserClient(), []);
  const [assets, setAssets] = useState([]);
  const [assetId, setAssetId] = useState('');
  const [rawNotes, setRawNotes] = useState('');
  const [instructions, setInstructions] = useState('');
  const [blueprint, setBlueprint] = useState(lesson?.learning_blueprint || emptyBlueprint);
  const [screens, setScreens] = useState([]);
  const [loading, setLoading] = useState(false);
  const [savingScreenId, setSavingScreenId] = useState('');
  const [searchingScreenId, setSearchingScreenId] = useState('');
  const [attachingScreenId, setAttachingScreenId] = useState('');
  const [candidatesByScreen, setCandidatesByScreen] = useState({});
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    async function load() {
      const [{ data: assetRows }, { data: screenRows }] = await Promise.all([
        supabase
          .from('knowledge_assets')
          .select('id, keyword, summary, learning_objectives, difficulty, subject')
          .order('created_at', { ascending: false })
          .limit(200),
        supabase
          .from('lesson_screens')
          .select('*')
          .eq('lesson_id', lesson.id)
          .order('order_index', { ascending: true }),
      ]);
      if (!active) return;
      setAssets(assetRows || []);
      setScreens(screenRows || []);
    }
    load();
    return () => { active = false; };
  }, [lesson.id, supabase]);

  useEffect(() => {
    setBlueprint(lesson?.learning_blueprint || emptyBlueprint);
  }, [lesson?.learning_blueprint]);

  const updateLesson = (patch) => {
    onLessonUpdated?.({ ...lesson, ...patch });
  };

  async function generateBlueprint() {
    setLoading(true);
    setMessage('Generating the Learning Blueprint...');
    try {
      const response = await fetch('/api/admin/bite-sized/blueprint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lessonId: lesson.id,
          knowledgeAssetId: assetId || undefined,
          rawNotes,
          administratorInstructions: instructions,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Blueprint generation failed.');
      setBlueprint(data.blueprint);
      updateLesson({ learning_blueprint: data.blueprint, generation_status: data.generationStatus, generation_diagnostics: data.diagnostics || [] });
      setMessage('Blueprint ready for review.');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function generateScreens() {
    setLoading(true);
    setMessage('Generating screens from the approved Blueprint...');
    try {
      const response = await fetch('/api/admin/bite-sized/screens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessonId: lesson.id, blueprint }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Screen generation failed.');
      const { data: screenRows, error } = await supabase
        .from('lesson_screens')
        .select('*')
        .eq('lesson_id', lesson.id)
        .order('order_index', { ascending: true });
      if (error) throw error;
      setScreens(screenRows || []);
      updateLesson({ generation_status: data.generationStatus, generation_diagnostics: data.diagnostics || [], learning_blueprint: data.screens?.learningBlueprint || blueprint });
      setMessage(`${data.screenCount} instructional screens generated. Review before publishing.`);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  function updateScreen(id, patch) {
    setScreens((current) => current.map((screen) => (screen.id === id ? { ...screen, ...patch } : screen)));
  }

  async function saveScreen(screen) {
    setSavingScreenId(screen.id);
    setMessage('Saving screen...');
    const { error } = await supabase
      .from('lesson_screens')
      .update({
        headline: screen.headline,
        body: screen.body,
        image_alt: screen.image_alt,
      })
      .eq('id', screen.id);
    setSavingScreenId('');
    setMessage(error ? error.message : 'Screen saved.');
  }

  async function searchImages(screen) {
    const query = screen.image_query || '';
    if (!query.trim()) {
      setMessage('This screen has no image query. Add one only when an image would teach something useful.');
      return;
    }
    setSearchingScreenId(screen.id);
    setMessage('Searching image candidates...');
    try {
      const response = await fetch('/api/admin/bite-sized/images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'search', query }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Image search failed.');
      setCandidatesByScreen((current) => ({ ...current, [screen.id]: data.candidates || [] }));
      setMessage(`${data.candidates?.length || 0} image candidates found.`);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSearchingScreenId('');
    }
  }

  async function publishLesson(publish = true) {
    setLoading(true);
    setMessage(publish ? 'Validating and publishing lesson...' : 'Returning lesson to draft...');
    try {
      const response = await fetch('/api/admin/bite-sized/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessonId: lesson.id, publish }),
      });
      const data = await response.json();
      if (!response.ok) {
        const error = new Error(data.error || 'Publishing failed.');
        error.diagnostics = data.diagnostics || [];
        throw error;
      }
      updateLesson({ is_published: publish, generation_status: data.generationStatus, generation_diagnostics: data.diagnostics || [] });
      setMessage(publish ? 'Lesson published.' : 'Lesson returned to draft.');
    } catch (error) {
      setMessage(error.message);
      if (error.diagnostics?.length) updateLesson({ generation_status: 'needs_review', generation_diagnostics: error.diagnostics });
    } finally {
      setLoading(false);
    }
  }

  async function attachImage(screen, candidate) {
    setAttachingScreenId(screen.id);
    setMessage('Downloading and attaching the image to stable storage...');
    try {
      const response = await fetch('/api/admin/bite-sized/images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'attach',
          screenId: screen.id,
          candidate,
          imageAlt: screen.image_alt || screen.headline || screen.body?.slice(0, 120) || 'Instructional image',
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Image attachment failed.');
      setScreens((current) => current.map((item) => item.id === screen.id ? data.screen : item));
      setMessage('Image attached to stable storage.');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setAttachingScreenId('');
    }
  }

  const diagnostics = diagnosticsFor(lesson);
  const errors = diagnostics.filter((item) => item.severity === 'error');
  const warnings = diagnostics.filter((item) => item.severity === 'warning');

  return (
    <div className="mt-4 rounded-2xl border border-brand-blue/20 bg-blue-50/40 p-4 space-y-5">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-extrabold text-brand-blue">Bite-Sized Lesson Studio</h3>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-bold uppercase tracking-wide text-brand-blue">
            {lesson.generation_status || 'draft'}
          </span>
        </div>
        <p className="mt-1 text-sm text-slate-600">
          Generate a Blueprint first, review it, then generate as many small instructional screens as the topic needs. There is no per-screen word-count limit.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-sm font-semibold text-slate-700">
          Knowledge Asset
          <select
            value={assetId}
            onChange={(event) => setAssetId(event.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-normal"
          >
            <option value="">Use raw notes or choose an asset</option>
            {assets.map((asset) => (
              <option key={asset.id} value={asset.id}>{asset.keyword} · {asset.subject || 'General'}</option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold text-slate-700">
          Administrator instructions
          <input
            value={instructions}
            onChange={(event) => setInstructions(event.target.value)}
            placeholder="Optional teaching emphasis"
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-normal"
          />
        </label>
      </div>

      <label className="block text-sm font-semibold text-slate-700">
        Raw notes fallback
        <textarea
          value={rawNotes}
          onChange={(event) => setRawNotes(event.target.value)}
          rows={4}
          placeholder="Use this only when no Knowledge Asset is attached."
          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-normal"
        />
      </label>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={generateBlueprint} disabled={loading} className="rounded-full bg-brand-blue px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
          {loading ? 'Working...' : 'Generate Blueprint'}
        </button>
        <button type="button" onClick={generateScreens} disabled={loading || !blueprint?.objectives?.length} className="rounded-full bg-brand-yellow px-4 py-2 text-sm font-bold text-brand-dark disabled:opacity-50">
          Generate Screens
        </button>
        <button type="button" onClick={() => publishLesson(!lesson.is_published)} disabled={loading || !screens.length} className="rounded-full border border-emerald-600 px-4 py-2 text-sm font-bold text-emerald-700 disabled:opacity-50">
          {lesson.is_published ? 'Return to Draft' : 'Validate & Publish'}
        </button>
      </div>

      {message ? <p className="rounded-xl bg-white px-3 py-2 text-sm text-slate-700">{message}</p> : null}

      <section className="rounded-xl bg-white p-4">
        <div className="flex items-center justify-between gap-2">
          <h4 className="font-bold text-slate-800">Learning Blueprint</h4>
          <span className="text-xs text-slate-500">Review before Stage 2</span>
        </div>
        <div className="mt-3 grid gap-3 text-sm md:grid-cols-2">
          <div><strong>Objectives</strong><ul className="mt-1 list-disc pl-5">{(blueprint?.objectives || []).map((item, index) => <li key={index}>{item}</li>)}</ul></div>
          <div><strong>Concepts</strong><ul className="mt-1 list-disc pl-5">{(blueprint?.concepts || []).map((item, index) => <li key={index}>{item}</li>)}</ul></div>
          <div><strong>Misconceptions</strong><ul className="mt-1 list-disc pl-5">{(blueprint?.misconceptions || []).map((item, index) => <li key={index}>{item}</li>)}</ul></div>
          <div><strong>Strategy</strong><p className="mt-1">{blueprint?.teachingStrategy || 'Not generated yet'} · {blueprint?.difficulty || '—'}</p></div>
        </div>
      </section>

      {(errors.length || warnings.length) ? (
        <section className="rounded-xl bg-white p-4">
          <h4 className="font-bold text-slate-800">Validator diagnostics</h4>
          <div className="mt-2 space-y-2 text-sm">
            {diagnostics.map((item, index) => (
              <div key={`${item.code}-${index}`} className={`rounded-lg px-3 py-2 ${item.severity === 'error' ? 'bg-red-50 text-red-700' : item.severity === 'warning' ? 'bg-amber-50 text-amber-700' : 'bg-slate-50 text-slate-600'}`}>
                <strong className="uppercase">{item.severity}</strong> · {item.message}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-bold text-slate-800">Screens ({screens.length})</h4>
          <span className="text-xs text-slate-500">Edit text and alt text before publishing</span>
        </div>
        {screens.map((screen, index) => (
          <div key={screen.id} className="rounded-xl bg-white p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wide text-brand-blue">{index + 1}. {screen.type}</span>
              <span className="text-xs text-slate-500">Objective {Number.isInteger(screen.objective_index) ? screen.objective_index + 1 : '—'}</span>
            </div>
            <input value={screen.headline || ''} onChange={(event) => updateScreen(screen.id, { headline: event.target.value })} className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 font-bold" placeholder="Screen headline" />
            <textarea value={screen.body || ''} onChange={(event) => updateScreen(screen.id, { body: event.target.value })} rows={3} className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2" placeholder="Screen body" />
            <input value={screen.image_alt || ''} onChange={(event) => updateScreen(screen.id, { image_alt: event.target.value })} className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Accessible image description (optional)" />
            {screen.image_url ? <img src={screen.image_url} alt={screen.image_alt || ''} className="mt-3 max-h-40 rounded-lg object-cover" /> : null}
            {screen.image_query ? (
              <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-slate-600">Image query: {screen.image_query}</span>
                  <button type="button" onClick={() => searchImages(screen)} disabled={searchingScreenId === screen.id} className="rounded-full border border-brand-blue px-3 py-1 text-xs font-bold text-brand-blue disabled:opacity-50">
                    {searchingScreenId === screen.id ? 'Searching...' : 'Find images'}
                  </button>
                </div>
                {(candidatesByScreen[screen.id] || []).length ? (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {candidatesByScreen[screen.id].map((candidate, candidateIndex) => (
                      <button type="button" key={`${candidate.url}-${candidateIndex}`} onClick={() => attachImage(screen, candidate)} disabled={attachingScreenId === screen.id} className="overflow-hidden rounded-lg border border-slate-200 bg-white text-left disabled:opacity-50">
                        <img src={candidate.url} alt="" className="h-24 w-full object-cover" />
                        <span className="block truncate px-2 py-1 text-[11px] text-slate-600">{candidate.source || 'Image'} · {candidate.photographer || 'Unknown author'}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
            <button type="button" onClick={() => saveScreen(screen)} disabled={savingScreenId === screen.id} className="mt-2 rounded-full border border-brand-blue px-3 py-1.5 text-xs font-bold text-brand-blue disabled:opacity-50">
              {savingScreenId === screen.id ? 'Saving...' : 'Save screen'}
            </button>
          </div>
        ))}
        {!screens.length ? <div className="rounded-xl border border-dashed border-slate-200 bg-white p-5 text-center text-sm text-slate-500">Generate screens after reviewing the Blueprint.</div> : null}
      </section>
    </div>
  );
}
