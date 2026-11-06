import { NextResponse } from 'next/server';
import { generateJson } from '@/lib/content-factory/generators/_shared';

export const maxDuration = 45;

export async function POST(request) {
  try {
    const body = await request.json();
    const topic = String(body.topic || '').trim().slice(0, 300);
    const count = Math.max(5, Math.min(12, Number(body.count) || 8));
    if (!topic) return NextResponse.json({ error: 'Enter a theme for the affirmations.' }, { status: 400 });

    const prompt = `You are an expert motivational scriptwriter creating a spoken affirmation video for Shiney Brain Academy.
THEME: ${topic}
Create an emotionally grounded, uplifting affirmation sequence for Nigerian secondary-school and JAMB students.
Return exactly ${count} distinct first-person affirmations, written as words the student can confidently repeat aloud.
Use natural, clear English. Make the affirmations specific, believable, positive and varied. Include confidence, discipline, calm under pressure, consistent preparation and belief in improvement where relevant to the theme. Avoid unrealistic guarantees, empty clichés, shame, fear or claims that success is automatic.
Also write a short opening line that invites the student to breathe, listen and repeat. Keep it under 12 words.
Keep each affirmation concise (ideally 6–16 words), memorable and suitable for on-screen display.
Return only valid JSON: { "intro": "short opening line", "affirmations": ["I ...", "..."] }. No markdown.`;
    const result = await generateJson(prompt, { expect: 'object', maxTokens: 1400 });
    const affirmations = Array.isArray(result.affirmations)
      ? result.affirmations.map(x => String(x || '').trim()).filter(Boolean).slice(0, count)
      : [];
    if (affirmations.length < 3) throw new Error('AI returned too few affirmations. Please try again.');
    return NextResponse.json({
      script: {
        intro: String(result.intro || 'Take a breath. Listen carefully and repeat after me.').trim().slice(0, 120),
        affirmations,
      },
    });
  } catch (error) {
    console.error('Affirmation script generation failed:', error);
    return NextResponse.json({ error: error.message || 'Could not generate affirmation script.' }, { status: 500 });
  }
}
