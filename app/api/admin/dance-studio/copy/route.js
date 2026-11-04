import { NextResponse } from 'next/server';
import { generateJson } from '@/lib/content-factory/generators/_shared';

export const runtime = 'nodejs';
export const maxDuration = 45;

export async function POST(request) {
  try {
    const body = await request.json();
    const topic = String(body.topic || '').trim().slice(0, 500);
    const tone = ['motivational', 'educational', 'promotional', 'storytelling'].includes(body.tone) ? body.tone : 'motivational';
    if (topic.length < 4) return NextResponse.json({ error: 'Please enter a topic or message idea.' }, { status: 400 });

    const prompt = `You are a sharp Nigerian social video copywriter for Shiney Brain Academy (SBA). Write copy for a short vertical video with a person or stickman dancing in the background.

Topic / brief: "${topic}"
Tone: ${tone}

Return a JSON object with:
- headline: a scroll-stopping headline of 3–7 words, no hashtags.
- overlayText: a meaningful, emotionally engaging message of 30–48 words. It must be readable on a dancing video: short sentences, no list, no hashtags, no emojis. Avoid generic filler. Do not mention SBA unless the brief asks for promotion.
- socialCaption: a separate social-media caption of 35–75 words, written naturally, with a clear hook and a simple call to action. Include at most 3 relevant hashtags at the end.

Use clear, natural English. No pidgin. No fake statistics or promises. Make the writing feel human, specific and worth reading. Return JSON only.`;
    const data = await generateJson(prompt, { expect: 'object', maxTokens: 900 });
    const headline = String(data.headline || '').trim().slice(0, 100);
    const overlayText = String(data.overlayText || '').trim().slice(0, 700);
    const socialCaption = String(data.socialCaption || '').trim().slice(0, 1000);
    if (!headline || !overlayText || !socialCaption) throw new Error('The copy generator returned incomplete text. Please try again.');
    return NextResponse.json({ headline, overlayText, socialCaption });
  } catch (error) {
    console.error('Dance studio copy generation failed:', error);
    return NextResponse.json({ error: error.message || 'Could not generate video copy.' }, { status: 500 });
  }
}