import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/require-admin-api';
import { generateJson } from '@/lib/content-factory/generators/_shared';
import { getKnowledgeAsset, getMasterScript, masterScriptToVideoScenes } from '@/lib/ka-package/video-adapters';

export const runtime = 'nodejs';
export const maxDuration = 60;

const clean = (value, max = 240) => String(value ?? '').trim().slice(0, max);
const SUBJECTS = ['biology', 'chemistry', 'physics', 'mathematics', 'general'];

export async function POST(request) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;
  try {
    const body = await request.json();
    const topic = clean(body.topic, 240);
    const subject = clean(body.subject || 'general', 30).toLowerCase();
    const subjectName = SUBJECTS.includes(subject) ? subject : 'general';

    if (topic.length < 3) {
      return NextResponse.json({ error: 'Enter a lesson topic first.' }, { status: 400 });
    }

    // When a Knowledge Asset is selected, reuse its shared teaching script.
    // Freeform topic generation remains available for topics outside the KA library.
    if (body.knowledgeAssetId) {
      const asset = await getKnowledgeAsset(body.knowledgeAssetId);
      const { component, reused } = await getMasterScript(asset);
      const scenes = masterScriptToVideoScenes(component.body);
      if (scenes.length < 2) throw new Error('The shared teaching script did not produce enough usable scenes.');
      return NextResponse.json({
        success: true,
        plan: { title: clean(component.body.title || asset.keyword, 120), subject: subjectName, scenes },
        reuse: { componentId: component.id, reused, componentType: 'master_script' },
        nextStep: 'Choose or upload an image for each scene, then generate narration when ready.',
      });
    }

    const prompt = `You are the instructional designer for Shiney Brain Academy. Create a scientifically accurate, teacher-friendly whiteboard video lesson about "${topic}" (subject: ${subjectName}).

Create 4–8 scenes in a logical teaching order. Treat the scenes as a visual storyboard, not merely paragraphs split into chunks. Do not create drawings, SVG instructions, stroke coordinates or image descriptions pretending to be actual images. The teacher will search for or upload real images after the script is generated.

VISUAL STORYBOARD RULES (important):
- Teach one main concept or one stage of a process per scene.
- When a topic contains several named parts, give important parts their own scenes instead of cramming them into one image. Example: for a cell lesson, use separate scenes for the whole cell, nucleus, mitochondrion and cell membrane where each part is explained.
- Every scene must introduce a genuinely new visual focus. Do not repeat the same diagram/query with slightly different wording.
- Make the visualQuery specific to the exact object or process being explained in that scene (for example, "mitochondrion labelled structure", not just "cell diagram").
- Use a sensible teaching sequence: introduce the whole system first, then zoom into its parts or stages, then show how they work together.
- Narration must describe the visual that belongs to that scene. Never mention a structure that is not the scene's visual focus unless briefly connecting it to the previous scene.
- Do not force 8 scenes for a simple topic. Use 4–8 only when the topic genuinely contains enough distinct concepts; avoid filler and repetition.

Each scene must contain:
- heading: short, clear on-screen heading
- narration: one concise, accurate spoken explanation in clear Nigerian English, not pidgin (12–18 words maximum; it must take 5–8 seconds to say aloud)
- visualQuery: a short literal 2–5 word image-search phrase for a real educational diagram or photo
- visualType: exactly "educational_diagram", "process", or "real_world_photo"
- reveal: exactly "scribble" or "wipe"
- highlightTerms: up to 4 short labels/parts to look for in the selected image
- durationSeconds: 5–8

Avoid repeated visual queries. Keep the lesson factually grounded. Return ONLY JSON:
{"title":"...","scenes":[{"heading":"...","narration":"...","visualQuery":"human heart anatomy diagram","visualType":"educational_diagram","reveal":"scribble","highlightTerms":["atria","ventricles"],"durationSeconds":10}]}`;

    // Keep script generation separate from image downloads and TTS. Those are
    // teacher-controlled next steps in the Studio and must not hold this request open.
    let timeoutId;
    const generated = await Promise.race([
      generateJson(prompt, { expect: 'object', maxTokens: 3500 }),
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('The AI script request timed out. Please try again.')), 45000);
      }),
    ]).finally(() => clearTimeout(timeoutId));

    if (!Array.isArray(generated.scenes) || generated.scenes.length < 2 || generated.scenes.length > 8) {
      throw new Error('The lesson planner returned an invalid scene list. Please try again.');
    }

    const scenes = generated.scenes.map((scene, index) => {
      const narration = clean(String(scene.narration || "").trim().split(/\s+/).slice(0, 18).join(" "), 240).replace(/[,:;\s]+$/, "") + ".";
      const visualQuery = clean(scene.visualQuery, 140);
      if (!narration) throw new Error(`Scene ${index + 1} has no narration.`);
      if (!visualQuery) throw new Error(`Scene ${index + 1} has no image search phrase.`);
      return {
        heading: clean(scene.heading, 100) || `Scene ${index + 1}`,
        narration,
        text: narration,
        visualQuery,
        visualType: ['educational_diagram', 'process', 'real_world_photo'].includes(scene.visualType) ? scene.visualType : 'educational_diagram',
        reveal: scene.reveal === 'wipe' ? 'wipe' : 'scribble',
        highlightTerms: Array.isArray(scene.highlightTerms) ? scene.highlightTerms.slice(0, 4).map(x => clean(x, 50)).filter(Boolean) : [],
        durationSeconds: Math.max(5, Math.min(8, Number(scene.durationSeconds) || 8)),
        image: null,
        audioSrc: null,
      };
    });

    return NextResponse.json({
      success: true,
      plan: { title: clean(generated.title || topic, 120), subject: subjectName, scenes },
      nextStep: 'Choose or upload an image for each scene, then generate narration when ready.',
    });
  } catch (error) {
    console.error('Video Studio script generation failed:', error);
    const timedOut = /timed out/i.test(error.message || '');
    return NextResponse.json(
      { error: error.message || 'Could not generate this lesson.' },
      { status: timedOut ? 504 : 500 }
    );
  }
}
