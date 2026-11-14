// Server-side script planner bridge. Kept separate from timeline geometry so
// the Next.js API bundle does not load the renderer-only point-at-length dependency.
import { buildPlannerPrompt } from '../../whiteboard-engine/src/script/planner-prompt';
import { generateWithFallback } from '../llmFallbackChain';
import { parseJsonFromText } from '../robustJsonParse';

export async function generateScriptWithAI(topic, subject) {
  const prompt = buildPlannerPrompt(topic, subject);
  const { result } = await generateWithFallback(
    `${prompt}\n\nReturn strict JSON: {\"script\": \"<the full DSL script>\"}. Newlines inside the string must be \\n escaped.`,
    (text) => parseJsonFromText(text, 'object'),
    (obj) => obj && typeof obj.script === 'string' && obj.script.includes('scene '),
    8192,
  );
  if (result?.script) return result.script;

  const raw = await generateWithFallback(prompt, { maxTokens: 8192 });
  if (raw && typeof raw === 'string' && raw.includes('scene ')) return raw;
  throw new Error('AI script generation failed — no provider returned a usable script.');
}
