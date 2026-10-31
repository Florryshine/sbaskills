import { NextResponse } from 'next/server';
import { generateJson } from '@/lib/content-factory/generators/_shared';
import { synthesizeLine, estimateDurationSeconds } from '@/lib/podcastTTS';

export const runtime = 'nodejs';

const SUBJECT_GUIDANCE = {
  chemistry: 'Use accurate molecular, atomic, electron-shell, apparatus and reaction diagrams.',
  biology: 'Use accurate cells, organs, organisms, cycles, food webs and process diagrams.',
  physics: 'Use accurate forces, vectors, circuits, waves, rays and motion diagrams.',
  mathematics: 'Use accurate graphs, axes, geometric figures, number lines and worked equations.',
  general: 'Use clear educational diagrams, labelled objects, arrows and process illustrations.'
};

function cleanText(value, max = 240) {
  return String(value ?? '').trim().slice(0, max);
}

function validateScenePlan(data) {
  if (!data || !Array.isArray(data.scenes) || data.scenes.length < 2 || data.scenes.length > 10) {
    throw new Error('The lesson planner returned an invalid scene list.');
  }
  const scenes = data.scenes.map((scene, index) => {
    if (!scene || !Array.isArray(scene.strokes) || scene.strokes.length < 2 || scene.strokes.length > 14) {
      throw new Error(`Scene ${index + 1} has invalid drawing instructions.`);
    }
    const strokes = scene.strokes.map((stroke) => {
      if (!Array.isArray(stroke.points) || stroke.points.length < 2 || stroke.points.length > 80) {
        throw new Error('A drawing stroke must contain 2–80 points.');
      }
      const points = stroke.points.map((point) => {
        const x = Number(point?.[0]), y = Number(point?.[1]);
        if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 1000 || y < 0 || y > 700) {
          throw new Error('Drawing coordinates must be between 0–1000 and 0–700.');
        }
        return [x, y];
      });
      return {
        points,
        color: /^#[0-9a-f]{6}$/i.test(stroke.color || '') ? stroke.color : '#173f68',
        width: Math.max(2, Math.min(12, Number(stroke.width) || 5)),
        kind: stroke.kind === 'arrow' ? 'arrow' : 'line'
      };
    });
    const labels = (Array.isArray(scene.labels) ? scene.labels : []).slice(0, 10).map((label) => ({
      text: cleanText(label.text, 70),
      x: Math.max(0, Math.min(1000, Number(label.x) || 0)),
      y: Math.max(0, Math.min(700, Number(label.y) || 0)),
      size: Math.max(16, Math.min(42, Number(label.size) || 26)),
      color: /^#[0-9a-f]{6}$/i.test(label.color || '') ? label.color : '#173f68'
    })).filter(label => label.text);
    return {
      heading: cleanText(scene.heading, 100),
      narration: cleanText(scene.narration, 700),
      durationSeconds: Math.max(4, Math.min(18, Number(scene.durationSeconds) || 8)),
      strokes,
      labels
    };
  });
  return { title: cleanText(data.title, 120), subject: cleanText(data.subject, 40), scenes };
}

export async function POST(request) {
  try {
    const body = await request.json();
    const topic = cleanText(body.topic, 240);
    const subject = cleanText(body.subject || 'general', 30).toLowerCase();
    if (topic.length < 3) return NextResponse.json({ error: 'Enter a lesson topic first.' }, { status: 400 });
    const guidance = SUBJECT_GUIDANCE[subject] || SUBJECT_GUIDANCE.general;
    const prompt = `You are the instructional designer and storyboard artist for Shiney Brain Academy. Create a scientifically accurate, visually teachable whiteboard lesson about: "${topic}". Subject: ${subject}. Visual guidance: ${guidance}

Return 3–6 scenes. Each scene needs a concise heading, a natural spoken narration paragraph in clear Nigerian English (not pidgin), and original hand-drawable vector strokes. Do not merely describe visuals: encode them as point paths.

COORDINATE SYSTEM: 1000 wide x 700 high. All stroke points are arrays [x,y] within those bounds. Keep drawings centred between x=80..920 and y=80..620. Use 2–14 strokes per scene, each 2–35 points. Use connected points to form outlines, curves approximated by enough points, arrows, axes, molecule bonds, labels, diagrams. Avoid excessive detail. Add text labels separately with x/y coordinates. Do not put words inside stroke paths. Plan drawing order so the visual builds progressively. Make every scene's drawing meaningfully different and directly related to its narration. The first scene introduces the concept; later scenes explain steps/mechanisms; final scene summarises.

For arrows use kind "arrow"; other strokes use "line". Stroke width 2–12. Use dark blue #173f68 for most lines, and restrained accent colours such as #e1a82b, #25845d, #c14e45. Each label has text, x, y, size (16–42), color. Coordinates refer to a 1000x700 drawing board. Each scene durationSeconds 4–18.

Return ONLY JSON:
{"title":"...","subject":"...","scenes":[{"heading":"...","narration":"...","durationSeconds":8,"strokes":[{"points":[[100,100],[200,200]],"color":"#173f68","width":5,"kind":"line"}],"labels":[{"text":"label","x":200,"y":100,"size":28,"color":"#173f68"}]}]}
Ensure explanations and drawings are factually correct. Do not invent equations, structures or mechanisms.`;
    const generated = await generateJson(prompt, { expect: 'object', maxTokens: 6500 });
    const plan = validateScenePlan({ ...generated, subject });
    for (const scene of plan.scenes) {
      if (!scene.narration) throw new Error('A scene is missing its narration.');
      const audio = await synthesizeLine(scene.narration, 'host_a', 'neutral');
      scene.audioSrc = 'data:audio/mpeg;base64,' + audio.toString('base64');
      scene.durationSeconds = Math.max(scene.durationSeconds, estimateDurationSeconds(scene.narration) + 1);
    }
    return NextResponse.json({ success: true, plan });
  } catch (error) {
    console.error('Whiteboard lesson generation failed:', error);
    return NextResponse.json({ error: error.message || 'Could not generate this lesson.' }, { status: 500 });
  }
}
