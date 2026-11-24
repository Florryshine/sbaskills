import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanResearchText,
  abstractFromInvertedIndex,
  buildResearchQueries,
} from '../lib/image-explainer/research-utils.mjs';

test('cleans HTML and collapses whitespace in source text', () => {
  assert.equal(cleanResearchText('<b>Heart</b>  anatomy\n basics', 40), 'Heart anatomy basics');
});

test('reconstructs abstract text in original word order', () => {
  const abstract = abstractFromInvertedIndex({
    The: [0], heart: [1], pumps: [2], blood: [3], through: [4], the: [5], body: [6],
  });
  assert.equal(abstract, 'The heart pumps blood through the body');
});

test('builds bounded, deduplicated queries from image subject and components', () => {
  const queries = buildResearchQueries({
    subject: 'Human heart',
    components: [
      { name: 'Left ventricle' },
      { name: 'Right ventricle' },
      { name: 'Left ventricle' },
      { name: 'Aorta' },
      { name: 'Pulmonary artery' },
      { name: 'Extra component' },
    ],
  }, 'Explain the heart');
  assert.deepEqual(queries, [
    'Human heart',
    'Human heart Left ventricle',
    'Human heart Right ventricle',
    'Human heart Aorta',
  ]);
});

test('returns no query when image analysis has no usable subject or components', () => {
  assert.deepEqual(buildResearchQueries({ subject: '', components: [] }, ''), []);
});
