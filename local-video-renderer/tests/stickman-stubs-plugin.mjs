// Bun preload: replaces @supabase/supabase-js, lib/podcastTTS.js and
// lib/stickman/planner.js with test doubles for stickman-worker.js.
// validateSceneScript stays REAL so the AI scenarios exercise the actual validator.
import { plugin } from 'bun';
import path from 'node:path';
import fs from 'node:fs';

const here = path.dirname(new URL(import.meta.url).pathname);

function makeWav(seconds) {
  const pcm = Buffer.alloc(24000 * 2 * seconds);
  const rate = 24000;
  const channels = 1;
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

plugin({
  name: 'stickman-test-doubles',
  setup(build) {
    build.module('@supabase/supabase-js', () => ({ exports: globalThis.__fakeSupabase, loader: 'object' }));
    build.onLoad({ filter: /lib\/podcastTTS\.js$/ }, () => ({
      loader: 'object',
      exports: {
        synthesizeLine: async (text) => {
          const mode = process.env.TTS_MODE || 'ok';
          globalThis.__ttsCalls = (globalThis.__ttsCalls || 0) + 1;
          if (mode === 'fail') throw new Error('TTS provider unavailable (simulated 503)');
          if (mode === 'flaky' && globalThis.__ttsCalls <= 2) throw new Error('TTS cold start timeout (simulated)');
          // 2s of RIFF/WAV like Gemini TTS; word-count varies the duration so
          // the compiler's dialogue spacing is exercised for real.
          return makeWav(2);
        },
      },
    }));
    build.onLoad({ filter: /lib\/stickman\/planner\.js$/ }, () => ({
      loader: 'object',
      exports: {
        validateSceneScript: (script) => realValidator.validateSceneScript(script),
        generateScriptWithAI: async () => {
          const mode = process.env.SCRIPT_MODE || 'ok';
          globalThis.__scriptCalls = (globalThis.__scriptCalls || 0) + 1;
          if (mode === 'fail') throw new Error('AI script generation failed — no provider returned a usable SceneScript.');
          const valid = JSON.parse(fs.readFileSync(path.join(here, '../../stickman-engine/scenes/friction-story.json'), 'utf8'));
          if (mode === 'garbage') return { title: 'Broken script' };
          if (mode === 'garbage_then_ok' && globalThis.__scriptCalls <= 2) return { title: 'Broken script' };
          return valid;
        },
      },
    }));
  },
});

import * as realValidator from '../../stickman-engine/src/scene/validate';
