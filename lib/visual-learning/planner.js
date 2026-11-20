// lib/visual-learning/planner.js
//
// Server-side Visual Learning script planner — mirrors lib/stickman/planner.js
// and lib/whiteboard/planner.js. Runs in the persistent worker (never in a
// time-limited serverless function): builds the planner prompt, calls the
// shared LLM fallback chain (Gemini/Groq/OpenRouter free tiers), validates the
// result with the engine's own schema validator, and repairs in a reflect
// loop. When no LLM is available at all it falls back to the engine's
// deterministic script architect so the pipeline never hard-blocks on keys.

import { generateWithFallback } from '../llmFallbackChain';
import { parseJsonFromText } from '../robustJsonParse';
import { spawnSync } from 'node:child_process';
import { validateScript } from '../../visual-learning-engine/src/script/schema';
import { architectScript } from '../../visual-learning-engine/src/script/architect';

/** The scene grammar the model must emit, with a compact example. */
function buildPlannerPrompt(job, feedback = '') {
  const bodySceneBudget = Math.max(3, Math.min(7, Math.round((job.targetSeconds - 26) / 34)));
  const words = Math.round((job.targetSeconds / 60) * 150);
  const aspectNote =
    job.aspect === '9:16'
      ? 'Vertical video: keep headlines under 4 words so they fit the narrow frame.'
      : job.aspect === '1:1'
        ? 'Square video: keep headlines under 5 words.'
        : 'Widescreen video: headlines up to 6 words.';
  return `You are a senior educational video scriptwriter for an explainer channel with a bold visual style (giant uppercase headlines with ONE red accent word, one clear cartoon illustration per scene).

Write a visual-learning episode as JSON. Output ONLY the JSON object, no markdown fences, no commentary.

JSON schema:
{
  "meta": {"title": string, "hookHeadline": string, "subtitle": string, "style": "cartoon", "accent": "#E63946"},
  "scenes": [ ... ]
}

Scene types and their exact fields:
- hook:    { "type": "hook", "headline": "WHY ...?", "accentWord": "...", "image_prompt": "...", "narration": "..." }
- title:   { "type": "title", "headline": "...", "subtitle": "...", "image_prompt": "...", "narration": "..." }
- statement:{ "type": "statement", "headline": "...", "accentWord": "...", "image_prompt": "...", "badges": [{"label": "...", "emoji": "💡"}], "narration": "..." }
- compare: { "type": "compare", "left": {"label": "WITHOUT SLEEP", "tone": "bad", "image_prompt": "..."}, "right": {"label": "WITH SLEEP", "tone": "good", "image_prompt": "..."}, "versus": "VS", "narration": "..." }
- list:    { "type": "list", "title": "...", "items": [{"text": "...", "emoji": "..."}], "narration": "..." }
- stat:    { "type": "stat", "number": "40%", "headline": "...", "image_prompt": "...", "narration": "..." }
- process: { "type": "process", "title": "...", "steps": [{"text": "...", "emoji": "..."}], "narration": "..." }
- quote:   { "type": "quote", "text": "...", "author": "...", "narration": "..." }
- recap:   { "type": "recap", "title": "REMEMBER THIS", "items": ["...", "..."], "narration": "..." }
- outro:   { "type": "outro", "headline": "...", "cta": "...", "narration": "..." }

Hard rules:
1. Every scene has "narration": 2–4 short spoken sentences. Conversational, second person ("you"), concrete and vivid. No lectures, no jargon walls.
2. Headlines are UPPERCASE, max 6 words. ${aspectNote} One accent word per headline where the schema allows.
3. "image_prompt" describes ONE flat 2D cartoon illustration: subject + action + visual metaphor. Never mention text/letters in the image.
4. compare scenes ALWAYS set tone: "bad" for the left/struggling side and "good" for the right/succeeding side (use "bad"/"good" exactly).
5. Structure: hook → title → ${bodySceneBudget} body scenes (mix statement / compare / stat / process / list — at least one compare and one stat) → recap (3 items) → outro.
6. Total narration ≈ ${words} words (~${Math.round(job.targetSeconds / 60)} minutes of speech at 150 wpm).
7. Educational accuracy: real, well-established facts only; no invented statistics. If you cite a number, phrase it as an approximation ("about", "up to").
8. Suitable for ${job.audience}; tone: ${job.tone}.
9. Subject/topic: ${job.topic}${job.keyPoints?.length ? `. Cover these key points in order: ${job.keyPoints.join('; ')}.` : ''}.
10. Episode title: "${job.title}".

Example narration voice: "Here's the strange part. Your brain doesn't switch off at night — it replays what you studied and files it away. Skip the sleep, and you skip the filing."

Return the JSON object now.${feedback ? `\n\nYour previous attempt failed validation with these problems — fix ALL of them:\n${feedback}` : ''}`;
}

/** Validates; returns an error string list (empty = OK). */
function validateWithProblems(raw, job) {
  try {
    validateScript(raw, { title: job.title, topic: job.topic, audience: job.audience, aspect: job.aspect, accent: job.accent });
    return [];
  } catch (e) {
    return [String(e.message || e)];
  }
}

function zaiChat(prompt) {
  // Sandbox/dev provider: the z-ai CLI prints the full chat-completion wrapper.
  try {
    const res = spawnSync('z-ai', ['chat', '-p', prompt], { encoding: 'utf8', timeout: 300000 });
    if (res.status !== 0 || !res.stdout) return null;
    const out = res.stdout;
    try {
      const wrapper = JSON.parse(out.slice(out.indexOf('{'), out.lastIndexOf('}') + 1));
      const content = wrapper.choices?.[0]?.message?.content || wrapper.choices?.[0]?.text;
      return content || null;
    } catch {
      return null;
    }
  } catch {
    return null;
  }
}

/**
 * Generate a validated EpisodeScript for a visual-learning job.
 * Order: shared LLM fallback chain (reflect loop) → z-ai CLI (dev/sandbox) →
 * deterministic architect (never fails). Returns {script, provider, fallback}.
 */
export async function generateVisualLearningScript(job, { maxAttempts = 2 } = {}) {
  const prompt = buildPlannerPrompt(job);
  let feedback = '';

  // 1) Shared chain (Gemini → Groq → OpenRouter → HF free tiers)
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const { result, usedProvider } = await generateWithFallback(
        prompt + (feedback ? `\n\nFix these validation problems and return the corrected JSON:\n${feedback}` : ''),
        (text) => parseJsonFromText(text, 'object'),
        (obj) => {
          if (!obj) return false;
          const src = obj.scenes ? obj : obj.script;
          return src ? validateWithProblems(src, job).length === 0 : false;
        },
        8192,
      );
      const src = result?.scenes ? result : result?.script;
      if (src) {
        const script = validateScript(src, { title: job.title, topic: job.topic, audience: job.audience, aspect: job.aspect, accent: job.accent });
        console.log(`[visual-learning-planner] script via ${usedProvider} (attempt ${attempt + 1})`);
        return { script, provider: usedProvider, fallback: false };
      }
    } catch (e) {
      feedback = String(e.message || e).slice(0, 800);
      console.warn(`[visual-learning-planner] chain attempt ${attempt + 1} failed: ${feedback}`);
    }
  }

  // 2) z-ai CLI (sandbox/dev environments)
  const zaiText = zaiChat(prompt);
  if (zaiText) {
    const parsed = parseJsonFromText(zaiText, 'object');
    const src = parsed?.scenes ? parsed : parsed?.script;
    if (src) {
      try {
        const script = validateScript(src, { title: job.title, topic: job.topic, audience: job.audience, aspect: job.aspect, accent: job.accent });
        console.log('[visual-learning-planner] script via z-ai CLI');
        return { script, provider: 'zai-cli', fallback: false };
      } catch (e) {
        console.warn(`[visual-learning-planner] z-ai script invalid: ${String(e.message || e).slice(0, 200)}`);
      }
    }
  }

  // 3) Deterministic architect (always succeeds)
  console.warn('[visual-learning-planner] all LLM providers unavailable — using deterministic architect');
  const script = validateScript(architectScript(job), { title: job.title, topic: job.topic, audience: job.audience, aspect: job.aspect, accent: job.accent });
  return { script, provider: 'architect', fallback: true };
}

export { buildPlannerPrompt, validateScript };
