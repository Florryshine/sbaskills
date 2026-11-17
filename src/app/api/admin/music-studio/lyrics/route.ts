/**
 * /api/lyrics — the creative & educational brain of the studio.
 *
 * Provider chain (first available wins):
 *   1. Gemini  — the studio's primary AI (reuses the site's existing Gemini
 *      integration; set GEMINI_API_KEY, optionally GEMINI_MODEL).
 *   2. z-ai    — sandbox/preview brain (z-ai-web-dev-sdk, server-side only).
 *   3. fallback— deterministic offline lyricist (always succeeds, zero cost).
 *
 * A second AI pass FACT-CHECKS the lyrics when an AI provider is used.
 * The response is a SongSpec skeleton WITHOUT melody notes — the client-side
 * melody finalizer guarantees singability and music-theory validity.
 */
import { NextRequest, NextResponse } from 'next/server';
import type { GenreId, MoodId, SongSpec, LyricsResponse, SectionSpec, SectionName } from '@/lib/studio/types';
import { fallbackSongSpec } from '@/lib/studio/lyricist';
import { listGenres } from '@/lib/studio/genres';

export const maxDuration = 60;

interface BrainSong {
  title?: string;
  genre?: string;
  mood?: string;
  tempoBpm?: number;
  key?: string;
  scale?: string;
  creativeNotes?: string;
  sections?: Array<{
    name?: string;
    bars?: number;
    chords?: string[];
    lines?: Array<{ text?: string; fact?: string }>;
  }>;
}

const GENRE_IDS = listGenres().map((g) => g.id);
const MOODS: MoodId[] = ['upbeat', 'happy', 'groovy', 'calm', 'epic', 'dreamy'];

function planForDuration(durationSec: number): string {
  if (durationSec <= 35) {
    return 'intro(2 bars, no lyrics), verse(8 bars, 2 lines), chorus(8 bars, 2 lines), outro(4 bars, no lyrics)';
  }
  if (durationSec <= 50) {
    return 'intro(2 bars), verse(8 bars, 2 lines), chorus(8 bars, 2 lines), verse2(8 bars, 2 lines), chorus(8 bars, 2 lines), outro(4 bars)';
  }
  if (durationSec <= 70) {
    return 'intro(4 bars), verse(8 bars, 2 lines), prechorus(4 bars, 1 line), chorus(8 bars, 2 lines), verse2(8 bars, 2 lines), chorus(8 bars, 2 lines), outro(4 bars)';
  }
  return 'intro(4 bars), verse(8 bars, 2 lines), prechorus(4 bars, 1 line), chorus(8 bars, 2 lines), verse2(8 bars, 2 lines), chorus(8 bars, 2 lines), bridge(4 bars, 1 line: the mnemonic), chorus(8 bars, 2 lines), outro(4 bars)';
}

function systemPrompt(durationSec: number): string {
  return `You are the creative brain of the Shiney Brain Academy Musical Learning Studio.
You transform educational topics into accurate, catchy learning songs for students.

EDUCATIONAL ACCURACY COMES FIRST:
- Every factual claim must be correct. Never sacrifice accuracy for rhyme.
- Put the exact fact a line teaches into its "fact" field (a clean standalone sentence).
- If a fact cannot be expressed accurately and still rhyme, keep the fact accurate and accept a looser rhyme.

MUSIC:
- genre must be one of: ${GENRE_IDS.join(', ')}. Pick the best fit for the topic and audience (African learners love afrobeats/amapiano/kids styles).
- mood must be one of: ${MOODS.join(', ')}.
- tempoBpm: 70-128. key: one of C, D, F, G, A, Bb. scale: major or minor.
- chords: one chord symbol per bar (e.g. ["C","G","Am","F"] for 4 bars). Use simple diatonic progressions in the chosen key; all bars in a section must use chords compatible with the key.

LYRICS:
- Song structure: ${planForDuration(durationSec)}.
- Verse lines: 6-9 words each, plain and clear, each teaching ONE fact.
- Chorus lines: short (5-8 words), chantable, repeat the topic name when natural.
- If the user provides notes/facts, incorporate them VERBATIM-accurate.
- For mnemonic requests, put a memorable mnemonic in the bridge and set its "fact" to what it encodes.
- Do not put words in quotes, no parentheticals, no line numbers.

OUTPUT: valid JSON only, no markdown fences, matching this schema:
{"title": string, "genre": one of the list, "mood": one of the list, "tempoBpm": number, "key": string, "scale": "major"|"minor", "creativeNotes": string, "sections": [{"name": "intro"|"verse"|"prechorus"|"chorus"|"bridge"|"hook"|"outro", "bars": number, "chords": string[], "lines": [{"text": string, "fact": string}]}]}
Sections "intro" and "outro" must have empty lines arrays [].`;
}

function userPrompt(topic: string, notes?: string, genre?: string, mood?: string, title?: string): string {
  const parts = [`Educational topic: "${topic}"`];
  if (notes && notes.trim()) parts.push(`Lesson notes that MUST be covered accurately:\n${notes.trim()}`);
  if (genre && genre !== 'auto') parts.push(`Use the "${genre}" music style.`);
  if (mood) parts.push(`Target mood: ${mood}.`);
  if (title) parts.push(`Use this song title: "${title}".`);
  parts.push('Remember: JSON only, no markdown fences.');
  return parts.join('\n\n');
}

function extractJson(content: string): BrainSong | null {
  const cleaned = content.replace(/```json|```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as BrainSong;
  } catch {
    return null;
  }
}

/* ---------------- Gemini (existing integration) ---------------- */

async function callGemini(system: string, user: string): Promise<string | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig: { temperature: 0.8, responseMimeType: 'application/json' },
      }),
    });
    if (!res.ok) return null;
    const json = await res.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    return json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? null;
  } catch {
    return null;
  }
}

/* ---------------- z-ai (sandbox/preview brain) ---------------- */

async function callZai(system: string, user: string): Promise<string | null> {
  try {
    const { default: ZAI } = await import('z-ai-web-dev-sdk');
    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'assistant', content: system },
        { role: 'user', content: user },
      ],
      thinking: { type: 'disabled' },
    });
    return completion.choices[0]?.message?.content ?? null;
  } catch {
    return null;
  }
}

/* ---------------- Validation & fact-check pass ---------------- */

function normalizeBrain(brain: BrainSong, topic: string): BrainSong | null {
  if (!brain.sections || !Array.isArray(brain.sections) || brain.sections.length === 0) return null;
  const sections = brain.sections
    .filter((s) => s && typeof s.bars === 'number' && s.bars > 0)
    .map((s) => ({
      name: (s.name ?? 'verse').toLowerCase(),
      bars: Math.max(2, Math.min(16, Math.round(s.bars ?? 8))),
      chords: Array.isArray(s.chords) && s.chords.length ? s.chords.filter((c) => /^[A-G][#b]?(m|maj7|min|sus|dim|7|m7|6|maj7)?$/i.test(c)) : [],
      lines: (Array.isArray(s.lines) ? s.lines : [])
        .filter((l) => l && typeof l.text === 'string' && l.text.trim().length > 2)
        .map((l) => ({ text: l.text!.trim(), fact: typeof l.fact === 'string' ? l.fact.trim() : undefined })),
    }))
    .filter((s) => true);
  if (!sections.length) return null;
  return {
    title: typeof brain.title === 'string' && brain.title.trim() ? brain.title.trim().slice(0, 80) : undefined,
    genre: brain.genre,
    mood: brain.mood,
    tempoBpm: brain.tempoBpm,
    key: brain.key,
    scale: brain.scale,
    creativeNotes: brain.creativeNotes,
    sections,
  };
}

async function factCheckWithAi(system: string, brain: BrainSong): Promise<{ corrected: BrainSong; corrections: string[] } | null> {
  const content = await callGemini(
    `You are a strict educational fact-checker for Shiney Brain Academy. Given a JSON song, verify every line against its "fact" and general knowledge. Fix ONLY factual errors (do not change style or structure). If a fact is wrong, correct the lyric text and the fact. Return the full corrected JSON only, no fences.`,
    JSON.stringify(brain),
  ).then((r) => r ?? undefined as unknown as string);
  if (!content) {
    // fall back to z-ai
    const z = await callZai(
      'You are a strict educational fact-checker. Verify the factual claims in this JSON song, fix factual errors only, and return the corrected JSON only.',
      JSON.stringify(brain),
    );
    if (!z) return null;
    const parsed = extractJson(z);
    if (!parsed) return null;
    const normalized = normalizeBrain(parsed, brain.title ?? '');
    return normalized ? { corrected: normalized, corrections: ['fact-checked via z-ai'] } : null;
  }
  const parsed = extractJson(content);
  if (!parsed) return null;
  const normalized = normalizeBrain(parsed, brain.title ?? '');
  return normalized ? { corrected: normalized, corrections: ['verified by AI fact-check pass'] } : null;
}

/* ---------------- Main handler ---------------- */

export async function POST(req: NextRequest) {
  let body: { topic?: string; notes?: string; genre?: string; mood?: string; durationSec?: number; title?: string; settings?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const topic = (body.topic ?? '').trim();
  if (!topic) return NextResponse.json({ error: 'A topic is required' }, { status: 400 });
  const durationSec = [30, 45, 60, 90].includes(Number(body.durationSec)) ? Number(body.durationSec) : 60;

  const system = systemPrompt(durationSec);
  const user = userPrompt(topic, body.notes, body.genre, body.mood, body.title);

  const warnings: string[] = [];
  let provider: 'gemini' | 'zai' | 'fallback' = 'fallback';
  let factCheck: LyricsResponse['factCheck'] = { checked: false };

  const settings = body.settings ?? {};
  const seedMelody = Number(settings.seedMelody) || 20261117;
  const vocalMode = (settings.vocalMode === 'tts' ? 'tts' : 'synth') as 'synth' | 'tts';
  const vocalStyle = (['bright', 'warm', 'choir'].includes(String(settings.vocalStyle)) ? settings.vocalStyle : 'bright') as string;
  const seedArrangement = Number(settings.seedArrangement) || 44401;

  let spec: SongSpec;

  const geminiOut = await callGemini(system, user);
  let brain: BrainSong | null = geminiOut ? extractJson(geminiOut) : null;
  if (brain) provider = 'gemini';

  if (!brain) {
    const zaiOut = await callZai(system, user);
    brain = zaiOut ? extractJson(zaiOut) : null;
    if (brain) provider = 'zai';
  }

  if (!brain) {
    spec = fallbackSongSpec({
      topic,
      notes: body.notes,
      settings: {
        genre: (body.genre as GenreId | 'auto') ?? 'auto',
        mood: (body.mood as MoodId) ?? 'upbeat',
        durationSec: durationSec as 30 | 45 | 60 | 90,
        seedMelody,
        vocalMode,
        vocalStyle: vocalStyle as 'bright' | 'warm' | 'choir',
        seedArrangement,
      },
    });
    warnings.push('No AI provider available — used the offline curriculum lyricist. Connect GEMINI_API_KEY for full creative power.');
  } else {
    const normalized = normalizeBrain(brain, topic);
    brain = normalized ?? brain;
    // fact-check pass (best effort)
    try {
      const fc = await factCheckWithAi(system, brain);
      if (fc) {
        brain = fc.corrected;
        factCheck = { checked: true, corrections: fc.corrections };
      }
    } catch { factCheck = { checked: false }; }

    spec = brainToSpec(brain, topic, {
      durationSec, seedMelody, vocalMode, vocalStyle: vocalStyle as 'bright' | 'warm' | 'choir', seedArrangement,
      fallbackGenre: body.genre, fallbackMood: body.mood,
    });
    if (!normalized) warnings.push('AI output was partially repaired by the validator.');
  }

  const response: LyricsResponse = { spec, provider, factCheck, warnings };
  return NextResponse.json(response);
}

function brainToSpec(
  brain: BrainSong,
  topic: string,
  ctx: {
    durationSec: number;
    seedMelody: number;
    vocalMode: 'synth' | 'tts';
    vocalStyle: 'bright' | 'warm' | 'choir';
    seedArrangement: number;
    fallbackGenre?: string;
    fallbackMood?: string;
  },
): SongSpec {
  const genre = GENRE_IDS.includes(brain.genre as GenreId) ? (brain.genre as GenreId)
    : (ctx.fallbackGenre && ctx.fallbackGenre !== 'auto' && GENRE_IDS.includes(ctx.fallbackGenre as GenreId)) ? (ctx.fallbackGenre as GenreId)
    : 'afrobeats';
  const mood = MOODS.includes(brain.mood as MoodId) ? (brain.mood as MoodId)
    : (ctx.fallbackMood && MOODS.includes(ctx.fallbackMood as MoodId)) ? (ctx.fallbackMood as MoodId)
    : 'upbeat';
  const tempoBpm = typeof brain.tempoBpm === 'number' && brain.tempoBpm >= 60 && brain.tempoBpm <= 140
    ? Math.round(brain.tempoBpm) : 100;
  const key = ['C', 'D', 'F', 'G', 'A', 'Bb'].includes(brain.key ?? '') ? brain.key! : 'C';
  const scale = brain.scale === 'minor' ? 'minor' : 'major';

  let id = 0;
  // Scale AI sections to hit the requested duration (4 beats/bar).
  const totalBarsTarget = Math.max(12, Math.min(88, Math.round((ctx.durationSec * tempoBpm) / 240)));
  const aiBarsSum = brain.sections!.reduce((a, s) => a + (s.bars || 8), 0);
  const k = aiBarsSum > 0 ? totalBarsTarget / aiBarsSum : 1;
  const sections: SectionSpec[] = brain.sections!.map((s) => {
    const scaledBars = Math.max(2, Math.min(16, 2 * Math.round(((s.bars || 8) * k) / 2)));
    return {
      id: `s${id++}`,
      name: (['intro', 'verse', 'prechorus', 'chorus', 'bridge', 'hook', 'outro'].includes(s.name ?? '')
        ? s.name : 'verse') as SectionName,
      bars: scaledBars,
      chords: normalizeChordCount(s.chords?.length ? s.chords : defaultChords(scaledBars, scale), scaledBars),
      density: densityFor(s.name ?? 'verse'),
      lines: (s.lines ?? []).map((l) => ({
        text: l.text ?? '',
        fact: l.fact,
        words: (l.text ?? '').split(/\s+/).filter(Boolean).map((w) => ({ text: w, notes: [] })),
      })),
    };
  });

  return {
    title: brain.title || `${topic} — The SBA Song`,
    topic,
    genre,
    mood,
    tempoBpm,
    key,
    scale,
    vocal: { mode: ctx.vocalMode, style: ctx.vocalStyle, vibrato: mood === 'calm' || mood === 'dreamy' ? 0.5 : 0.35 },
    seeds: { melody: ctx.seedMelody, arrangement: ctx.seedArrangement },
    sections,
    creativeNotes: brain.creativeNotes,
  };
}

function defaultChords(bars: number, scale: string): string[] {
  const prog = scale === 'minor'
    ? ['Am', 'F', 'C', 'G']
    : ['C', 'G', 'Am', 'F'];
  return Array.from({ length: bars }, (_, i) => prog[i % prog.length]);
}

/** Pad or trim the AI's chord list to exactly one chord per bar. */
function normalizeChordCount(chords: string[], bars: number): string[] {
  if (chords.length === 0) return defaultChords(bars, 'major');
  if (chords.length >= bars) return chords.slice(0, bars);
  const out = [...chords];
  while (out.length < bars) out.push(chords[out.length % chords.length]);
  return out;
}

function densityFor(name: string): 'silence' | 'low' | 'mid' | 'full' | 'drop' {
  switch (name) {
    case 'intro': return 'low';
    case 'verse': return 'mid';
    case 'prechorus': return 'mid';
    case 'chorus': return 'full';
    case 'hook': return 'drop';
    case 'bridge': return 'low';
    case 'outro': return 'mid';
    default: return 'mid';
  }
}
