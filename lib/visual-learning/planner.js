// Educational-first Visual Learning script planner. Story is the delivery mechanism; accurate, assessable learning is the product.
import { generateWithFallback } from '../llmFallbackChain';
import { parseJsonFromText } from '../robustJsonParse';
import { spawnSync } from 'node:child_process';
import { validateScript } from '../../visual-learning-engine/src/script/schema';
import { architectScript } from '../../visual-learning-engine/src/script/architect';

function buildPlannerPrompt(job, feedback = '') {
  const bodySceneBudget = Math.max(3, Math.min(12, Math.ceil((job.targetSeconds - 24) / 24)));
  const words = Math.round((job.targetSeconds / 60) * 145);
  const aspectNote = job.aspect === '9:16' ? 'Vertical video: headlines under 4 words.' : job.aspect === '1:1' ? 'Square video: headlines under 5 words.' : 'Widescreen: headlines up to 6 words.';
  const keyPoints = Array.isArray(job.keyPoints) ? job.keyPoints.filter(Boolean).slice(0, 8) : [];
  const context = keyPoints.length
    ? `Verified lesson brief / required concepts (cover all in a logical order):\n${keyPoints.map((p, i) => `${i + 1}. ${p}`).join('\n')}`
    : 'No detailed lesson notes were supplied. Use established, widely accepted knowledge about the topic. Do not invent precise figures, studies, quotations, dates or unsupported claims. If the topic is broad, teach a coherent foundational slice and state its scope.';
  return `You are an expert subject teacher, instructional designer and visual storyteller for Shiney Brain Academy.

Create a genuinely educational visual-learning episode as valid JSON. The learner must understand and remember something specific after watching. A compelling story is welcome, but it is only the wrapper: it must never replace explanation.

Return ONLY this JSON:
{"meta":{"title":string,"hookHeadline":string,"subtitle":string,"style":"cartoon","accent":"#E63946"},"scenes":[
{"type":"hook","headline":string,"accentWord":string,"image_prompt":string,"narration":string},
{"type":"title","headline":string,"subtitle":string,"image_prompt":string,"narration":string},
{"type":"statement","headline":string,"accentWord":string,"image_prompt":string,"badges":[{"label":string,"emoji":string}],"narration":string},
{"type":"compare","left":{"label":string,"tone":"bad|good|neutral","image_prompt":string},"right":{"label":string,"tone":"bad|good|neutral","image_prompt":string},"versus":"VS","narration":string},
{"type":"list","title":string,"items":[{"text":string,"emoji":string}],"narration":string},
{"type":"stat","number":string,"headline":string,"source":string,"image_prompt":string,"narration":string},
{"type":"process","title":string,"steps":[{"text":string,"emoji":string}],"narration":string},
{"type":"quote","text":string,"author":string,"narration":string},
{"type":"recap","title":"REMEMBER THIS","items":[string,string],"narration":string},
{"type":"outro","headline":string,"cta":string,"narration":string}]}

TEACHING DESIGN:
1. Define one observable learning outcome: "By the end, the learner can explain/identify/solve…". State it in the subtitle or opening narration.
2. Hook with a puzzle, everyday situation, short story or useful question.
3. Teach the actual subject in a logical progression: define key terms plainly; explain how/why a mechanism works; connect cause and effect; give a concrete worked example or application; address a likely misconception when relevant.
4. Every body scene must teach one identifiable concept, step, distinction, worked example or application. Explain why/how, not merely name a fact. No generic motivation, filler, repeated summaries or vague claims.
5. Include a learner-recall moment: ask a meaningful question, give a beat to think, then explain the answer.
6. Recap only ideas actually taught. End with 2–4 concrete things the learner can now explain or do.

FACTUAL INTEGRITY:
- Use accurate established knowledge and the supplied brief. Never fabricate statistics, studies, sources, quotations, dates, formulas, definitions or causal claims.
- A stat scene is allowed ONLY when its exact figure is supplied in the brief or reliably known AND the "source" field names a traceable source. Otherwise do not use a stat scene.
- Never force compare, quote or stat scenes to satisfy a format quota. Use them only when they genuinely teach this topic.
- Qualify uncertainty or omit it. Distinguish simplified models from full scientific/technical reality.
- Define unavoidable technical terms immediately. Do not pretend generic study advice is a topic-specific explanation.

SCENES:
- Target about ${words} spoken words at 145 wpm; audience: ${job.audience}; tone: ${job.tone}.
- Aim for ${bodySceneBudget} focused body scenes, adjusting to topic complexity. Never pad or split one idea artificially.
- Each narration has 2–5 natural spoken sentences. Body scenes normally explain one idea in 35–90 words; concise demonstrations and recall moments may be shorter.
- Logical transitions; no repeating the previous scene.
- Headlines uppercase and concise. ${aspectNote}
- image_prompt must show the actual concept accurately: parts, relationships, direction, state, scale and context. Avoid generic smiling students, random lightbulbs, decorative metaphors and text in generated images.
- Process steps must describe the real process, not generic "start/practice/repeat" advice.
- Comparisons must contrast meaningful states, structures, methods or outcomes. Lists must contain meaningful facts, categories, components or steps.
- Topic: ${job.topic}
- Episode title: "${job.title}"
- ${context}

Return the complete JSON now.${feedback ? `\n\nPrevious validation errors — fix every one:\n${feedback}` : ''}`;
}

function validateWithProblems(raw, job) {
  try { validateScript(raw, { title: job.title, topic: job.topic, audience: job.audience, aspect: job.aspect, accent: job.accent }); return []; }
  catch (e) { return [String(e.message || e)]; }
}
function zaiChat(prompt) {
  try {
    const res = spawnSync('z-ai', ['chat', '-p', prompt], { encoding: 'utf8', timeout: 300000 });
    if (res.status !== 0 || !res.stdout) return null;
    const out = res.stdout;
    try { const w = JSON.parse(out.slice(out.indexOf('{'), out.lastIndexOf('}') + 1)); return w.choices?.[0]?.message?.content || w.choices?.[0]?.text || null; }
    catch { return null; }
  } catch { return null; }
}
export async function generateVisualLearningScript(job, { maxAttempts = 2 } = {}) {
  const prompt = buildPlannerPrompt(job); let feedback = '';
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const { result, usedProvider } = await generateWithFallback(prompt + (feedback ? `\n\nFix these validation problems:\n${feedback}` : ''),
        (text) => parseJsonFromText(text, 'object'),
        (obj) => { if (!obj) return false; const src = obj.scenes ? obj : obj.script; return src ? validateWithProblems(src, job).length === 0 : false; }, 8192);
      const src = result?.scenes ? result : result?.script;
      if (src) { const script = validateScript(src, { title: job.title, topic: job.topic, audience: job.audience, aspect: job.aspect, accent: job.accent }); console.log(`[visual-learning-planner] script via ${usedProvider} (attempt ${attempt + 1})`); return { script, provider: usedProvider, fallback: false }; }
    } catch (e) { feedback = String(e.message || e).slice(0, 1000); console.warn(`[visual-learning-planner] chain attempt ${attempt + 1} failed: ${feedback}`); }
  }
  const zaiText = zaiChat(prompt + (feedback ? `\n\nFix these validation problems:\n${feedback}` : ''));
  if (zaiText) {
    const parsed = parseJsonFromText(zaiText, 'object'), src = parsed?.scenes ? parsed : parsed?.script;
    if (src) try { const script = validateScript(src, { title: job.title, topic: job.topic, audience: job.audience, aspect: job.aspect, accent: job.accent }); console.log('[visual-learning-planner] script via z-ai CLI'); return { script, provider: 'zai-cli', fallback: false }; }
    catch (e) { console.warn(`[visual-learning-planner] z-ai script invalid: ${String(e.message || e).slice(0, 300)}`); }
  }
  console.warn('[visual-learning-planner] all LLM providers unavailable — using deterministic teaching-outline fallback');
  const script = validateScript(architectScript(job), { title: job.title, topic: job.topic, audience: job.audience, aspect: job.aspect, accent: job.accent });
  return { script, provider: 'architect', fallback: true };
}
export { buildPlannerPrompt, validateScript };
