import test from 'node:test';
import assert from 'node:assert/strict';
import { buildNarrationManifest, validateNarrationManifest } from '../lib/image-explainer/narration-manifest.mjs';

const scenes = [{ id: 'scene-1' }, { id: 'scene-2' }];
const clips = [
  { path: 'job/scene-1.mp3', ext: 'mp3', duration: 4.2, provider: 'gemini', voice: 'Kore', words: [{ word: 'Hello', start: 0.1, end: 0.5 }, { word: 'world.', start: 0.6, end: 4.5 }] },
  { path: 'job/scene-2.wav', ext: 'wav', duration: 3, provider: 'edge', voice: 'en-NG-EzinneNeural', words: [{ word: 'Again.', start: 0, end: 2.9 }] },
];

test('builds a per-scene manifest with measured durations and bounded word timings', () => {
  const manifest = buildNarrationManifest({ scenes, clips, voicePreset: 'friendly_female' });
  assert.equal(manifest.clip_count, 2);
  assert.equal(manifest.total_duration_seconds, 7.2);
  assert.equal(manifest.clips[0].words[1].end, 4.2);
  assert.equal(validateNarrationManifest(manifest, 2), true);
});
test('rejects missing scene clips', () => {
  assert.throws(() => buildNarrationManifest({ scenes, clips: clips.slice(0, 1), voicePreset: 'warm_male' }), /exactly one/);
});
test('rejects clips without measurable audio or timing', () => {
  assert.throws(() => buildNarrationManifest({ scenes: scenes.slice(0, 1), clips: [{ path: 'x.mp3', duration: 0, words: [] }], voicePreset: 'warm_male' }), /valid storage path/);
});
test('validator rejects word timings outside the audio duration', () => {
  const manifest = buildNarrationManifest({ scenes, clips, voicePreset: 'friendly_female' });
  manifest.clips[0].words[0].end = 20;
  assert.equal(validateNarrationManifest(manifest, 2), false);
});
