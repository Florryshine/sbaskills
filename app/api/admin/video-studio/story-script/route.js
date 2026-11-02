import { NextResponse } from 'next/server';
import { generateJson } from '@/lib/content-factory/generators/_shared';

export const runtime = 'nodejs';
export const maxDuration = 60;

function clean(value, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

function validateStory(value) {
  if (!value || !Array.isArray(value.scenes) || value.scenes.length < 3 || value.scenes.length > 8) {
    throw new Error('Gemini returned an invalid story. Please generate it again.');
  }
  const scenes = value.scenes.map((scene, index) => {
    const heading = clean(scene?.heading, 110);
    const text = clean(scene?.text, 650);
    const durationSeconds = Math.max(4, Math.min(15, Number(scene?.durationSeconds) || 7));
    if (!heading || !text) throw new Error(`Story scene ${index + 1} is missing its heading or narration.`);
    return { heading, text, durationSeconds };
  });
  return { title: clean(value.title, 120) || 'A Shiney Brain Story', scenes };
}

export async function POST(request) {
  try {
    const body = await request.json();
    const idea = clean(body.idea, 700);
    const subject = clean(body.subject || 'general', 40);
    const audience = clean(body.audience || 'Nigerian students preparing for UTME/JAMB', 120);
    const platform = clean(body.platform || '9:16 short-form video', 60);
    if (idea.length < 8) {
      return NextResponse.json({ error: 'Describe the story idea in at least a few words.' }, { status: 400 });
    }

    const prompt = `You are the lead short-form video storyteller for Shiney Brain Academy (SBA), an ambitious Nigerian education brand. Turn the user's idea into a compelling, emotionally engaging story script for ${audience}.

STORY IDEA: ${idea}
SUBJECT / CONTEXT: ${subject}
VIDEO FORMAT: ${platform}

STORYTELLING RULES:
- Write an actual story, not a lecture, list of tips, motivational sermon, or advert.
- Start with a strong curiosity hook or immediate moment of tension. Do not waste the opening introducing the brand.
- Give the protagonist a clear desire, a believable obstacle or antagonist, rising stakes, a turning point, and a satisfying action-driven climax.
- Show specific actions, decisions, consequences and emotion. Avoid generic lines like "believe in yourself" or "success is a journey".
- Make the story feel recognisably Nigerian where natural, without forced slang or stereotypes. Use clear natural English, not pidgin.
- Keep the pacing tight for a ${platform} video. Each scene must be visually imaginable and understandable without seeing the narration.
- The headings are short on-screen animated typography. Keep each heading punchy (ideally 3–8 words).
- Each scene's text is the spoken narration. Aim for 1–3 concise sentences per scene; no stage directions, camera directions, markdown, or speaker labels.
- Build 4–6 scenes, with a clear progression. Give the climax enough room; do not rush directly from problem to moral.
- The final scene should deliver an emotionally satisfying payoff and a natural, brief SBA sign-off such as "This is Questions of the Day from Shiney Brain Academy. See you at the next question." Only use a question-of-the-day sign-off if the story is about an exam question; otherwise use a natural story close and a light brand sign-off.
- Do not invent claims about SBA student results, statistics, services or guarantees.
- Do not include exam answers or factual educational claims unless they are necessary and you are certain they are correct.

Return ONLY valid JSON in this exact shape:
{
  "title": "Short video title",
  "scenes": [
    { "heading": "Short on-screen line", "text": "Spoken narration for this scene.", "durationSeconds": 7 }
  ]
}
No extra keys, no markdown fences, no explanation.`;

    // generateJson uses the existing provider chain, which attempts Gemini first.
    const generated = await generateJson(prompt, { expect: 'object', maxTokens: 3500 });
    const script = validateStory(generated);
    return NextResponse.json({ success: true, script, provider: 'Gemini-first SBA AI fallback chain' });
  } catch (error) {
    console.error('Video Studio story script generation failed:', error);
    return NextResponse.json({ error: error.message || 'Could not generate this story.' }, { status: 500 });
  }
}
