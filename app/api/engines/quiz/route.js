import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Groq from 'groq-sdk';

// ── Keys and providers ──────────────────────────────────────────────
const GEMINI_KEYS = [
  process.env.GEMINI_API_KEY_1,
  process.env.GEMINI_API_KEY_2,
  process.env.GEMINI_API_KEY,
].filter(Boolean);

const GROQ_KEYS = [
  process.env.GROQ_API_KEY_1,
  process.env.GROQ_API_KEY_2,
  process.env.GROQ_API_KEY,
].filter(Boolean);

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;

// NOTE: gemini-2.0-flash was shut down June 1, 2026 — replaced with gemini-2.5-flash-lite below.
// Verify gemini-3.5-pro is a real model slug for your account/region before relying on it;
// if it 404s, drop it from this list.
const GEMINI_MODELS = [
  'gemini-3.5-flash',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
];

// ── Helpers ──────────────────────────────────────────────────────────
function parseJsonFromText(text) {
  if (!text) return null;
  const cleaned = text.replace(/```json|```/g, '').trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch (e) {
    return null;
  }
}

async function tryGemini(prompt) {
  for (const apiKey of GEMINI_KEYS) {
    for (const modelName of GEMINI_MODELS) {
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: modelName });
        const res = await model.generateContent(prompt);
        const text = res.response.text();
        const parsed = parseJsonFromText(text);
        if (parsed?.questions?.length) {
          return { result: parsed, provider: `gemini:${modelName}` };
        }
      } catch (err) {
        console.error(`Gemini ${modelName} failed:`, err.message);
      }
    }
  }
  return null;
}

async function tryGroq(prompt) {
  for (const apiKey of GROQ_KEYS) {
    try {
      const groq = new Groq({ apiKey });
      const completion = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 4096,
      });
      const text = completion.choices?.[0]?.message?.content;
      const parsed = parseJsonFromText(text);
      if (parsed?.questions?.length) {
        return { result: parsed, provider: 'groq' };
      }
    } catch (err) {
      console.error('Groq failed:', err.message);
    }
  }
  return null;
}

async function tryOpenRouter(prompt) {
  if (!OPENROUTER_API_KEY) return null;
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-3.1-8b-instruct:free',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 4096,
        temperature: 0.7,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content?.trim();
    const parsed = parseJsonFromText(text);
    if (parsed?.questions?.length) {
      return { result: parsed, provider: 'openrouter' };
    }
  } catch (err) {
    console.error('OpenRouter failed:', err.message);
  }
  return null;
}

async function tryHuggingFace(prompt) {
  if (!HUGGINGFACE_API_KEY) return null;
  try {
    const res = await fetch(
      'https://api-inference.huggingface.co/models/meta-llama/Llama-3.1-8B-Instruct',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${HUGGINGFACE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: prompt,
          parameters: { max_new_tokens: 4096, temperature: 0.7, return_full_text: false },
        }),
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const text = data?.[0]?.generated_text?.trim();
    const parsed = parseJsonFromText(text);
    if (parsed?.questions?.length) {
      return { result: parsed, provider: 'huggingface' };
    }
  } catch (err) {
    console.error('HuggingFace failed:', err.message);
  }
  return null;
}

// ── Quiz-specific prompt ────────────────────────────────────────────
function buildQuizPrompt(asset) {
  const keyword = asset.keyword;
  const summary = asset.summary || '';
  const keyConcepts = (asset.key_concepts || []).join(', ');
  const definitions = (asset.definitions || [])
    .map(d => `${d.term}: ${d.definition}`)
    .join('\n');
  const examples = (asset.examples || []).join('\n');
  const facts = (asset.facts || []).join('\n');
  const commonMistakes = (asset.common_mistakes || []).join('\n');

  return `You are an expert exam question writer for Shiney Brain Academy.

Topic: "${keyword}"
Summary: ${summary}
Key Concepts: ${keyConcepts}
Definitions:
${definitions}
Examples:
${examples}
Facts:
${facts}
Common Mistakes:
${commonMistakes}

Generate 20 multiple-choice questions (MCQs) suitable for students preparing for exams like JAMB, WAEC, or NECO.
Each question must have:
- "question": the question text
- "options": an array of exactly 4 strings (A, B, C, D)
- "correct_answer": the correct option (must exactly match one of the options)
- "explanation": a clear explanation of why the answer is correct
- "difficulty": a number from 1 (easy) to 5 (very hard)
- "topic": one of the key concepts (or a suitable sub-topic)
- "points": 1 (default)

Return ONLY a JSON object with a "questions" array of 20 objects. No markdown, no extra text.

Example format:
{
  "questions": [
    {
      "question": "What is the main organ of photosynthesis in plants?",
      "options": ["Root", "Stem", "Leaf", "Flower"],
      "correct_answer": "Leaf",
      "explanation": "Leaves contain chloroplasts with chlorophyll, which capture light energy for photosynthesis.",
      "difficulty": 1,
      "topic": "Photosynthesis",
      "points": 1
    }
  ]
}`;
}

// ── Main POST ──────────────────────────────────────────────────────
export async function POST(request) {
  try {
    const { knowledgeAssetId } = await request.json();
    if (!knowledgeAssetId) {
      return NextResponse.json({ error: 'knowledgeAssetId is required' }, { status: 400 });
    }

    const supabase = createRouteHandlerClient();

    // 1. Fetch asset
    const { data: asset, error: assetError } = await supabase
      .from('knowledge_assets')
      .select('*')
      .eq('id', knowledgeAssetId)
      .single();

    if (assetError || !asset) {
      console.error('Asset fetch error:', assetError);
      return NextResponse.json({ error: 'Knowledge asset not found' }, { status: 404 });
    }

    // 2. Build prompt
    const prompt = buildQuizPrompt(asset);

    // 3. Generate questions — try each provider in order until one succeeds
    let outcome = null;

    outcome = await tryGemini(prompt);
    if (!outcome) outcome = await tryGroq(prompt);
    if (!outcome) outcome = await tryOpenRouter(prompt);
    if (!outcome) outcome = await tryHuggingFace(prompt);

    if (!outcome) {
      console.error('❌ All providers failed to generate quiz questions');
      return NextResponse.json(
        { error: 'All LLM providers failed to generate quiz questions' },
        { status: 500 }
      );
    }

    const { result, provider: usedProvider } = outcome;

    if (!result?.questions?.length) {
      console.error('❌ Provider returned no questions:', usedProvider);
      return NextResponse.json(
        { error: `Provider ${usedProvider} returned no questions` },
        { status: 500 }
      );
    }

    // 4. Insert into quiz_drafts with detailed error logging
    const questions = result.questions.slice(0, 20);
    const estimatedMinutes = Math.ceil(questions.length * 1.2);

    console.log('📝 Attempting to insert quiz draft for asset:', asset.id, 'via', usedProvider);
    console.log('📝 Questions count:', questions.length);

    const { data: draft, error: draftError } = await supabase
      .from('quiz_drafts')
      .insert({
        knowledge_asset_id: asset.id,
        keyword: asset.keyword,
        questions: questions,
        passing_score: 70,
        estimated_minutes: estimatedMinutes,
        status: 'draft',
        generated_from: 'knowledge_asset',
        version: 1,
      })
      .select()
      .single();

    if (draftError) {
      console.error('❌ Quiz draft insert error:', draftError);
      return NextResponse.json(
        {
          error: draftError.message,
          code: draftError.code,
          details: draftError.details,
          hint: draftError.hint,
          questions_sample: questions.slice(0, 2),
        },
        { status: 500 }
      );
    }

    console.log('✅ Quiz draft inserted successfully:', draft.id);

    return NextResponse.json({
      success: true,
      quizDraftId: draft.id,
      questionCount: questions.length,
      usedProvider,
    });
  } catch (error) {
    console.error('❌ Quiz generation error:', error);
    return NextResponse.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
}