'use client';

import { useMemo, useState } from 'react';
import { Player } from '@remotion/player';
import { StudioComposition } from '@/remotion/StudioComposition';
import { TEGAKI_ENGINE, TEGAKI_VISUAL_STYLES, createTegakiLessonScene } from '@/lib/tegaki-engine/config';

const SAMPLE = {
  heading: 'Cell Structure and Functions',
  text: 'The cell is the basic structural and functional unit of life. The cell membrane controls what enters and leaves the cell. The nucleus contains genetic material and controls cell activities. Mitochondria release energy through aerobic respiration, while ribosomes make proteins. Plant cells also have a cellulose cell wall, a large permanent vacuole and chloroplasts for photosynthesis.',
};

export default function TegakiStudioPage() {
  const [heading, setHeading] = useState(SAMPLE.heading);
  const [text, setText] = useState(SAMPLE.text);
  const [duration, setDuration] = useState(40);
  const [style, setStyle] = useState('classic-notebook');
  const [brand, setBrand] = useState('SHINEY BRAIN ACADEMY');

  const scene = useMemo(() => createTegakiLessonScene({
    heading, text, durationSeconds: duration,
    illustrationCues: [{ at: 0, illustration: 'animal-cell', label: 'The cell' }],
  }), [heading, text, duration]);
  // The existing Tegaki composition is authored for portrait 9:16. Other ratios
  // remain disabled until their layouts are implemented and visually tested.
  const width = 1080;
  const height = 1920;
  const durationInFrames = Math.max(60, Math.round(duration * 30));

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl bg-gradient-to-r from-blue-950 via-blue-800 to-sky-600 p-7 text-white shadow-lg">
          <p className="text-xs font-bold uppercase tracking-[.25em] text-sky-200">Shiney Brain Academy · Independent Video Engine</p>
          <h1 className="mt-2 text-3xl font-black md:text-4xl">{TEGAKI_ENGINE.name}</h1>
          <p className="mt-2 max-w-3xl text-sm text-blue-100">Create continuous handwritten educational lessons with progressive writing and changing scientific illustrations.</p>
          <span className="mt-4 inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-bold">Phase 1 foundation · Preview ready</span>
        </header>

        <div className="grid gap-6 xl:grid-cols-[.85fr_1.15fr]">
          <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div>
              <h2 className="text-lg font-black text-slate-900">Lesson content</h2>
              <p className="mt-1 text-sm text-slate-500">Phase 1 uses editable sample content. Knowledge Asset generation and narration controls are scheduled for later phases.</p>
            </div>
            <label className="block text-sm font-semibold text-slate-700">Lesson heading
              <input value={heading} onChange={e => setHeading(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3" />
            </label>
            <label className="block text-sm font-semibold text-slate-700">Handwritten lesson / narration
              <textarea value={text} onChange={e => setText(e.target.value)} rows={9} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3 leading-6" />
            </label>
            <label className="block text-sm font-semibold text-slate-700">Duration
              <select value={duration} onChange={e => setDuration(Number(e.target.value))} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-3">
                <option value={20}>20 seconds</option><option value={30}>30 seconds</option><option value={40}>40 seconds</option><option value={60}>60 seconds</option>
              </select>
            </label>
            <label className="block text-sm font-semibold text-slate-700">Brand label
              <input value={brand} onChange={e => setBrand(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3" />
            </label>
            <div>
              <h3 className="text-sm font-bold text-slate-800">Visual style roadmap</h3>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {TEGAKI_VISUAL_STYLES.map(item => (
                  <button key={item.id} type="button" onClick={() => item.status === 'available' && setStyle(item.id)} className={`rounded-xl border p-3 text-left ${style === item.id ? 'border-blue-600 bg-blue-50' : 'border-slate-200'} ${item.status !== 'available' ? 'cursor-not-allowed opacity-60' : ''}`}>
                    <span className="block text-sm font-bold text-slate-800">{item.label}</span>
                    <span className="mt-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">{item.status === 'available' ? 'Available now' : 'Planned'}</span>
                  </button>
                ))}
              </div>
            </div>
            <p className="rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900">This phase intentionally preserves the original Video Studio and its existing rendering path. The new style options are roadmap markers, not falsely advertised working features.</p>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div><h2 className="text-lg font-black text-slate-900">Live Tegaki preview</h2><p className="text-sm text-slate-500">Existing Remotion Tegaki composition · continuous page</p></div>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">Preview only</span>
            </div>
            <div className="mx-auto overflow-hidden rounded-xl bg-slate-200 shadow-inner" style={{ maxWidth: 430 }}>
              <Player
                key={duration + style}
                component={StudioComposition}
                inputProps={{ title: heading, scenes: [scene], template: 'tegaki', brand, accent: '#f4c542', narrationVolume: 1 }}
                durationInFrames={durationInFrames}
                compositionWidth={width}
                compositionHeight={height}
                fps={30}
                controls
                loop
                style={{ width: '100%', aspectRatio: '9 / 16' }}
              />
            </div>
            <p className="mt-4 text-xs leading-5 text-slate-500">The preview currently uses the existing classic notebook treatment. The new independent renderer, style-specific layouts, AI composition, narration generation and MP4 export will be added in subsequent phases.</p>
          </section>
        </div>
      </div>
    </main>
  );
}
