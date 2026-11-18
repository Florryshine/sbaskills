// lib/stickman/planner.js
//
// Server-side Stickman script planner bridge — mirrors lib/whiteboard/planner.js.
// Kept out of the Next.js API route so the slow multi-provider LLM call runs in
// the persistent worker, never inside a time-limited serverless function.
//
// Returns a validated SceneScript object (see stickman-engine/src/rig/character.ts).
// Validation failures are thrown with the validator's problem list so the worker's
// reflect loop can feed them back into the next prompt.

import { buildPlannerPrompt } from '../../stickman-engine/src/scene/planner-prompt';
import { validateSceneScript } from '../../stickman-engine/src/scene/validate';
import { generateWithFallback } from '../llmFallbackChain';
import { parseJsonFromText } from '../robustJsonParse';

export async function generateScriptWithAI(topic, subject, kaSource = '', feedback = '') {
  const prompt = `${buildPlannerPrompt(topic, subject, kaSource)}${feedback ? `\n\n${feedback}` : ''}`;
  const { result, usedProvider } = await generateWithFallback(
    prompt,
    (text) => {
      const parsed = parseJsonFromText(text, 'object');
      return parsed && typeof parsed.script === 'object' && parsed.script !== null ? parsed : null;
    },
    (obj) => validateSceneScript(obj.script).length === 0,
    8192,
  );
  if (result?.script) {
    console.log(`[stickman-planner] script generated via ${usedProvider}`);
    return result.script;
  }
  throw new Error('AI script generation failed — no provider returned a usable SceneScript.');
}

export { validateSceneScript };
