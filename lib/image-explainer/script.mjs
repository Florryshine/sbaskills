import { parseJsonFromText } from '../robustJsonParse.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || min));
const text = (value, max = 1200) => typeof value === 'string' ? value.trim().slice(0, max) : '';

export function validateExplainerPlan(plan, { targetSeconds = 90 } = {}) {
  if (!plan || typeof plan !== 'object' || !Array.isArray(plan.scenes)) return false;
  if (plan.scenes.length < 5 || plan.scenes.length > 16) return false;
  if (!text(plan.title, 160) || !text(plan.learning_promise, 400)) return false;
  return plan.scenes.every((scene) =>
    scene && text(scene.id, 80) && text(scene.headline, 120) &&
    text(scene.narration, 1400) && text(scene.purpose, 300) &&
    scene.visual && text(scene.visual.treatment, 80) &&
    text(scene.visual.description, 700) &&
    Number.isFinite(Number(scene.duration_seconds)) &&
    Number(scene.duration_seconds) >= 2 && Number(scene.duration_seconds) <= 45
  ) && Math.abs(plan.scenes.reduce((sum, scene) => sum + Number(scene.duration_seconds), 0) - targetSeconds) <= Math.max(10, targetSeconds * 0.2);
}

export function normalizeExplainerPlan(plan, { targetSeconds = 90, aspect = '16:9' } = {}) {
  if (!validateExplainerPlan(plan, { targetSeconds })) {
    throw new Error('The generated plan is incomplete or invalid. Regenerate the script before continuing.');
  }
  const scenes = plan.scenes.map((scene, index) => ({
    id: text(scene.id, 80) || `scene-${index + 1}`,
    order: index + 1,
    headline: text(scene.headline, 120),
    narration: text(scene.narration, 1400),
    purpose: text(scene.purpose, 300),
    duration_seconds: clamp(scene.duration_seconds, 2, 45),
    visual: {
      treatment: text(scene.visual.treatment, 80),
      description: text(scene.visual.description, 700),
      camera_move: text(scene.visual.camera_move, 160),
      component_ids: Array.isArray(scene.visual.component_ids) ? scene.visual.component_ids.map((id) => text(id, 80)).filter(Boolean).slice(0, 12) : [],
      overlays: Array.isArray(scene.visual.overlays) ? scene.visual.overlays.map((item) => ({
        text: text(item?.text, 100), style: text(item?.style, 60),
        anchor: text(item?.anchor, 80),
      })).filter((item) => item.text).slice(0, 6) : [],
      asset_search: Array.isArray(scene.visual.asset_search) ? scene.visual.asset_search.map((v) => text(v, 120)).filter(Boolean).slice(0, 5) : [],
      transition: text(scene.visual.transition, 80) || 'clean_cut',
    },
    on_screen_text: Array.isArray(scene.on_screen_text) ? scene.on_screen_text.map((v) => text(v, 100)).filter(Boolean).slice(0, 5) : [],
    fact_check_notes: Array.isArray(scene.fact_check_notes) ? scene.fact_check_notes.map((v) => text(v, 240)).filter(Boolean).slice(0, 6) : [],
  }));
  return {
    title: text(plan.title, 160),
    learning_promise: text(plan.learning_promise, 400),
    audience: text(plan.audience, 120),
    tone: text(plan.tone, 120),
    key_takeaways: Array.isArray(plan.key_takeaways) ? plan.key_takeaways.map((v) => text(v, 240)).filter(Boolean).slice(0, 8) : [],
    accuracy_notes: Array.isArray(plan.accuracy_notes) ? plan.accuracy_notes.map((v) => text(v, 300)).filter(Boolean).slice(0, 12) : [],
    scenes,
    total_duration_seconds: scenes.reduce((sum, scene) => sum + scene.duration_seconds, 0),
    aspect,
    generated_at: new Date().toISOString(),
    review_status: 'needs_admin_review',
  };
}

export async function generateExplainerPlan({ job, analysis, research, instruction = '' }) {
  const spec = job?.spec || {};
  const targetSeconds = clamp(spec.targetSeconds, 20, 900);
  const components = (analysis?.components || []).slice(0, 60).map((item) => ({
    id: item.id, name: item.name, label: item.label_text,
    visible_description: item.description, proposed_function: item.function,
    confidence: item.confidence, needs_verification: item.needs_verification,
  }));
  const sources = (research?.sources || []).slice(0, 16).map((item) => ({
    title: item.title, source: item.source, year: item.year || null,
    summary: item.extract || item.abstract || '', url: item.url,
  }));
  const prompt = `You are a senior documentary explainer writer, instructional designer and visual director. Create a production-ready SCRIPT + STORYBOARD for this image-to-explainer project.

PROJECT
Title: ${job.title}
Mode: ${job.production_mode}
Target runtime: ${targetSeconds} seconds (within ±15% ideally)
Aspect ratio: ${spec.aspect || '16:9'}
Language: ${spec.language || 'English'}
Creator instruction: ${instruction || 'Explain the image clearly and accurately.'}

IMAGE ANALYSIS (pixels-grounded; do not contradict it)
Subject: ${analysis.subject}
Summary: ${analysis.summary}
Image type: ${analysis.image_type}
Components: ${JSON.stringify(components)}
Visible text: ${JSON.stringify((analysis.detected_text || []).slice(0, 60))}
Spatial relationships: ${JSON.stringify(analysis.spatial_relationships || [])}
Uncertainties: ${JSON.stringify(analysis.uncertainties || [])}

RESEARCH LEADS (not automatically verified facts; cite source titles in fact_check_notes when relevant)
${JSON.stringify(sources)}
Research caveat: Only make factual claims supported by the image or a credible supplied source. If uncertain, qualify it or flag it for review. Never fabricate citations, measurements, labels, functions or statistics.

DIRECTING RULES
- Build a coherent story with a hook, orientation, progressive explanation, synthesis and memorable close. No generic intro.
- Produce 5–12 scenes; use more only if needed, maximum 16. Every scene must advance the explanation.
- Spoken narration must sound natural when read aloud, not like slide text. Avoid repetitive scene openings and filler.
- Plan visual action, not a slideshow: deliberate camera moves, image-region tracking, selective zoom/pan, callouts, arrows, animated labels, cutaways, supporting footage, diagrams or motion graphics where they genuinely clarify.
- Start from the uploaded image and reference component IDs when appropriate. Use only IDs from the supplied list.
- Specify treatment and camera movement per scene. For overlays give concise text and anchor. Add asset_search terms only where external footage genuinely improves understanding.
- Respect visual hierarchy and safe margins. Do not crowd the frame. A visual treatment may be 'image_region', 'macro_detail', 'kinetic_type', 'motion_graphic', 'supporting_footage', 'diagram_build', 'split_screen', 'full_image' or another concise production treatment.
- Scene durations must be 2–45 seconds and sum to approximately ${targetSeconds} seconds. Avoid narration that cannot fit its duration at natural speaking pace.
- Distinguish narration from on-screen text. Avoid duplicating every spoken word as text.
- Include fact_check_notes for any claim that needs human verification.
- Return strict JSON only with this schema:
{
"title":"...", "learning_promise":"...", "audience":"...", "tone":"...",
"key_takeaways":["..."], "accuracy_notes":["..."],
"scenes":[{
"id":"scene-1","headline":"short scene heading","purpose":"why this scene exists",
"narration":"complete spoken words for this scene",
"duration_seconds":10,
"visual":{"treatment":"image_region","description":"specific shot composition and action","camera_move":"precise move","component_ids":["component-id"],
"overlays":[{"text":"short label","style":"callout","anchor":"near component"}],
"asset_search":["optional specific search term"],"transition":"clean_cut"},
"on_screen_text":["short phrase"],"fact_check_notes":["source or verification note"]
}]
}`;
  const { generateWithFallback } = await import('../llmFallbackChain.js');
  const generated = await generateWithFallback(prompt, (raw) => parseJsonFromText(raw, 'object'), (parsed) => validateExplainerPlan(parsed, { targetSeconds }), 7000);
  if (!generated?.result) {
    throw new Error(`All configured script providers failed to produce a valid plan.${generated?.errors?.length ? ' ' + generated.errors.slice(-3).join('; ') : ''}`);
  }
  return { plan: normalizeExplainerPlan(generated.result, { targetSeconds, aspect: spec.aspect || '16:9' }), provider: generated.usedProvider };
}
