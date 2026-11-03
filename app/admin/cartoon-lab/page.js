'use client';

import React from 'react';
import { Player } from '@remotion/player';
import { CartoonCharacterShowcase } from '@/remotion/cartoon/CartoonCharacterShowcase';

export default function CartoonCharacterLabPage() {
  return (
    <main className="mx-auto max-w-6xl space-y-5 px-4 py-6">
      <header className="rounded-3xl bg-gradient-to-r from-slate-950 via-blue-950 to-blue-700 p-6 text-white sm:p-8">
        <p className="text-xs font-black tracking-[.25em] text-yellow-300">SHINEY BRAIN • ANIMATION R&D</p>
        <h1 className="mt-2 text-3xl font-black sm:text-4xl">Cartoon Character Lab</h1>
        <p className="mt-2 max-w-2xl text-blue-100">Phase 2 prototype: a reusable layered SVG character, facial expressions, poses and a four-scene story preview.</p>
      </header>

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="overflow-hidden rounded-3xl border bg-slate-950 p-3 shadow-xl">
          <Player
            component={CartoonCharacterShowcase}
            durationInFrames={960}
            fps={30}
            compositionWidth={1080}
            compositionHeight={1920}
            style={{ width: '100%', aspectRatio: '9 / 16', maxHeight: '78vh' }}
            controls
            autoPlay={false}
            loop
            clickToPlay
          />
        </div>
        <aside className="space-y-4 rounded-2xl border bg-white p-5">
          <div>
            <h2 className="font-extrabold text-slate-900">Prototype contents</h2>
            <p className="mt-1 text-sm text-slate-600">The character is built from separate SVG groups, not a flat image.</p>
          </div>
          <ul className="space-y-2 text-sm text-slate-700">
            <li>✓ Layered head, eyes, brows and mouth</li>
            <li>✓ Separate torso, arms, legs and shoes</li>
            <li>✓ Seven facial expressions</li>
            <li>✓ Standing, sitting, walking, pointing and waving poses</li>
            <li>✓ Idle bob, blinking, head movement and mouth movement</li>
            <li>✓ Two character colour variants</li>
            <li>✓ Four illustrated story scenes</li>
          </ul>
          <div className="rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-950">
            This is an engineering prototype, not the final visual standard. The next quality pass should improve the character artwork, limb articulation and natural movement before we automate story generation.
          </div>
        </aside>
      </section>
    </main>
  );
}
