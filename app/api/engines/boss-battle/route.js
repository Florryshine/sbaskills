import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Groq from 'groq-sdk';

// ── Keys and providers (same as before) ─────────────────────────────
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

const GEMINI_MODELS = [
  'gemini-3.5-flash',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
];

// ── Helpers (copy from quiz engine) ─────────────────────────────────
function parseJsonFromText(text) {
  const cleaned = text.replace(/```json|```/g, '').trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) return null;
  return JSON.parse(match[0]);
}

async function tryOpenRouter(prompt) {
  if (!OPENROUTER_API_KEY) return null;
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
  return data.choices?.[0]?.message?.content?.trim() || null;
}

async function tryHuggingFace(prompt) {
  if (!HUGGINGFACE_API_KEY) return null;
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
  return data?.[0]?.generated_text?.trim() || null;
}

// ── Boss Battle prompt ──────────────────────────────────────────────
function buildBossBattlePrompt(asset) {
  const keyword = asset.keyword;
  const summary = asset.summary || '';
  const keyConcepts = (asset.key_concepts || []).join(', ');
  const definitions = (asset.definitions || [])
    .map(d => `${d.term}: ${d.definition}`)
    .join('\n');
  const examples = (asset.examples || []).join('\n');
  const facts = (asset.facts || []).join('\n');
  const commonMistakes = (asset.common_mistakes || []).join('\n');

  return `You are an expert exam question designer specialising in "Boss Battle" challenges for Shiney Brain Academy.

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

Generate 10 extremely difficult, challenging multiple‑choice questions that test deep understanding and problem‑solving. These are for students who have already mastered the basics. Questions should be tricky, require reasoning, and often involve common misconceptions or nuanced details.

Each question must have:
- "question": the question text
- "options": an array of exactly 4 strings (A, B, C, D)
- "correct_answer": the correct option (must match one of the options exactly)
- "explanation": a clear, thorough explanation of why the answer is correct (and briefly why others are wrong)
- "difficulty": 4 or 5 (hard or very hard)

Return ONLY a JSON object with a "questions" array of 10 objects. No markdown, no extra text.

Example:
{
  "questions": [
    {
      "question": "If a plant is kept in darkness for 48 hours, which of the following would be most affected?",
      "options": ["Photosynthesis", "Respiration", "Transpiration", "Absorption"],
      "correct_answer": "Photosynthesis",
      "explanation": "Darkness stops photosynthesis because light is needed for the light-dependent reactions. Respiration continues even in darkness.",
      "difficulty": 4
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
      return NextResponse.json({ error: 'Knowledge asset not found' }, { status: 404 });
    }

    // 2. Build prompt
    const prompt = buildBossBattlePrompt(asset);

    // 3. Generate
    let result = null;
    let usedProvider = '';
    const errors = [];

    // Gemini
    for (const geminiKey of GEMINI_KEYS) {
      if (result) break;
      const client = new GoogleGenerativeAI(geminiKey);
      for (const modelName of GEMINI_MODELS) {
        if (result) break;
        try {
          const model = client.getGenerativeModel({ model: modelName });
          const genResult = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
              maxOutputTokens: 4096,
              temperature: 0.8, // slightly more creative for tricky questions
            },
          });
          const text = genResult.response.text();
          const parsed = parseJsonFromText(text);
          if (parsed && Array.isArray(parsed.questions) && parsed.questions.length >= 8) {
            result = parsed;
            usedProvider = `Gemini (${modelName})`;
          } else {
            errors.push(`Gemini ${modelName}: insufficient questions`);
          }
        } catch (e) {
          errors.push(`Gemini ${modelName}: ${e.message}`);
        }
      }
    }

    // Groq fallback
    if (!result) {
      for (const groqKey of GROQ_KEYS) {
        if (result) break;
        try {
          const groq = new Groq({ apiKey: groqKey });
          const groqResponse = await groq.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            model: 'llama-3.3-70b-versatile',
            max_tokens: 4096,
            temperature: 0.8,
          });
          const text = groqResponse.choices[0].message.content.trim();
          const parsed = parseJsonFromText(text);
          if (parsed && Array.isArray(parsed.questions) && parsed.questions.length >= 8) {
            result = parsed;
            usedProvider = `Groq (${GROQ_KEYS.indexOf(groqKey) + 1})`;
          } else {
            errors.push('Groq: insufficient questions');
          }
        } catch (e) {
          errors.push(`Groq: ${e.message}`);
        }
      }
    }

    // OpenRouter fallback
    if (!result) {
      try {
        const text = await tryOpenRouter(prompt);
        if (text) {
          const parsed = parseJsonFromText(text);
          if (parsed && Array.isArray(parsed.questions) && parsed.questions.length >= 8) {
            result = parsed;
            usedProvider = 'OpenRouter';
          } else {
            errors.push('OpenRouter: insufficient questions');
          }
        }
      } catch (e) {
        errors.push(`OpenRouter: ${e.message}`);
      }
    }

    // HuggingFace fallback
    if (!result) {
      try {
        const text = await tryHuggingFace(prompt);
        if (text) {
          const parsed = parseJsonFromText(text);
          if (parsed && Array.isArray(parsed.questions) && parsed.questions.length >= 8) {
            result = parsed;
            usedProvider = 'HuggingFace';
          } else {
            errors.push('HuggingFace: insufficient questions');
          }
        }
      } catch (e) {
        errors.push(`HuggingFace: ${e.message}`);
      }
    }

    if (!result) {
      return NextResponse.json(
        { error: `All providers failed: ${errors.join('; ')}` },
        { status: 500 }
      );
    }

    // 4. Insert into boss_battle_drafts
    const questions = result.questions.slice(0, 10); // max 10
    // Default XP reward: 100 + difficulty bonus (e.g., 20 per difficulty level)
    const avgDifficulty = questions.reduce((sum, q) => sum + (q.difficulty || 3), 0) / questions.length;
    const xpReward = Math.round(100 + (avgDifficulty - 1) * 25);

    const { data: draft, error: draftError } = await supabase
      .from('boss_battle_drafts')
      .insert({
        knowledge_asset_id: asset.id,
        keyword: asset.keyword,
        questions: questions,
        xp_reward: xpReward,
        boss_level: 1,
        time_limit_seconds: 600,
        status: 'draft',
        generated_from: 'knowledge_asset',
        version: 1,
      })
      .select()
      .single();

    if (draftError) {
      return NextResponse.json({ error: draftError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      bossBattleDraftId: draft.id,
      questionCount: questions.length,
      xpReward,
      usedProvider,
    });
  } catch (error) {
    console.error('❌ Boss Battle generation error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}