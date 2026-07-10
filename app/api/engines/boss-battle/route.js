import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Groq from 'groq-sdk';
import { parseJsonFromText } from '@/lib/robustJsonParse';

// ── Keys ──────────────────────────────────────────────────────────────
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
  'gemini-3.5-pro',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
];


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
      temperature: 0.8,
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
        parameters: { max_new_tokens: 4096, temperature: 0.8, return_full_text: false },
      }),
    }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data?.[0]?.generated_text?.trim() || null;
}

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

Generate 10 extremely difficult, challenging multiple‑choice questions that test deep understanding and problem‑solving. Each question must have:
- "question": the question text
- "options": an array of exactly 4 strings (A, B, C, D)
- "correct_answer": the correct option
- "explanation": a clear, thorough explanation
- "difficulty": 4 or 5

Return ONLY a JSON object with a "questions" array of 10 objects. No markdown, no extra text.`;
}

export async function POST(request) {
  try {
    const { knowledgeAssetId } = await request.json();
    if (!knowledgeAssetId) {
      return NextResponse.json({ error: 'knowledgeAssetId is required' }, { status: 400 });
    }

    const supabase = createAdminClient();

    const { data: asset, error: assetError } = await supabase
      .from('knowledge_assets')
      .select('*')
      .eq('id', knowledgeAssetId)
      .single();

    if (assetError || !asset) {
      return NextResponse.json({ error: 'Knowledge asset not found' }, { status: 404 });
    }

    const prompt = buildBossBattlePrompt(asset);
    let result = null;
    let usedProvider = '';
    const errors = [];

    // Generation loop same pattern as quiz – but we'll keep it concise
    // (The logic is identical; only the prompt and insert differ.)
    // I'll include the loop but you can copy from quiz.

    for (const geminiKey of GEMINI_KEYS) {
      if (result) break;
      const client = new GoogleGenerativeAI(geminiKey);
      for (const modelName of GEMINI_MODELS) {
        if (result) break;
        try {
          const model = client.getGenerativeModel({ model: modelName });
          const genResult = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 4096, temperature: 0.8 },
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

    const questions = result.questions.slice(0, 10);
    const avgDifficulty = questions.reduce((sum, q) => sum + (q.difficulty || 3), 0) / questions.length;
    const xpReward = Math.round(100 + (avgDifficulty - 1) * 25);

    const { data: draft, error: draftError } = await supabase
      .from('boss_battle_drafts')
      .insert({
        knowledge_asset_id: asset.id,
        keyword: asset.keyword,
        name: asset.keyword,
        subject: asset.subject || '',
        topic: '',
        difficulty: Math.round(avgDifficulty),
        health: 100,
        required_level: 1,
        required_xp: 0,
        xp_reward: xpReward,
        reward_coins: 50,
        questions: questions,
        boss_level: 1,
        time_limit_seconds: 600,
        status: 'draft',
        generated_from: 'knowledge_asset',
        version: 1,
      })
      .select()
      .single();

    if (draftError) {
      console.error('❌ Boss Battle insert error:', draftError);
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
    console.error('❌ Boss Battle error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}