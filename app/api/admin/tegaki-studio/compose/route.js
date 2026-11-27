import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { generateWithFallback } from '@/lib/llmFallbackChain';
import { parseJsonFromText } from '@/lib/robustJsonParse';
import { createTegakiLessonScene } from '@/lib/tegaki-engine/config';
import { TEGAKI_ILLUSTRATION_IDS, suggestTegakiIllustration } from '@/lib/tegaki-engine/illustrations';

export const maxDuration = 180;

const ALLOWED_TYPES = new Set(['heading','subheading','paragraph','bullet','numbered','definition','example','formula','question','answer','note']);

function clean(value, max = 500) {
  return String(value ?? '').replace(/<[^>]*>/g, '').trim().slice(0, max);
}
function validComposition(value) {
  if (!value || typeof value.title !== 'string' || !Array.isArray(value.scenes)) return false;
  if (value.scenes.length < 3 || value.scenes.length > 6) return false;
  return value.scenes.every(scene =>
    scene && typeof scene.heading === 'string' && scene.heading.trim() &&
    Array.isArray(scene.sections) && scene.sections.length >= 2 && scene.sections.length <= 7 &&
    scene.sections.every(section => section && ALLOWED_TYPES.has(section.type) && typeof section.text === 'string' && section.text.trim()) &&
    typeof scene.narration === 'string' && scene.narration.trim() &&
    typeof scene.illustration === 'string'
  );
}
function buildPrompt(asset, duration) {
  const source = {
    topic: asset.keyword, subject: asset.subject, summary: asset.summary,
    keyConcepts: asset.key_concepts || [], definitions: asset.definitions || [],
    examples: asset.examples || [], facts: asset.facts || [],
    commonMistakes: asset.common_mistakes || [],
  };
  return `You are a careful science teacher and lesson storyboard editor for Shiney Brain Academy.
Create a clear handwritten lesson video from ONLY the supplied Knowledge Asset. Target duration: ${duration} seconds.
SOURCE MATERIAL (authoritative; do not invent beyond it):
${JSON.stringify(source)}

Build a teachable sequence of 3 to 6 scenes in a logical progression:
1. Hook and learning objective (brief, no empty motivational filler).
2. Core definition or central idea.
3. Explain the mechanism / structure / process in a useful order.
4. A relevant example or comparison where the source supports it.
5. Exam focus / common misconception / short retrieval question where supported.
Use 3-6 scenes total; combine stages where the topic is small. Each scene should feel like the next step of one lesson, not disconnected cards.
For each scene return:
- heading: short handwritten title (max 55 characters).
- sections: 2-7 compact structured blocks. Allowed types: heading, subheading, paragraph, bullet, numbered, definition, example, formula, question, answer, note.
- narration: natural teacher narration that explains these blocks, not just reads them. Aim for about 20-35 words per scene. Keep the total narration proportional to the ${duration}-second target.
- illustration: choose ONE relevant ID from this allowed SBA illustration library: ${TEGAKI_ILLUSTRATION_IDS.join(', ')}. If no exact fit, choose the closest accurate concept or "animal-cell" only when topic is cell-related. Never invent an ID.
- illustrationLabel: short caption (max 32 characters).
- visualFocus: one short phrase describing what the student should notice in the diagram.
- keyTakeaway: one concise sentence.
Accuracy rules:
- Preserve exact scientific meaning and conditions from the source.
- Never create unsupported numbers, facts, syllabus claims, past-question claims or examples.
- Do not force an illustration that misrepresents the concept. If no relevant library illustration exists, use "atomic-structure" only for chemistry, "vectors-forces" only for mechanics, otherwise "animal-cell" is forbidden unless cells are actually the topic; use "flower-anatomy" only for botany.
- ASCII only in all handwritten text and narration. Write chemical formulae plainly (H2O, CO2), powers with ^, arrows as ->.
- Avoid long paragraphs: each block should fit one or two handwritten lines.
- Do not repeat the same point in multiple scenes.
Return ONLY JSON:
{"title":"...","learningObjectives":["..."],"scenes":[{"heading":"...","sections":[{"type":"definition","text":"..."}],"narration":"...","illustration":"...","illustrationLabel":"...","visualFocus":"...","keyTakeaway":"..."}]}`;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const knowledgeAssetId = clean(body.knowledgeAssetId, 100);
    const duration = Math.max(20, Math.min(120, Number(body.durationSeconds) || 40));
    if (!knowledgeAssetId) return NextResponse.json({ error: 'Select a Knowledge Asset before composing a lesson.' }, { status: 400 });

    const supabase = createAdminClient();
    const { data: asset, error } = await supabase.from('knowledge_assets')
      .select('id, keyword, subject, summary, key_concepts, definitions, examples, facts, common_mistakes, exam_type')
      .eq('id', knowledgeAssetId).single();
    if (error || !asset) return NextResponse.json({ error: 'Knowledge Asset not found.' }, { status: 404 });

    const prompt = buildPrompt(asset, duration);
    const { result, usedProvider, errors } = await generateWithFallback(
      prompt,
      (text) => { try { return parseJsonFromText(text, 'object'); } catch { return null; } },
      validComposition,
      4096,
    );
    if (!result) return NextResponse.json({ error: errors?.join('; ') || 'Lesson composition failed validation.' }, { status: 502 });

    const wordCount = result.scenes.reduce((sum, scene) => sum + scene.narration.trim().split(/\s+/).length, 0);
    const totalSeconds = Math.max(duration, Math.round((wordCount / 135) * 60));
    const sceneWeights = result.scenes.map(scene => Math.max(1, scene.narration.trim().split(/\s+/).length));
    const weightTotal = sceneWeights.reduce((a,b) => a+b, 0);
    let allocated = 0;
    const scenes = result.scenes.map((scene, index) => {
      const sceneDuration = index === result.scenes.length - 1
        ? Math.max(4, totalSeconds - allocated)
        : Math.max(4, Math.round(totalSeconds * sceneWeights[index] / weightTotal));
      allocated += sceneDuration;
      const suggested = suggestTegakiIllustration(asset.keyword, asset.subject);
      const requestedIllustration = TEGAKI_ILLUSTRATION_IDS.includes(scene.illustration) ? scene.illustration : suggested;
      const sections = scene.sections.map(section => ({ type: section.type, text: clean(section.text, 180) }));
      const text = sections.map(section => section.type === 'bullet' ? '- ' + section.text : section.text).join('\n');
      return createTegakiLessonScene({
        id: `tegaki-${index + 1}`,
        heading: clean(scene.heading, 55),
        text,
        narration: clean(scene.narration, 900),
        durationSeconds: sceneDuration,
        illustrationCues: [{ at: 0, illustration: requestedIllustration, label: clean(scene.illustrationLabel || scene.heading, 32) }],
      });
    });

    return NextResponse.json({
      success: true,
      title: clean(result.title || asset.keyword, 100),
      subject: asset.subject,
      topic: asset.keyword,
      knowledgeAssetId: asset.id,
      learningObjectives: Array.isArray(result.learningObjectives) ? result.learningObjectives.map(item => clean(item, 160)).filter(Boolean).slice(0, 4) : [],
      durationSeconds: scenes.reduce((sum, scene) => sum + scene.durationSeconds, 0),
      scenes,
      usedProvider: usedProvider || null,
      sourceCoverage: {
        keyConcepts: (asset.key_concepts || []).length,
        definitions: (asset.definitions || []).length,
        examples: (asset.examples || []).length,
        facts: (asset.facts || []).length,
      },
    });
  } catch (error) {
    console.error('Tegaki lesson composition failed:', error);
    return NextResponse.json({ error: error.message || 'Unable to compose this Tegaki lesson.' }, { status: 500 });
  }
}
