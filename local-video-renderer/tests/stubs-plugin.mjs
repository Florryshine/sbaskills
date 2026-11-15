// Bun preload: replaces @supabase/supabase-js and lib/podcastTTS.js with test doubles.
import { plugin } from 'bun';
import path from 'node:path';
import { normalizeAudio } from '../../lib/whiteboard/audio.js';

const here = path.dirname(new URL(import.meta.url).pathname);

plugin({
  name: 'whiteboard-test-doubles',
  setup(build) {
    build.module('@supabase/supabase-js', () => ({ exports: await_fake(), loader: 'object' }));
    build.onLoad({ filter: /lib\/podcastTTS\.js$/ }, () => ({
      loader: 'object',
      exports: {
        synthesizeLine: async (text) => {
          const mode = process.env.TTS_MODE || 'ok';
          globalThis.__ttsCalls = (globalThis.__ttsCalls || 0) + 1;
          if (mode === 'fail') throw new Error('TTS provider unavailable (simulated 503)');
          if (mode === 'flaky' && globalThis.__ttsCalls <= 2) throw new Error('TTS cold start timeout (simulated)');
          const seconds = 2;
          const pcm = Buffer.alloc(24000 * 2 * seconds);
          if (mode === 'pcm') { const b = Buffer.from(pcm); b.mimeType = 'audio/L16;rate=24000'; return b; }
          const { buffer } = normalizeAudio(pcm, 'audio/L16;rate=24000');
          const out = Buffer.from(buffer); out.mimeType = 'audio/wav'; return out;
        },
      },
    }));
  },
});

import fs from 'node:fs';
plugin({
  name: 'planner-double',
  setup(build) {
    build.onLoad({ filter: /lib\/whiteboard\/planner\.js$/ }, () => ({
      loader: 'object',
      exports: {
        generateScriptWithAI: async () => {
          const mode = process.env.SCRIPT_MODE || 'ok';
          globalThis.__scriptCalls = (globalThis.__scriptCalls || 0) + 1;
          if (mode === 'fail') throw new Error('AI script generation failed — no provider returned a usable script.');
          if (mode === 'garbage_then_ok' && globalThis.__scriptCalls <= 2) return 'this is not a valid script';
          if (mode === 'garbage') return 'this is not a valid script';
          return fs.readFileSync('whiteboard-engine/demos/photosynthesis/script.txt', 'utf8');
        },
      },
    }));
  },
});

function await_fake() { return globalThis.__fakeSupabase; }
