import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanImageRegion } from '../lib/image-explainer/regions.mjs';

test('keeps valid pixel coordinates and adds normalized coordinates', () => {
  const region = cleanImageRegion({ x: 100, y: 50, width: 200, height: 100 }, 1000, 500);
  assert.equal(region.x, 100);
  assert.equal(region.y, 50);
  assert.equal(region.width, 200);
  assert.equal(region.height, 100);
  assert.equal(region.normalized.x, 0.1);
  assert.equal(region.normalized.height, 0.2);
});

test('clamps boxes that extend beyond image boundaries', () => {
  const region = cleanImageRegion({ x: 900, y: 450, width: 300, height: 200 }, 1000, 500);
  assert.equal(region.x, 900);
  assert.equal(region.y, 450);
  assert.equal(region.width, 100);
  assert.equal(region.height, 50);
});

test('rejects missing, non-finite and zero-area regions', () => {
  assert.equal(cleanImageRegion(null, 100, 100), null);
  assert.equal(cleanImageRegion({ x: 0, y: 0, width: 'nope', height: 5 }, 100, 100), null);
  assert.equal(cleanImageRegion({ x: 10, y: 10, width: 0, height: 10 }, 100, 100), null);
});

test('rejects negative boxes with no visible area', () => {
  assert.equal(cleanImageRegion({ x: 20, y: 20, width: -10, height: -10 }, 100, 100), null);
});
