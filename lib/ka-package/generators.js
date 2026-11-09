import { generateJson } from '@/lib/content-factory/generators/_shared';
import { buildKnowledgeContext } from './context';

const BRAND = 'Shiney Brain Academy';
function promptFor(type, context) {
  const common = 'You are an expert Nigerian exam-prep educator and content strategist for ' + BRAND + '.\n\nSOURCE OF TRUTH:\n' + context + '\n\nAccuracy rules:\n- Use only supplied source facts. Never invent statistics, quotations or exam-board claims.\n- Keep explanations suitable for Nigerian secondary-school learners preparing for JAMB/WAEC/NECO.\n- If source material is insufficient, do not fabricate.\n- Return valid JSON only. No markdown fences.';
  const prompts = {
    carousel_slides: common + '\n\nCreate one reusable educational carousel, not platform-specific marketing copy. Return 5-7 slides. Slide 1 is a learning hook; middle slides teach in sequence; final slide gives a recap or practice prompt. Each slide has position, headline (max 8 words), body (max 18 words). Return {"slides":[{"position":1,"headline":"...","body":"..."}]}.',
    master_script: common + '\n\nCreate a clear 60-90 second teaching script. Return {"title":"...","hook":"...","beats":[{"id":"beat-1","narration":"Natural spoken teaching, 1-3 sentences.","on_screen_text":"Short readable text","visual_intent":"What viewer should see","stock_search":"2-4 searchable words"}],"recap":"...","cta":"..."}. Use 5-8 beats. Teach one idea per beat.',
    short_script: common + '\n\nCreate one reusable 30-60 second vertical educational script. Return {"title":"...","hook":"...","segments":[{"id":"segment-1","text":"Exact narration, natural spoken language.","visual_cue":"What appears on screen","stock_search":"2-4 stock search words","on_screen_text":"Short overlay"}]}. Use 4-7 segments. First segment must hook immediately.',
    caption_base: common + '\n\nCreate a platform-neutral educational caption foundation adaptable by social platform. Return {"hook":"...","caption":"...","cta":"...","hashtags":["#..."]}. Be useful, not generic promotion. Do not claim SBA results/statistics absent from source.',
    seo_meta: common + '\n\nCreate reusable search metadata. Return {"title":"...","description":"...","keywords":["..."],"tags":["..."],"faq":[{"question":"...","answer":"..."}]}. Use natural search language; no keyword stuffing.',
    mcq_set: common + '\n\nCreate 10 high-quality multiple-choice exam-prep questions. Return {"questions":[{"question":"...","options":["A. ...","B. ...","C. ...","D. ..."],"correct_answer":"A. ...","explanation":"...","difficulty":1,"topic":"..."}]}. Exactly four options, one unambiguous correct answer, plausible distractors and teaching explanations.',
    visual_instructions: common + '\n\nCreate reusable visual instructions for a lesson/video producer. Return {"visual_style":"...","scenes":[{"id":"scene-1","concept":"...","visual_intent":"...","stock_search":"2-4 words","on_screen_text":"...","avoid":"..."}]}. Use 5-8 scenes. No renderer-specific coordinates.',
  };
  return prompts[type];
}

function validate(type, value) {
  if (!value || typeof value !== 'object') throw new Error('Invalid ' + type + ' response');
  if (type === 'carousel_slides' && (!Array.isArray(value.slides) || value.slides.length < 5)) throw new Error('Carousel must contain at least 5 slides');
  if (type === 'master_script' && (!Array.isArray(value.beats) || value.beats.length < 4)) throw new Error('Master script must contain at least 4 beats');
  if (type === 'short_script' && (!Array.isArray(value.segments) || value.segments.length < 3)) throw new Error('Short script must contain at least 3 segments');
  if (type === 'caption_base' && typeof value.caption !== 'string') throw new Error('Caption is missing caption text');
  if (type === 'seo_meta' && typeof value.title !== 'string') throw new Error('SEO component is missing a title');
  if (type === 'mcq_set' && (!Array.isArray(value.questions) || value.questions.length < 10)) throw new Error('MCQ component must contain at least 10 questions');
  if (type === 'visual_instructions' && (!Array.isArray(value.scenes) || value.scenes.length < 4)) throw new Error('Visual instructions must contain at least 4 scenes');
  return value;
}

export async function generatePackageComponent(asset, componentType) {
  const prompt = promptFor(componentType, buildKnowledgeContext(asset));
  if (!prompt) throw new Error('Unsupported component type: ' + componentType);
  const maxTokens = componentType === 'mcq_set' ? 7000 : componentType === 'master_script' ? 3500 : 3000;
  return validate(componentType, await generateJson(prompt, { expect: 'object', maxTokens }));
}
