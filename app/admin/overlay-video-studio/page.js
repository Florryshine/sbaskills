'use client';
import { useState } from 'react';
export default function OverlayVideoStudio() {
  const [text, setText] = useState('Your overlay text goes here');
  return <main className="mx-auto max-w-6xl space-y-5 p-4">
    <header className="rounded-3xl bg-blue-900 p-6 text-white">
      <p className="text-xs font-bold tracking-widest text-yellow-300">SHINEY BRAIN ACADEMY</p>
      <h1 className="mt-2 text-3xl font-black">Overlay Video Studio</h1>
      <p className="mt-2 text-blue-100">Upload footage, find stock clips, add music and style your text.</p>
    </header>
    <section className="grid gap-5 lg:grid-cols-2">
      <div className="space-y-4 rounded-2xl border bg-white p-4">
        <h2 className="text-lg font-bold">Background video</h2>
        <label className="block rounded-xl border-2 border-dashed p-5 text-center">Upload a video from your device<input className="mt-3 block w-full" type="file" accept="video/*" /></label>
        <h2 className="text-lg font-bold">Stock video search</h2>
        <div className="flex gap-2"><input className="min-w-0 flex-1 rounded-xl border p-3" placeholder="e.g. satisfying cutting, gaming" /><button className="rounded-xl bg-blue-700 px-4 text-white">Search</button></div>
        <h2 className="text-lg font-bold">Background music</h2>
        <input type="file" accept="audio/*" />
        <h2 className="text-lg font-bold">Overlay text</h2>
        <textarea className="w-full rounded-xl border p-3" rows={3} value={text} onChange={e => setText(e.target.value)} />
        <div className="grid grid-cols-2 gap-3"><label>Text colour<input className="block h-10 w-full" type="color" defaultValue="#ffffff" /></label><label>Text size<input className="block w-full" type="range" min="24" max="120" defaultValue="72" /></label></div>
      </div>
      <div className="rounded-2xl border bg-slate-50 p-4"><h2 className="mb-3 text-lg font-bold">Preview</h2><div className="mx-auto flex aspect-[9/16] max-w-xs items-center justify-center rounded-2xl bg-slate-900 p-6 text-center text-4xl font-black text-white">{text}</div><button className="mt-4 w-full rounded-xl bg-yellow-400 p-3 font-bold text-blue-950">Preview and export will be enabled in the next build step</button></div>
    </section>
  </main>;
}