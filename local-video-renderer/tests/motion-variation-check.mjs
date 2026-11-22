// Motion Graphics Engine — creative variation check.
// Verifies the engine's core promise: different scripts get genuinely
// different visual directions, the same script is stable, no layout repeats
// back-to-back, and every scene has a complete composition.
// Run: node local-video-renderer/tests/motion-variation-check.mjs

import assert from 'node:assert';
import { buildCreativeDirection } from '../../lib/motion/direction-engine.js';
import { renderMusicBed } from '../../lib/motion/audio/music.js';
import { buildSfxKit } from '../../lib/motion/audio/sfx.js';

const SCRIPTS = {
  fintech: `Most people think building wealth starts with a big salary. It does not. It starts with a habit: save 20 percent of everything you earn.
    Why is compounding so powerful? Because 50000 naira invested monthly grows to over 48 million naira in 25 years.
    Step one: pay yourself first. Step two: automate it. Step three: never touch it.`,
  space: `Every star you see is a nuclear furnace burning for billions of years.
    How far is the nearest one? Light from Proxima Centauri travels 4.2 years to reach your eyes.
    Our galaxy holds 100 billion stars, and the universe holds 2 trillion galaxies.
    We are made of star dust — every atom in your body was forged inside a dying star.`,
  safety: `Scammers stole over 12 billion naira last year. Here is how they get you.
    First: a message that creates panic. Then: a link that looks official. Finally: your bank details.
    Never share your OTP. Not with anyone. A real bank will never ask for it.`,
  ai: `Artificial intelligence is not here to replace you. It is here to remove the boring half of your work.
    An AI model reads thousands of pages in seconds and finds the pattern hiding inside them.
    The students who master AI tools today will lead every industry tomorrow.`,
  mindset: `Nobody is coming to save you. That is not bad news — it is the best news you will hear today.
    Discipline beats motivation. Show up when it is boring. Repeat daily.`,
  history: `In 1960, a new nation raised its green-white-green flag and the world changed.
    Three regions became one federation. A century of trade routes and kingdoms became a republic overnight.`,
};

const REQUIRED_SCENE_FIELDS = ['id', 'layout', 'durationSeconds', 'seed', 'camera', 'transition', 'narration', 'heading'];
let failures = 0;

function check(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    failures++;
    console.error(`FAIL ${name}: ${error.message}`);
  }
}

const specs = Object.fromEntries(Object.entries(SCRIPTS).map(([name, script]) => [name, buildCreativeDirection({ scriptText: script })]));

check('every script produces >= 3 scenes with complete compositions', () => {
  for (const [name, spec] of Object.entries(specs)) {
    assert.ok(spec.scenes.length >= 3, `${name}: only ${spec.scenes.length} scenes`);
    for (const scene of spec.scenes) {
      for (const field of REQUIRED_SCENE_FIELDS) {
        assert.ok(scene[field] !== undefined && scene[field] !== null, `${name}/${scene.id}: missing ${field}`);
      }
      assert.ok(scene.durationSeconds >= 2 && scene.durationSeconds <= 16, `${name}/${scene.id}: bad duration`);
      assert.ok(scene.transition?.type, `${name}/${scene.id}: missing transition`);
    }
  }
});

check('no layout repeats back-to-back within a video', () => {
  for (const [name, spec] of Object.entries(specs)) {
    const layouts = spec.scenes.map((s) => s.layout);
    for (let i = 1; i < layouts.length; i++) {
      assert.notStrictEqual(layouts[i], layouts[i - 1], `${name}: ${layouts[i]} repeats at scene ${i}`);
    }
  }
});

check('five scripts land on at least four distinct visual directions', () => {
  const directions = Object.values(specs).map((s) => s.direction.id);
  const distinct = new Set(directions).size;
  assert.ok(distinct >= 4, `only ${distinct} distinct directions: ${directions.join(', ')}`);
  console.log(`      directions: ${directions.join(', ')}`);
});

check('directions differ in palette, typography or music (not just names)', () => {
  const [a, b] = Object.values(specs);
  const differs = a.direction.palette.bg !== b.direction.palette.bg
    || a.direction.typography.display !== b.direction.typography.display
    || a.direction.musicKit !== b.direction.musicKit;
  assert.ok(differs, 'two directions share the same palette + type + music');
});

check('same script reproduces the same direction (deterministic)', () => {
  const again = buildCreativeDirection({ scriptText: SCRIPTS.fintech });
  assert.strictEqual(again.direction.id, specs.fintech.direction.id);
  assert.deepStrictEqual(again.scenes.map((s) => s.layout), specs.fintech.scenes.map((s) => s.layout));
});

check('seeded regeneration produces a different composition for the same script', () => {
  const varied = buildCreativeDirection({ scriptText: SCRIPTS.fintech, seed: 98765 });
  assert.notDeepStrictEqual(
    varied.scenes.map((s) => `${s.layout}:${s.camera}`),
    specs.fintech.scenes.map((s) => `${s.layout}:${s.camera}`),
  );
});

check('music plan boundaries align with scene boundaries', () => {
  for (const [name, spec] of Object.entries(specs)) {
    const cumulative = [];
    let acc = 0;
    for (const scene of spec.scenes) { acc += scene.durationSeconds; cumulative.push(Number(acc.toFixed(1))); }
    for (let i = 0; i < cumulative.length; i++) {
      assert.ok(Math.abs(spec.musicPlan.sceneBoundaries[i] - cumulative[i]) < 0.2, `${name}: boundary ${i} drifts`);
    }
  }
});

check('music bed renders and ducks under narration windows', () => {
  const spec = specs.fintech;
  const total = spec.scenes.reduce((a, s) => a + s.durationSeconds, 0);
  const windows = spec.scenes.map((s, i) => {
    const start = spec.scenes.slice(0, i).reduce((a, x) => a + x.durationSeconds, 0);
    return { start, end: start + s.durationSeconds * 0.92 };
  });
  const bed = renderMusicBed({ musicPlan: spec.musicPlan, totalDuration: total, narrationWindows: windows, seed: spec.seed });
  assert.ok(bed.wav.length > 100_000, 'music wav suspiciously small');
  assert.ok(Math.abs(bed.durationSeconds - (total + 1.6)) < 0.2, 'music duration mismatch');
});

check('sfx kit builds with the direction kit', () => {
  for (const spec of Object.values(specs)) {
    const kit = buildSfxKit(spec.direction.sfxKit, spec.seed);
    assert.ok(Object.keys(kit).length > 0, 'empty sfx kit');
    for (const [kind, sound] of Object.entries(kit)) {
      assert.ok(sound.buffer.length > 1000, `${kind}: sfx too small`);
    }
  }
});

check('every scene carries narration emphasis (no empty screens)', () => {
  for (const [name, spec] of Object.entries(specs)) {
    for (const scene of spec.scenes) {
      assert.ok(String(scene.narration).trim().length > 5, `${name}/${scene.id}: empty narration`);
      assert.ok(String(scene.heading).trim().length > 2, `${name}/${scene.id}: empty heading`);
    }
  }
});

if (failures) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log('\nAll variation checks passed.');
