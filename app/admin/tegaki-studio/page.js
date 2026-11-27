'use client';

import { useEffect, useMemo, useState } from 'react';
import { Player } from '@remotion/player';
import { StudioComposition } from '@/remotion/StudioComposition';
import { TEGAKI_ENGINE, TEGAKI_VISUAL_STYLES, createTegakiLessonScene } from '@/lib/tegaki-engine/config';

const SAMPLE = {
  heading: 'Cell Structure and Functions',
  text: 'Definition: A cell is the basic structural and functional unit of life.\n- The cell membrane controls what enters and leaves the cell.\n- The nucleus contains genetic material and controls cell activities.\n- Mitochondria release energy through aerobic respiration.\n- Ribosomes make proteins.\n- Plant cells have a cellulose cell wall, a large permanent vacuole and chloroplasts.',
};

export default function TegakiStudioPage() {
  const [heading, setHeading] = useState(SAMPLE.heading);
  const [text, setText] = useState(SAMPLE.text);
  const [duration, setDuration] = useState(40);
  const [style, setStyle] = useState('classic-notebook');
  const [brand, setBrand] = useState('SHINEY BRAIN ACADEMY');
  const [stylePreview, setStylePreview] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');

  const scene = useMemo(() => createTegakiLessonScene({
    heading, text, durationSeconds: duration,
    illustrationCues: [{ at: 0, illustration: 'animal-cell', label: 'The cell' }],
  }), [heading, text, duration]);
  const durationInFrames = Math.max(60, Math.round(duration * 30));

  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      setPreviewLoading(true);
      setPreviewError('');
      try {
        const response = await fetch('/api/admin/tegaki-studio/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: heading, text, styleId: style, subject: 'Biology' }),
        });
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Style preview failed.');
        }
        const blob = await response.blob();
        const nextUrl = URL.createObjectURL(blob);
        if (active) {
          setStylePreview((oldUrl) => {
            if (oldUrl) URL.revokeObjectURL(oldUrl);
            return nextUrl;
          });
        } else URL.revokeObjectURL(nextUrl);
      } catch (error) {
        if (active) setPreviewError(error.message);
      } finally {
        if (active) setPreviewLoading(false);
      }
    }, 450);
    return () => { active = false; clearTimeout(timer); };
  }, [heading, text, style]);

  useEffect(() => () => {
    if (stylePreview) URL.revokeObjectURL(stylePreview);
  }, [stylePreview]);

  const selectedStyle = TEGAKI_VISUAL_STYLES.find((item) => item.id === style);

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl bg-gradient-to-r from-blue-950 via-blue-800 to-sky-600 p-7 text-white shadow-lg">
          <p className="text-xs font-bold uppercase tracking-[.25em] text-sky-200">Shiney Brain Academy · Independent Video Engine</p>
          <h1 className="mt-2 text-3xl font-black md:text-4xl">{TEGAKI_ENGINE.name}</h1>
          <p className="mt-2 max-w-3xl text-sm text-blue-100">Create handwritten educational lessons and compare six genuinely rendered visual treatments.</p>
          <span className="mt-4 inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-bold">Phase 2 · Six visual styles</span>
        </header>

        <div className="grid gap-6 xl:grid-cols-[.85fr_1.15fr]">
          <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div>
              <h2 className="text-lg font-black text-slate-900">Lesson content</h2>
              <p className="mt-1 text-sm text-slate-500">Edit the lesson and the rendered page preview updates automatically. AI composition and narration controls come in Phase 3 and 4.</p>
            </div>
            <label className="block text-sm font-semibold text-slate-700">Lesson heading
              <input value={heading} onChange={e => setHeading(e.target.value)} maxLength={100} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3" />
            </label>
            <label className="block text-sm font-semibold text-slate-700">Handwritten lesson text
              <textarea value={text} onChange={e => setText(e.target.value)} rows={10} maxLength={3200} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3 leading-6" />
              <span className="mt-1 block text-right text-xs text-slate-400">{text.length}/3200 characters · use a new line for each point</span>
            </label>
            <label className="block text-sm font-semibold text-slate-700">Video duration
              <select value={duration} onChange={e => setDuration(Number(e.target.value))} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-3">
                <option value={20}>20 seconds</option><option value={30}>30 seconds</option><option value={40}>40 seconds</option><option value={60}>60 seconds</option>
              </select>
            </label>
            <label className="block text-sm font-semibold text-slate-700">Brand label
              <input value={brand} onChange={e => setBrand(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3" />
            </label>
            <div>
              <h3 className="text-sm font-bold text-slate-800">Choose a visual style</h3>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {TEGAKI_VISUAL_STYLES.map(item => (
                  <button key={item.id} type="button" onClick={() => setStyle(item.id)} aria-pressed={style === item.id}
                    className={`rounded-xl border p-3 text-left transition ${style === item.id ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-100' : 'border-slate-200 hover:border-blue-300'}`}>
                    <span className="block text-sm font-bold text-slate-800">{item.label}</span>
                    <span className="mt-1 block text-xs text-slate-500">{item.status === 'available' ? 'Rendered preview available' : 'Planned'}</span>
                  </button>
                ))}
              </div>
            </div>
            <p className="rounded-xl bg-emerald-50 p-3 text-xs leading-5 text-emerald-900">All six styles now have a real PNG rendering path. The original Video Studio and Notebook Studio routes remain separate and unchanged.</p>
          </section>

          <section className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div><h2 className="text-lg font-black text-slate-900">Rendered style proof</h2><p className="text-sm text-slate-500">{selectedStyle?.label} · 1200 × 1600 page image</p></div>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">{previewLoading ? 'Rendering…' : 'Rendered PNG'}</span>
              </div>
              {stylePreview ? <img src={stylePreview} alt={`${selectedStyle?.label} Tegaki style preview`} className="mx-auto max-h-[760px] w-auto max-w-full rounded-lg border border-slate-200 shadow-md" /> : <div className="flex min-h-64 items-center justify-center rounded-xl bg-slate-100 text-sm text-slate-500">{previewLoading ? 'Rendering your selected page style…' : 'Your rendered preview will appear here.'}</div>}
              {previewError && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{previewError}</p>}
              <p className="mt-3 text-xs leading-5 text-slate-500">This is a real server-rendered page image from the Tegaki style adapter. MP4 animation and full 9:16/16:9/1:1 video layout integration remain later-phase work.</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4"><h2 className="text-lg font-black text-slate-900">Continuous handwriting preview</h2><p className="text-sm text-slate-500">Existing Remotion composition · portrait 9:16</p></div>
              <div className="mx-auto overflow-hidden rounded-xl bg-slate-200 shadow-inner" style={{ maxWidth: 360 }}>
                <Player
                  key={duration}
                  component={StudioComposition}
                  inputProps={{ title: heading, scenes: [scene], template: 'tegaki', brand, accent: '#f4c542', narrationVolume: 1 }}
                  durationInFrames={durationInFrames}
                  compositionWidth={1080}
                  compositionHeight={1920}
                  fps={30}
                  controls
                  loop
                  style={{ width: '100%', aspectRatio: '9 / 16' }}
                />
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
