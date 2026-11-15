import { NextResponse } from 'next/server';
import { generateWithFallback } from '@/lib/llmFallbackChain';
import { parseJsonFromText } from '@/lib/robustJsonParse';

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

    // Validate the actual affirmation schema inside the provider fallback chain.
    // A provider that returns an error message, prose, or the wrong JSON shape
    // must not be treated as a successful generation.
    const { result, usedProvider, errors } = await generateWithFallback(
      prompt,
      (output) => parseJsonFromText(output, 'object'),
      (parsed) =>
        parsed &&
        !Array.isArray(parsed) &&
        typeof parsed === 'object' &&
        Array.isArray(parsed.affirmations) &&
        parsed.affirmations.filter((item) => typeof item === 'string' && item.trim()).length >= Math.min(3, count),
      1400
    );

    if (!result) {
      throw new Error(
        `All AI providers failed to return a valid affirmation script.${errors?.length ? ' Details: ' + errors.join(' | ') : ''}`
      );
    }

    const affirmations = result.affirmations
      .filter((item) => typeof item === 'string' && item.trim())
      .map((item) => item.trim())
      .slice(0, count);

    return NextResponse.json({
      script: {
        intro: String(result.intro || 'Take a breath. Listen carefully and repeat after me.').trim().slice(0, 120),
        affirmations,
      },
      provider: usedProvider,
    });
  } catch (error) {
    console.error('Affirmation script generation failed:', error);
    return NextResponse.json(
      { error: error.message || 'Could not generate affirmation script.' },
      { status: 500 }
    );
  }
}
