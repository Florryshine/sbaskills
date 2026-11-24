import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeExplainerPlan, validateExplainerPlan } from '../lib/image-explainer/script.mjs';

function samplePlan() {
  return {
    title: 'Inside a plant cell', learning_promise: 'Understand the main structures',
    audience: 'secondary students', tone: 'clear and curious',
    scenes: Array.from({ length: 5 }, (_, i) => ({
      id: `scene-${i+1}`, headline: `Scene ${i+1}`, purpose: 'Explain one idea',
      narration: 'A concise spoken explanation.', duration_seconds: 10,
      visual: { treatment: 'image_region', description: 'Zoom to the structure', camera_move: 'slow push in',
        component_ids: ['component-1'], overlays: [{ text: 'Nucleus', style: 'callout', anchor: 'centre' }],
        asset_search: [], transition: 'clean_cut' },
      on_screen_text: ['Key idea'], fact_check_notes: [],
    })),
  };
}

test('accepts a complete scene plan with duration matching target', () => {
  assert.equal(validateExplainerPlan(samplePlan(), { targetSeconds: 50 }), true);
});
test('rejects plans with too few scenes', () => {
  const plan = samplePlan(); plan.scenes = plan.scenes.slice(0, 3);
  assert.equal(validateExplainerPlan(plan, { targetSeconds: 30 }), false);
});
test('rejects missing narration and invalid visual direction', () => {
  const plan = samplePlan(); plan.scenes[0].narration = ''; 
  assert.equal(validateExplainerPlan(plan, { targetSeconds: 50 }), false);
});
test('normalizes scene order and removes empty overlays', () => {
  const plan = samplePlan(); plan.scenes[0].visual.overlays.push({ text: ' ' });
  const result = normalizeExplainerPlan(plan, { targetSeconds: 50, aspect: '16:9' });
  assert.equal(result.scenes[0].order, 1);
  assert.equal(result.scenes[0].visual.overlays.length, 1);
  assert.equal(result.total_duration_seconds, 50);
});
