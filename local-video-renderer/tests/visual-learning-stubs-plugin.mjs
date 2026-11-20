// Bun preload: replaces @supabase/supabase-js, lib/visual-learning/planner.js
// and the engine narration/imagery providers with test doubles for
// visual-learning-worker.js. Schema validation stays REAL so the AI scenarios
// exercise the actual validator (same philosophy as stickman-stubs-plugin).
import { plugin } from 'bun';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

const here = path.dirname(new URL(import.meta.url).pathname);

// A minimal real JPEG (1x1) so file-size checks pass.
const TINY_JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a' +
    'HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AmAA//9k=',
  'base64',
);

function makeWav(seconds) {
  const rate = 24000;
  const channels = 1;
  const pcm = Buffer.alloc(rate * 2 * channels * seconds);
  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'latin1');
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8, 'latin1');
  header.write('fmt ', 12, 'latin1');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * channels * 2, 28);
  header.writeUInt16LE(channels * 2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36, 'latin1');
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

function probeDurationSeconds(file) {
  try {
    const res = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8', timeout: 15000 });
    const v = parseFloat(res.stdout?.trim() || '');
    return isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}

// Proportional word timings (mirrors the engine's align.ts closely enough for tests).
function proportionalWords(text, duration) {
  const raw = text.trim().split(/\s+/).filter(Boolean);
  if (!raw.length) return [];
  const step = duration / raw.length;
  return raw.map((word, i) => ({ word, start: Math.round(i * step * 1000) / 1000, end: Math.round((i + 1) * step * 0.94 * 1000) / 1000 }));
}

// A small valid episode: exercises hook/title/statement/compare/list/stat/recap/outro.
function sampleEpisode() {
  return {
    meta: { title: 'Why Sleep Is a Study Superpower', hookHeadline: 'WHY SLEEP MATTERS?', subtitle: 'A visual guide', style: 'cartoon', accent: '#E63946' },
    scenes: [
      { type: 'hook', headline: 'WHY SLEEP MATTERS?', accentWord: 'SLEEP', image_prompt: 'a sleeping student with a glowing brain', narration: 'Have you ever wondered why a good night of sleep makes everything easier to remember?' },
      { type: 'title', headline: 'SLEEP AND MEMORY', subtitle: 'How your brain turns rest into results', image_prompt: 'a brain sleeping with tiny stars', narration: 'This is the story of what your brain does after lights out.' },
      { type: 'statement', headline: 'YOUR BRAIN FILES MEMORIES', accentWord: 'FILES', image_prompt: 'a brain as a librarian storing books', badges: [{ label: 'Key idea', emoji: '💡' }], narration: 'While you sleep, your brain replays today and stores the best parts for tomorrow.' },
      { type: 'compare', left: { label: 'NO SLEEP', tone: 'bad', image_prompt: 'a tired messy student' }, right: { label: 'GOOD SLEEP', tone: 'good', image_prompt: 'a fresh organized student' }, versus: 'VS', narration: 'Without sleep, notes feel foggy. With sleep, the same notes suddenly make sense.' },
      { type: 'list', title: 'SLEEP SMARTER', items: [{ text: 'Same bedtime daily', emoji: '⏰' }, { text: 'Screens off early', emoji: '📵' }], narration: 'Two habits make a real difference: a steady bedtime and screens off before bed.' },
      { type: 'stat', number: '40%', headline: 'REMEMBER MORE', image_prompt: 'a rising bar chart with a moon', narration: 'Students who sleep well remember up to forty percent more of what they studied.' },
      { type: 'recap', title: 'REMEMBER THIS', items: ['Sleep stores memories', 'Keep one bedtime', 'Screens off, lights out'], narration: 'So sleep is study time. Keep one bedtime, and let your brain file things away.' },
      { type: 'outro', headline: 'SLEEP AND MEMORY', cta: 'Follow for more', narration: 'Now you know the secret: rest is part of studying. See you in the next one.' },
    ],
  };
}

plugin({
  name: 'visual-learning-test-doubles',
  setup(build) {
    build.module('@supabase/supabase-js', () => ({ exports: globalThis.__fakeSupabase, loader: 'object' }));
    build.module('dotenv/config', () => ({ exports: {}, loader: 'object' }));

    // Planner double (real validator stays in use via the engine schema module).
    build.onLoad({ filter: /lib\/visual-learning\/planner\.js$/ }, () => ({
      loader: 'object',
      exports: {
        validateScript: realValidator.validateScript,
        buildPlannerPrompt: () => 'stub prompt',
        generateVisualLearningScript: async (job) => {
          const mode = process.env.SCRIPT_MODE || 'ok';
          globalThis.__scriptCalls = (globalThis.__scriptCalls || 0) + 1;
          if (mode === 'fail') throw new Error('AI script generation failed — no provider returned a usable episode script.');
          const valid = sampleEpisode();
          if (mode === 'garbage') return { script: { meta: { title: 'Broken' }, scenes: [{ type: 'nonsense', narration: 'x' }] }, provider: 'stub', fallback: false };
          if (mode === 'garbage_then_ok' && globalThis.__scriptCalls <= 2) return { script: { meta: { title: 'Broken' }, scenes: [{ type: 'nonsense', narration: 'x' }] }, provider: 'stub', fallback: false };
          return { script: valid, provider: 'stub', fallback: false };
        },
      },
    }));

    // Narration providers double: instant tiny WAVs with proportional timings.
    build.onLoad({ filter: /visual-learning-engine\/src\/narration\/providers\.ts$/ }, () => ({
      loader: 'object',
      exports: {
        VOICE_PRESETS: { warm_male: { label: 'stub', edge: 'x', proxy: 'onyx' } },
        probeDurationSeconds,
        synthesizeNarration: async (req) => stubNarration(req),
        synthesizeSceneNarration: async (req) => stubNarration(req),
      },
    }));

    // Imagery providers double: instant tiny JPEGs, N shots per scene
    // (mirrors the real multi-shot API; no network, no sharp).
    build.onLoad({ filter: /visual-learning-engine\/src\/imagery\/providers\.ts$/ }, () => ({
      loader: 'object',
      exports: {
        resolveSceneImages: async (req) => {
          const count = req.slot ? 1 : Math.max(1, Math.min(8, req.count ?? 1));
          const { mkdirSync, writeFileSync } = fs;
          mkdirSync(path.join(req.publicDir, 'images'), { recursive: true });
          const assets = [];
          for (let shot = 0; shot < count; shot++) {
            const base = `scene-${String(req.sceneIndex).padStart(3, '0')}`;
            const name = req.slot ? `${base}-${req.slot}.jpg` : `${base}-s${shot}.jpg`;
            writeFileSync(path.join(req.publicDir, 'images', name), TINY_JPEG);
            assets.push({
              sceneIndex: req.sceneIndex,
              provider: 'pollinations',
              file: `images/${name}`,
              prompt: req.subject,
              seed: req.seed,
              width: 1,
              height: 1,
              shot,
            });
          }
          globalThis.__imageCalls = (globalThis.__imageCalls || 0) + 1;
          globalThis.__lastShotCount = count;
          return assets;
        },
      },
    }));
  },
});

function stubNarration(req) {
  globalThis.__ttsCalls = (globalThis.__ttsCalls || 0) + 1;
  const mode = process.env.TTS_MODE || 'ok';
  if (mode === 'fail') return null;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vl-stub-'));
  const file = path.join(dir, 'clip.wav');
  fs.writeFileSync(file, makeWav(2));
  return { file, ext: 'wav', duration: 2, words: proportionalWords(req.text, 2), provider: 'edge', voice: 'stub' };
}

import * as realValidator from '../../visual-learning-engine/src/script/schema';
