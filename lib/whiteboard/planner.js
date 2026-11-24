// lib/whiteboard/planner.js
//
// Server-side Whiteboard script planner. The worker runs this multi-provider
// generation and review path outside the time-limited Next.js request.

import { buildPlannerPrompt } from '../../whiteboard-engine/src/script/planner-prompt';
import { parseScript } from '../../whiteboard-engine/src/script/parser';
import { generateWithFallback } from '../llmFallbackChain';
import { parseJsonFromText } from '../robustJsonParse';

function parseAndValidateScript(script) {
  if (typeof script !== 'string' || !script.includes('scene ')) return null;
  try {
    const parsed = parseScript(script);
    if (parsed.scenes.length < 4 || parsed.scenes.length > 9) return null;
    if (parsed.scenes[0].layout !== 'title') return null;
    if (parsed.scenes[parsed.scenes.length - 1].layout !== 'summary') return null;
    return parsed;
  } catch {
    return null;
  }
}

function scriptOutput(text) {
  const parsed = parseJsonFromText(text, 'object');
  if (!parsed || typeof parsed.script !== 'string') return null;
  return parsed;
}

async function generateDsl(prompt, label) {
  const { result, usedProvider, errors } = await generateWithFallback(
    prompt + '\n\nReturn strict JSON only: {"script":"<complete DSL script>"} . Escape newlines inside the JSON string.',
    scriptOutput,
    (obj) => !!parseAndValidateScript(obj.script),
    8192,
  );
  if (!result?.script) {
    const detail = errors?.length ? ' ' + errors.slice(-3).join(' | ') : '';
    throw new Error(label + ' did not return a parseable 4–9 scene Whiteboard DSL script.' + detail);
  }
  console.log('[whiteboard-planner] ' + label + ' generated via ' + (usedProvider || 'provider fallback'));
  return result.script;
}

function buildReviewPrompt(topic, subject, draft, knowledgeContext, targetDurationSeconds = 120) {
  return [
    'You are an independent senior editor reviewing a whiteboard explainer script before animation.',
    'Your task is to improve the explanation, not to change the video format or invent new content.',
    'TOPIC: ' + topic,
    'TARGET VIDEO DURATION: approximately ' + targetDurationSeconds + ' seconds. Preserve enough narration and scenes to meet this target.',
    'SUBJECT: ' + subject,
    knowledgeContext ? 'FACTUAL SOURCE CONTEXT:\n' + knowledgeContext.slice(0, 10000) : 'No external source context was supplied. Do not introduce new facts or current statistics.',
    '',
    'REVIEW THE SCRIPT FOR:',
    '1. Opening: Does it create a clear reason to keep watching without a generic greeting?',
    '2. Explanation: Is there one central question or idea, developed in a logical sequence?',
    '3. Clarity: Are technical terms explained before they are relied upon? Are examples concrete and useful?',
    '4. Substance: Does each scene add understanding, or are there repeated facts, filler or abrupt jumps?',
    '5. Accuracy: Are claims, numbers, formulas, causal links and definitions sound? Do not add unsupported facts.',
    '6. Visual logic: Does each drawing, label, equation, arrow or image genuinely support the narration? Remove forced or decorative visuals. Add a visual only when it improves understanding.',
    '7. Whiteboard suitability: The output must remain a progressive visual explanation using the existing DSL, not a drama, slideshow or character skit.',
    '8. Ending: Does the final scene answer the opening question and deliver a useful takeaway?',
    '',
    'REVISION RULES:',
    '- Preserve the topic, subject, useful facts and all valid DSL directives.',
    '- Improve weak wording, transitions, order, examples and visual choices where needed.',
    '- Do not add statistics, sources, quotations, dates or technical claims that are not supported.',
    '- Do not force images, characters, highlights, arrows or a fixed number of drawings into scenes.',
    '- Keep 4–9 scenes, with the first layout title and final layout summary.',
    '- Every scene must retain one narration: line. All sync phrases must still occur verbatim in their scene narration.',
    '- Use only supported DSL directives. Preserve the illustration ids already present in the draft; do not introduce new draw ids.',
    '- Keep narration natural and suitable for clear Nigerian English; never pidgin.',
    '- Do not shorten the script just to make it concise. Preserve useful explanatory depth.',
    '- Return the COMPLETE revised script in JSON only: {"script":"<complete DSL script>"}.',
    '',
    'SCRIPT TO REVIEW:',
    draft,
  ].join('\n');
}

/**
 * Generate a complete explainer, parse it against the real DSL, then run one
 * independent editorial pass. If review is unavailable or returns invalid
 * DSL, keep the valid first draft rather than failing a usable job.
 */
export async function generateScriptWithAI(topic, subject, feedback = '', knowledgeContext = '', targetDurationSeconds = 120) {
  const prompt = buildPlannerPrompt(topic, subject, knowledgeContext, targetDurationSeconds) +
    (feedback ? '\n\nGENERATION FEEDBACK:\n' + feedback : '');

  const draft = await generateDsl(prompt, 'first draft');
  const draftParsed = parseAndValidateScript(draft);
  if (!draftParsed) throw new Error('The first draft failed Whiteboard DSL quality checks.');

  try {
    const reviewed = await generateDsl(
      buildReviewPrompt(topic, subject, draft, knowledgeContext, targetDurationSeconds),
      'editorial review',
    );
    const reviewedParsed = parseAndValidateScript(reviewed);
    if (reviewedParsed) {
      console.log('[whiteboard-planner] editorial review accepted (' + reviewedParsed.scenes.length + ' scenes)');
      return reviewed;
    }
    console.warn('[whiteboard-planner] editorial review returned invalid structure; retaining validated first draft');
  } catch (error) {
    console.warn('[whiteboard-planner] editorial review unavailable; retaining validated first draft:', error.message);
  }

  return draft;
}
