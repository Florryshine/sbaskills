import { NextResponse } from 'next/server';
import { generateJson } from '@/lib/content-factory/generators/_shared';

export const runtime = 'nodejs';
export const maxDuration = 60;

const clean = (value, max = 240) => String(value ?? '').trim().slice(0, max);
const SUBJECTS = ['biology', 'chemistry', 'physics', 'mathematics', 'general'];

export async function POST(request) {
  try {
    const body = await request.json();
    const topic = clean(body.topic, 240);
    const subject = clean(body.subject || 'general', 30).toLowerCase();
    const subjectName = SUBJECTS.includes(subject) ? subject : 'general';

    if (topic.length < 3) {
      return NextResponse.json({ error: 'Enter a lesson topic first.' }, { status: 400 });
    }

    const prompt = `You are the instructional designer for Shiney Brain Academy. Create a scientifically accurate, teacher-friendly whiteboard video lesson about "${topic}" (subject: ${subjectName}).

Create 3–6 scenes in a logical teaching order. Do not create drawings, SVG instructions, stroke coordinates or image descriptions pretending to be actual images. The teacher will search for or upload real images after the script is generated.

Each scene must contain:
- heading: short, clear on-screen heading
- narration: natural, accurate spoken explanation in clear Nigerian English, not pidgin (35–65 words)
- visualQuery: a short literal 2–5 word image-search phrase for a real educational diagram or photo
- visualType: exactly "educational_diagram", "process", or "real_world_photo"
- reveal: exactly "scribble" or "wipe"
- highlightTerms: up to 4 short labels/parts to look for in the selected image
- durationSeconds: 6–16

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
      const narration = clean(scene.narration, 900);
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
        durationSeconds: Math.max(6, Math.min(30, Number(scene.durationSeconds) || 8)),
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
