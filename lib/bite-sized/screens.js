import { generateJson } from '@/lib/content-factory/generators/_shared';
import { normalizeBlueprint } from '@/lib/bite-sized/blueprint';
import { normalizeLessonContent, validateLessonContent } from '@/lib/bite-sized/validator';

const SCREEN_TYPES = [
  'intro',
  'text',
  'image_text',
  'example',
  'demonstration',
  'guided_practice',
  'practice',
  'tip',
  'quick_check',
  'true_false',
  'scenario',
  'error_analysis',
  'recap',
  'completion',
];

function asText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function unique(values) {
  return [...new Set(values)];
}

function buildBlueprintContext(blueprint) {
  const normalized = normalizeBlueprint(blueprint);
  return JSON.stringify(normalized, null, 2);
}

function inferSubjectProfile(blueprint, lessonTitle, lessonDescription, subjectHint = '') {
  const source = [
    subjectHint,
    lessonTitle,
    lessonDescription,
    ...(blueprint?.concepts || []),
    ...(blueprint?.terminology || []),
    ...(blueprint?.procedures || []),
  ].join(' ').toLowerCase();
  const visualSubject = /\b(biology|biological|anatomy|physiology|botany|zoology|ecology|microbiology|genetics|chemistry|chemical|physics|geography|geology|astronomy|environmental science)\b/.test(source);
  return {
    subject: visualSubject ? 'visual_science' : 'general',
    imageCadence: visualSubject
      ? 'Aim for at least one genuinely instructional image on every 1–2 explanatory screens where the concept supports it.'
      : 'Aim for at least one genuinely instructional image for every four screens.',
  };
}

export function buildScreenGenerationPrompt({ blueprint, lessonTitle = '', lessonDescription = '', subjectHint = '' } = {}) {
  const title = asText(lessonTitle) || 'Untitled lesson';
  const description = asText(lessonDescription) || 'No additional description supplied.';
  const blueprintContext = buildBlueprintContext(blueprint);
  const subjectProfile = inferSubjectProfile(blueprint, title, description, subjectHint);

  return `You are Stage 2 of Shiney Brain Academy's bite-sized lesson system.

Convert the approved Learning Blueprint below into an ordered sequence of interactive instructional screens. This is a real teaching lesson, not a short summary split into cards.

MOST IMPORTANT RULE
Do not use a fixed screen count or compress difficult material. Each interaction should focus on one idea, example, step, or question. Keep most screen body copy concise—roughly 35–75 words as a writing guide, not a hard limit. Split dense explanations across screens, use examples and questions to teach, and retain extra detail only when necessary for accuracy or understanding.

VISUAL LEARNING STANDARD
Subject profile: ${subjectProfile.subject}
Image cadence: ${subjectProfile.imageCadence}
- Plan visual teaching as part of the lesson, not as decoration added at the end.
- Meet the image cadence with imageQuery on suitable instructional screens. Do not count intro, recap, completion, or question-only screens toward the cadence.
- Prefer labelled educational diagrams, annotated processes, specimens, maps, worked visuals, charts, or authentic photographs when they directly explain the concept.
- For Biology, anatomy, ecology, Chemistry, Physics, Geography and other visual sciences, use images more frequently—often every 1–2 explanatory screens when useful.
- For abstract/general topics, use at least one relevant image per four screens where a visual genuinely improves understanding.
- Every imageQuery must be specific and teach something visible; include the subject, key labels or features, and educational diagram/photo style where appropriate.
- imageAlt must describe the learning information conveyed, not say 'image of'.
- Never invent labels, structures, experimental results, or scientific details. Do not request a diagram if the source does not support its content.
- Avoid repeating the same visual idea or using generic stock photos as filler.
- If no accurate useful visual exists for a particular screen, leave imageQuery null rather than forcing a misleading image.

LESSON
Title: ${title}
Description: ${description}

APPROVED LEARNING BLUEPRINT
${blueprintContext}

TEACHING REQUIREMENTS
- Follow the blueprint's selected teaching strategy and adapt a suitable pattern family.
- Every screen must trace to a blueprint objective or concept unless it is a necessary intro, tip, or completion screen.
- Teach each objective before asking the learner to apply it.
- Use recall or recognition before application or challenge when the material supports progression.
- Do not generate repetitive questions that merely reword the same recall prompt.
- For exam-oriented material, explain why important distractors are wrong.
- For procedural material, demonstrate and scaffold before independent practice.
- For coding or problem-solving material, include reasoning, prediction, debugging, or worked steps where appropriate.
- Choose imageQuery deliberately to meet the visual learning standard above; use null only when an image would be misleading, unsupported, or genuinely unhelpful.
- A recap must summarize concepts actually taught. A completion screen confirms traversal, not mastery.

SUPPORTED SCREEN TYPES FOR THIS VERSION
${SCREEN_TYPES.join(', ')}

QUESTION SHAPE
For question/practice screens, use a structured question object. Multiple-choice questions may use options plus correctIndex. True/false may use correctAnswer. Guided practice may use guidance and an optional answer representation. Every question should include an explanation or feedback rationale.

Return ONLY JSON with this shape:
{
  "schemaVersion": 1,
  "lesson": {
    "title": "...",
    "description": "...",
    "objectives": ["..."]
  },
  "learningBlueprint": ${blueprintContext},
  "screens": [
    {
      "type": "intro|text|image_text|example|demonstration|guided_practice|practice|tip|quick_check|true_false|scenario|error_analysis|recap|completion",
      "title": "...",
      "body": "...",
      "imageQuery": null,
      "imageAlt": null,
      "concept": "...",
      "objectiveIndex": 0,
      "difficulty": "recall|recognition|application|challenge",
      "interactionType": "recall|recognition|distinction|application|error_analysis|prediction|calculation|ordering|scenario",
      "required": true,
      "question": {
        "prompt": "...",
        "options": ["..."],
        "correctIndex": 0,
        "explanation": "..."
      }
    }
  ]
}

Omit fields that do not apply. Do not return markdown, code fences, commentary, or a word-count report.`;
}

function normalizeScreen(screen, index) {
  const source = screen && typeof screen === 'object' ? screen : {};
  const question = source.question && typeof source.question === 'object'
    ? { ...source.question }
    : undefined;

  return {
    ...source,
    type: asText(source.type).toLowerCase().replace(/[\s/-]+/g, '_'),
    orderIndex: Number.isInteger(source.orderIndex) ? source.orderIndex : index,
    title: asText(source.title || source.headline),
    headline: asText(source.headline),
    body: asText(source.body),
    imageQuery: source.imageQuery === null ? null : asText(source.imageQuery) || null,
    imageAlt: source.imageAlt === null ? null : asText(source.imageAlt) || null,
    concept: asText(source.concept),
    objectiveIndex: Number.isInteger(source.objectiveIndex) ? source.objectiveIndex : undefined,
    difficulty: asText(source.difficulty).toLowerCase() || undefined,
    interactionType: asText(source.interactionType).toLowerCase().replace(/[\s/-]+/g, '_') || undefined,
    required: source.required !== false,
    question,
  };
}

export function normalizeGeneratedScreens(generated, fallbackBlueprint, fallbackTitle, fallbackDescription) {
  const source = generated && typeof generated === 'object' ? generated : {};
  const blueprint = source.learningBlueprint && typeof source.learningBlueprint === 'object'
    ? source.learningBlueprint
    : fallbackBlueprint;
  const lesson = source.lesson && typeof source.lesson === 'object' ? source.lesson : {};

  return normalizeLessonContent({
    schemaVersion: source.schemaVersion || 1,
    lesson: {
      title: asText(lesson.title) || fallbackTitle,
      description: asText(lesson.description) || fallbackDescription,
      objectives: asArray(lesson.objectives).map(asText).filter(Boolean),
    },
    learningBlueprint: blueprint,
    screens: asArray(source.screens).map(normalizeScreen),
  });
}

export async function generateInteractiveLesson({ blueprint, lessonTitle = '', lessonDescription = '' } = {}) {
  const prompt = buildScreenGenerationPrompt({ blueprint, lessonTitle, lessonDescription });
  const generated = await generateJson(prompt, { expect: 'object', maxTokens: 8192 });
  const content = normalizeGeneratedScreens(generated, blueprint, lessonTitle, lessonDescription);
  const validation = validateLessonContent(content);

  if (!validation.valid) {
    const error = new Error('Generated interactive lesson failed deterministic validation.');
    error.diagnostics = validation.diagnostics;
    error.content = content;
    throw error;
  }

  return {
    content: validation.content,
    diagnostics: validation.diagnostics,
  };
}

export { SCREEN_TYPES };
