import assert from 'node:assert/strict';
import { createTegakiLessonScene } from '../lib/tegaki-engine/config.js';
import { TEGAKI_ILLUSTRATION_IDS, suggestTegakiIllustration } from '../lib/tegaki-engine/illustrations.js';

assert.equal(TEGAKI_ILLUSTRATION_IDS.length, 70);
assert.equal(new Set(TEGAKI_ILLUSTRATION_IDS).size, 70);
assert.equal(suggestTegakiIllustration('Cell structure and organelles', 'Biology'), 'animal-cell');
assert.equal(suggestTegakiIllustration('Human heart and circulation', 'Biology'), 'human-heart');
assert.equal(suggestTegakiIllustration('Atomic structure', 'Chemistry'), 'atomic-structure');
assert.equal(suggestTegakiIllustration('Projectile motion', 'Physics'), 'projectile-motion');

const scene = createTegakiLessonScene({
  heading: 'Cell membrane', text: 'The membrane controls movement.',
  narration: 'The cell membrane regulates movement into and out of the cell.',
  durationSeconds: 20,
  illustrationCues: [{ at: 0, illustration: 'animal-cell', label: 'Cell membrane' }],
});
assert.equal(scene.durationSeconds, 20);
assert.equal(scene.illustrationCues[0].illustration, 'animal-cell');
assert.throws(() => createTegakiLessonScene({ text: '' }), /needs narration or handwritten lesson text/i);
console.log('Tegaki composition helpers passed.');
