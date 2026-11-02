import { NextResponse } from 'next/server';
import { generateJson } from '@/lib/content-factory/generators/_shared';
import { synthesizeLine, estimateDurationSeconds } from '@/lib/podcastTTS';
import { createAdminClient } from '@/lib/supabase-admin';
import { searchWikimediaMulti, searchPexelsMulti, searchPixabayMulti } from '@/lib/image-search';

export const runtime = 'nodejs';
export const maxDuration = 60;

const BUCKET = 'lesson-loops';
const clean = (v, max = 240) => String(v ?? '').trim().slice(0, max);
const SUBJECTS = ['biology', 'chemistry', 'physics', 'mathematics', 'general'];

async function findSceneImage(query, subject) {
  const q = clean(query || subject, 140);
  // Educational topics need diagrams first; use stock photos only as fallback.
  const providers = [searchWikimediaMulti, searchPexelsMulti, searchPixabayMulti];
  for (const provider of providers) {
    try {
      const hits = await provider(q, 5);
      const valid = hits.filter(x => x?.url && /^https:\/\//i.test(x.url));
      if (valid.length) return valid[0];
    } catch (error) {
      console.warn('Video Studio image provider failed:', provider.name, error.message);
    }
  }
  return null;
}

async function uploadNarration(supabase, key, buffer) {
  const path = `video-studio/${key}.mp3`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, {
    contentType: 'audio/mpeg',
    upsert: true,
    cacheControl: '3600',
  });
  if (error) throw new Error(`Narration upload failed: ${error.message}`);
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const topic = clean(body.topic, 240);
    const subject = clean(body.subject || 'general', 30).toLowerCase();
    const voice = body.voice === 'host_b' ? 'host_b' : 'host_a';
    if (topic.length < 3) return NextResponse.json({ error: 'Enter a lesson topic first.' }, { status: 400 });
    const subjectName = SUBJECTS.includes(subject) ? subject : 'general';

    const prompt = `You are the instructional designer for Shiney Brain Academy. Create a scientifically accurate, image-led whiteboard video lesson about "${topic}" (subject: ${subjectName}).

IMPORTANT VISUAL RULE: Do NOT create drawings, SVG instructions, stroke coordinates, doodles, or hand-drawn substitutes for the main subject. Every scene MUST request a real, relevant existing educational image or diagram that can be fetched from Wikimedia Commons, Pexels or Pixabay. Prefer a labelled educational diagram for anatomy, structures, scientific processes and technical concepts. Use real photographs only when a diagram is not appropriate. Search queries must be short, literal image-search phrases.

Create 3–6 scenes in teaching order. Each scene must contain:
- heading: short on-screen heading
- narration: a natural, accurate spoken explanation in clear Nigerian English, not pidgin (35–65 words)
- visualQuery: a short 2–5 word literal image-search query for the main visual
- visualType: exactly "educational_diagram", "process", or "real_world_photo"
- reveal: exactly "scribble" or "wipe" (prefer scribble)
- highlightTerms: up to 4 short labels/parts that should be highlighted over the fetched image; do not invent labels that may not appear in the image
- durationSeconds: 6–16

Build the lesson logically: introduce the whole concept, zoom into important parts/mechanisms, then explain the process or recap. Avoid repeating the same image query. Keep narration factually grounded and do not invent details.

Return ONLY JSON:
{"title":"...","scenes":[{"heading":"...","narration":"...","visualQuery":"human heart anatomy diagram","visualType":"educational_diagram","reveal":"scribble","highlightTerms":["atria","ventricles"],"durationSeconds":10}]}`;

    const generated = await generateJson(prompt, { expect: 'object', maxTokens: 5000 });
    if (!Array.isArray(generated.scenes) || generated.scenes.length < 2 || generated.scenes.length > 8) {
      throw new Error('The lesson planner returned an invalid scene list.');
    }

    const supabase = createAdminClient();
    const scenes = await Promise.all(generated.scenes.map(async (scene, index) => {
      const narration = clean(scene.narration, 900);
      if (!narration) throw new Error(`Scene ${index + 1} has no narration.`);
      const visualQuery = clean(scene.visualQuery, 140);
      if (!visualQuery) throw new Error(`Scene ${index + 1} has no image search query.`);
      const [image, audio] = await Promise.all([
        findSceneImage(visualQuery, subjectName),
        synthesizeLine(narration, voice, 'curious').then(buffer =>
          uploadNarration(supabase, `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`, buffer)
        ),
      ]);
      return {
        heading: clean(scene.heading, 100),
        narration,
        visualQuery,
        visualType: ['educational_diagram', 'process', 'real_world_photo'].includes(scene.visualType) ? scene.visualType : 'educational_diagram',
        reveal: scene.reveal === 'wipe' ? 'wipe' : 'scribble',
        highlightTerms: Array.isArray(scene.highlightTerms) ? scene.highlightTerms.slice(0, 4).map(x => clean(x, 50)).filter(Boolean) : [],
        durationSeconds: Math.max(6, Math.min(20, Number(scene.durationSeconds) || estimateDurationSeconds(narration))),
        image: image ? { url: image.url, source: image.source, sourceUrl: image.sourceUrl, photographer: image.photographer, license: image.license } : null,
        audioUrl: audio,
      };
    }));

    const missing = scenes.filter(s => !s.image);
    return NextResponse.json({
      success: true,
      plan: { title: clean(generated.title || topic, 120), subject: subjectName, scenes },
      warnings: missing.length ? missing.map(s => `No suitable image found for: ${s.visualQuery}`) : [],
    });
  } catch (error) {
    console.error('Image-led video generation failed:', error);
    return NextResponse.json({ error: error.message || 'Could not generate this lesson.' }, { status: 500 });
  }
}
