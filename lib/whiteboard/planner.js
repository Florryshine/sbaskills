// lib/whiteboard/planner.js
//
// Server-side Whiteboard script planner. The worker runs this multi-provider
// generation and review path outside the time-limited Next.js request.

import { buildPlannerPrompt } from '../../whiteboard-engine/src/script/planner-prompt';
import { findPhraseWordIndex, parseScript } from '../../whiteboard-engine/src/script/parser';
import { generateWithFallback } from '../llmFallbackChain';
import { parseJsonFromText } from '../robustJsonParse';

function inspectScript(script, targetDurationSeconds = 120) {
  if (typeof script !== 'string' || !script.trim()) return { parsed: null, issue: 'script is missing or empty' };
  if (!/^\\s*@title\\b/im.test(script)) return { parsed: null, issue: 'DSL is missing the required @title header' };
  if (!/^\\s*@subject\\b/im.test(script)) return { parsed: null, issue: 'DSL is missing the required @subject header' };
  if (!/^\\s*scene\\s+/im.test(script)) return { parsed: null, issue: 'DSL contains no scene blocks' };

  let parsed;
  try {
    parsed = parseScript(script);
  } catch (error) {
    return { parsed: null, issue: `DSL parser rejected the script: ${error.message}` };
  }

  const target = Math.max(30, Number(targetDurationSeconds) || 120);
  const minScenes = Math.max(4, Math.floor(target / 30));
  const maxScenes = Math.min(24, Math.max(minScenes, Math.ceil(target / 15)));
  if (parsed.scenes.length < minScenes || parsed.scenes.length > maxScenes) {
    return { parsed: null, issue: `duration requires ${minScenes}–${maxScenes} scenes, but script has ${parsed.scenes.length}` };
  }
  if (parsed.scenes[0].layout !== 'title') return { parsed: null, issue: 'first scene must use the title layout' };
  if (parsed.scenes[parsed.scenes.length - 1].layout !== 'summary') {
    return { parsed: null, issue: 'final scene must use the summary layout' };
  }

  for (let index = 0; index < parsed.scenes.length; index++) {
    const scene = parsed.scenes[index];
    if (!scene.narration?.trim()) return { parsed: null, issue: `scene ${index + 1} is missing narration` };
    const narrationWords = scene.narration.trim().split(/\\s+/).filter(Boolean);
    const words = narrationWords.length;
    const visualElements = scene.elements.filter((el) =>
      ['illustration', 'equation', 'arrow', 'text', 'bullet', 'callout', 'tick', 'highlight'].includes(el.type),
    );
    const requiredBeats = words > 45 ? 3 : words > 25 ? 2 : 1;
    if (visualElements.length < requiredBeats) {
      return { parsed: null, issue: `scene ${index + 1} has ${visualElements.length} visual beats; needs at least ${requiredBeats} for ${words} narration words` };
    }
    if (words > 25 && !visualElements.some((el) => ['illustration', 'equation', 'arrow'].includes(el.type))) {
      return { parsed: null, issue: `scene ${index + 1} needs at least one diagram, illustration, equation or arrow` };
    }

    const syncPoints = [...new Set(visualElements
      .map((el) => el.sync?.kind === 'phrase' ? findPhraseWordIndex(narrationWords, el.sync.phrase) : null)
      .filter((position) => position !== null))]
      .sort((a, b) => a - b);
    if (syncPoints.length < requiredBeats) {
      return { parsed: null, issue: `scene ${index + 1} has only ${syncPoints.length} distinct valid spoken sync points; needs ${requiredBeats}` };
    }
    if (words > 25) {
      const firstLimit = Math.ceil(words * 0.15);
      const lastLimit = Math.floor(words * 0.7);
      if (syncPoints[0] > firstLimit || syncPoints[syncPoints.length - 1] < lastLimit) {
        return { parsed: null, issue: `scene ${index + 1} visual beats do not span the narration (first beat must start in first 15%, final beat must reach at least 70%)` };
      }
      const maxGap = Math.ceil(words * (words > 45 ? 0.45 : 0.6));
      for (let i = 1; i < syncPoints.length; i++) {
        if (syncPoints[i] - syncPoints[i - 1] > maxGap) {
          return { parsed: null, issue: `scene ${index + 1} has a visual gap of ${syncPoints[i] - syncPoints[i - 1]} words; maximum is ${maxGap}` };
        }
      }
    }
  }

  const externalImageRequests = parsed.scenes.flatMap((scene) => scene.elements)
    .filter((el) => el.type === 'illustration' && el.image && !/^legacy\\./i.test(el.image)).length;
  const minExternalImages = parsed.subject === 'mathematics' ? 0 : target >= 180 ? 2 : target >= 90 ? 1 : 0;
  if (externalImageRequests < minExternalImages) {
    return { parsed: null, issue: `this ${target}s ${parsed.subject} explainer needs at least ${minExternalImages} distinct external reference image request(s), found ${externalImageRequests}` };
  }

  return { parsed, issue: null };
}

function parseAndValidateScript(script, targetDurationSeconds = 120) {
  return inspectScript(script, targetDurationSeconds).parsed;
}

function scriptOutput(text) {
  const parsed = parseJsonFromText(text, 'object');
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  return parsed;
}

async function generateDsl(prompt, label, targetDurationSeconds = 120) {
  const validate = (obj) => !!parseAndValidateScript(obj.script, targetDurationSeconds);
  validate.describe = (obj) => {
    if (typeof obj?.script !== 'string' || !obj.script.trim()) {
      return 'required field "script" is missing or is not a non-empty string; return {"script":"<complete DSL>"}';
    }
    return inspectScript(obj.script, targetDurationSeconds).issue || 'Whiteboard DSL quality validation failed';
  };
  const { result, usedProvider, errors } = await generateWithFallback(
    prompt + '\\n\\nReturn exactly one strict JSON object with this shape: {"script":"<complete DSL script>"} . The script value must contain the full DSL, with newlines escaped as \\n. Do not return segments, social captions, metadata, or any other schema.',
    scriptOutput,
    validate,
    8192,
  );
  if (!result?.script) {
    const detail = errors?.length ? ' ' + errors.slice(-3).join(' | ') : '';
    throw new Error(label + ' did not return a parseable Whiteboard DSL script with duration-appropriate scene count and visual beats.' + detail);
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
    '- Keep the duration-appropriate scene count specified in the brief, with the first layout title and final layout summary. Split long explanations into shorter scenes rather than compressing them.',
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

  const draft = await generateDsl(prompt, 'first draft', targetDurationSeconds);
  const draftParsed = parseAndValidateScript(draft, targetDurationSeconds);
  if (!draftParsed) throw new Error('The first draft failed Whiteboard DSL quality checks.');

  try {
    const reviewed = await generateDsl(
      buildReviewPrompt(topic, subject, draft, knowledgeContext, targetDurationSeconds),
      'editorial review',
      targetDurationSeconds,
    );
    const reviewedParsed = parseAndValidateScript(reviewed, targetDurationSeconds);
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
