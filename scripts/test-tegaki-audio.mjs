import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [route, page, composition] = await Promise.all([
  readFile(new URL('../app/api/admin/tegaki-studio/narrate/route.js', import.meta.url), 'utf8'),
  readFile(new URL('../app/admin/tegaki-studio/page.js', import.meta.url), 'utf8'),
  readFile(new URL('../remotion/StudioComposition.jsx', import.meta.url), 'utf8'),
]);

assert.match(route, /requireAdminApi/);
assert.match(route, /getOrCreateNarration/);
assert.match(route, /synthesizeLine/);
assert.match(route, /for \(const \[index, scene\] of body\.scenes\.entries\(\)\)/, 'TTS must be sequential to reduce rate-limit failures');
assert.match(route, /estimatedSpeechSeconds/);
assert.match(page, /Generate narration audio/);
assert.match(page, /Narration volume/);
assert.match(page, /host_a/);
assert.match(page, /host_b/);
assert.match(page, /audioSrc: audio\.audioSrc/);
assert.match(composition, /scene\.audioSrc\?<Audio src=\{scene\.audioSrc\} volume=\{narrationVolume\}/);
assert.match(composition, /total\*\.92/, 'Handwriting should finish close to the end of the scene');

console.log('Tegaki audio workflow checks passed.');
