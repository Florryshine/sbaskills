import { NextResponse } from 'next/server';
import { generateJson } from '@/lib/content-factory/generators/_shared';

const TYPES = {
  question: 'Create a tricky JAMB-style multiple-choice question with four options, reveal the correct answer and a short explanation. Make the hook strong.',
  story: 'Create a suspenseful micro-story with a hook, escalating tension, a twist or climax, and a satisfying ending.',
  joke: 'Create a genuinely funny, short joke with setup and punchline, suitable for Nigerian social media and not insulting.',
  fact: 'Create a surprising, accurate fact with a strong hook and a simple explanation. Do not invent facts.',
  motivation: 'Create a direct, emotionally resonant motivational message with a strong opening and a memorable final line. Avoid clichés.',
  lesson: 'Teach one useful concept clearly using a simple example and a memorable takeaway.',
  riddle: 'Create a clever riddle with clues, then reveal the answer near the end.',
  promo: 'Create a concise promotional script with a strong problem, benefit, and natural call to action.',
};

export async function POST(request) {
  try {
    const body = await request.json();
    const type = TYPES[body.type] ? body.type : 'question';
    const seconds = Math.max(10, Math.min(120, Number(body.seconds) || 20));
    const topic = String(body.topic || '').trim().slice(0, 500) || 'choose an engaging topic suitable for Shiney Brain Academy and Nigerian social media';
    const prompt = `You write highly engaging short-video scripts. Create a ${seconds}-second video in the category: ${type}.
CATEGORY REQUIREMENTS: ${TYPES[type]}
TOPIC: ${topic}
Audience: Nigerian teens and young adults. Write natural, clear English, not pidgin unless the joke naturally calls for it. Keep the first line scroll-stopping. Plan for approximately ${Math.round(seconds * 2.3)} spoken words but this is a silent text-only video, so split the script into 3 to 10 readable caption scenes. Keep each scene concise (ideally 3–9 words); put only one thought per scene. For a question, options and answer must be legible and separated across scenes. For story/joke, preserve setup and payoff. End with a natural CTA only when suitable.
Return only JSON: { "title": "short title", "scenes": [{ "label": "2-4 word cue", "text": "caption text" }] }. Ensure the total scene count and text length suit ${seconds} seconds. No markdown fences.`;
    const result = await generateJson(prompt, { expect: 'object', maxTokens: 1800 });
    const scenes = Array.isArray(result.scenes) ? result.scenes
      .filter(s => s && String(s.text || '').trim())
      .slice(0, 12)
      .map(s => ({ label: String(s.label || 'WATCH THIS').slice(0, 40), text: String(s.text).trim().slice(0, 180) })) : [];
    if (!scenes.length) throw new Error('AI returned an empty script. Try again.');
    return NextResponse.json({ script: { title: String(result.title || topic).slice(0, 120), scenes } });
  } catch (error) {
    console.error('Bold Text Video generation error:', error);
    return NextResponse.json({ error: error.message || 'Could not generate the script' }, { status: 500 });
  }
}
