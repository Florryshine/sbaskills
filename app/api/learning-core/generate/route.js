import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Groq from 'groq-sdk';
import { parseJsonFromText as robustParseJsonFromText } from '@/lib/robustJsonParse';

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

const GEMINI_MODELS = [
  'gemini-3.5-flash',
  'gemini-3.5-pro',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
];

// ── Research-only prompt ────────────────────────────────────────────
function buildKnowledgePrompt(keyword, category = 'General') {
  return `You are an expert educational researcher for Shiney Brain Academy.

Research the topic: "${keyword}" (Category: ${category}).

Return ONLY a JSON object with the following fields – no markdown, no extra text, no article.

{
  "topic_type": "learning|advice|news",
  "subject": "e.g. Biology, Chemistry, or General",
  "summary": "A 2-3 sentence overview of the topic",
  "key_concepts": ["concept1", "concept2", ...],
  "definitions": [{"term": "term", "definition": "clear definition"}],
  "examples": ["example1", "example2", ...],
  "facts": ["fact1", "fact2", ...],
  "common_mistakes": ["mistake1", "mistake2", ...],
  "difficulty": 1-5 (1=easy, 5=advanced),
  "tags": ["tag1", "tag2", ...],
  "learning_objectives": ["Define isotopes.", "Differentiate isotopes from isobars.", ...],
  "exam_type": ["JAMB", "WAEC"],
  "estimated_duration_minutes": 20
}`;
}

// ── Helpers ──────────────────────────────────────────────────────────
function parseJsonFromText(text) {
  return robustParseJsonFromText(text, 'object');
}

function isValidKnowledge(r) {
  return (
    r &&
    typeof r.summary === 'string' &&
    r.summary.trim().length > 0 &&
    Array.isArray(r.key_concepts) &&
    r.key_concepts.length > 0
  );
}

// Keeps exam_type values consistent (uppercase, deduped, only known codes)
// regardless of how the model formats them ("jamb", "Post-UTME", etc).
const KNOWN_EXAM_TYPES = ['JAMB', 'WAEC', 'NECO', 'POST_UTME'];
function normalizeExamType(value) {
  if (!Array.isArray(value)) return [];
  const normalized = value
    .map((v) => String(v).trim().toUpperCase().replace(/[\s-]+/g, '_'))
    .map((v) => (v === 'POSTUTME' ? 'POST_UTME' : v));
  return [...new Set(normalized.filter((v) => KNOWN_EXAM_TYPES.includes(v)))];
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

// ── Main POST ──────────────────────────────────────────────────────
export async function POST(request) {
  try {
    const { keyword, category } = await request.json();
    if (!keyword || keyword.trim().length < 2) {
      return NextResponse.json({ error: 'Keyword is required' }, { status: 400 });
    }

    const supabase = createRouteHandlerClient();

    // 1. Check if a knowledge asset already exists for this keyword
    const { data: existing } = await supabase
      .from('knowledge_assets')
      .select('id')
      .eq('keyword', keyword.trim())
      .maybeSingle();

    if (existing) {
      return NextResponse.json({
        success: true,
        knowledgeAssetId: existing.id,
        message: 'Knowledge asset already exists',
      });
    }

    // 2. Build the research prompt
    const prompt = buildKnowledgePrompt(keyword, category);

    // 3. Generate research result
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
              temperature: 0.7,
            },
          });
          const text = genResult.response.text();
          const parsed = parseJsonFromText(text);
          if (isValidKnowledge(parsed)) {
            result = parsed;
            usedProvider = `Gemini (${modelName})`;
          } else {
            errors.push(`Gemini ${modelName}: invalid structure`);
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
            temperature: 0.7,
          });
          const text = groqResponse.choices[0].message.content.trim();
          const parsed = parseJsonFromText(text);
          if (isValidKnowledge(parsed)) {
            result = parsed;
            usedProvider = `Groq (${GROQ_KEYS.indexOf(groqKey) + 1})`;
          } else {
            errors.push('Groq: invalid structure');
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
          if (isValidKnowledge(parsed)) {
            result = parsed;
            usedProvider = 'OpenRouter';
          } else {
            errors.push('OpenRouter: invalid structure');
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
          if (isValidKnowledge(parsed)) {
            result = parsed;
            usedProvider = 'HuggingFace';
          } else {
            errors.push('HuggingFace: invalid structure');
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

    // 4. Insert into knowledge_assets
    const { data: asset, error: assetError } = await supabase
      .from('knowledge_assets')
      .insert({
        keyword: keyword.trim(),
        topic_type: result.topic_type || 'learning',
        subject: result.subject || null,
        summary: result.summary,
        key_concepts: result.key_concepts || [],
        definitions: result.definitions || [],
        examples: result.examples || [],
        facts: result.facts || [],
        common_mistakes: result.common_mistakes || [],
        difficulty: result.difficulty || 3,
        tags: result.tags || [],
        learning_objectives: Array.isArray(result.learning_objectives) ? result.learning_objectives : [],
        exam_type: normalizeExamType(result.exam_type),
        estimated_duration_minutes: Number.isFinite(result.estimated_duration_minutes)
          ? result.estimated_duration_minutes
          : null,
        source: 'ai_generated',
        status: 'approved',
      })
      .select()
      .single();

    if (assetError) {
      return NextResponse.json({ error: assetError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      knowledgeAssetId: asset.id,
      usedProvider,
    });
  } catch (error) {
    console.error('❌ Knowledge generation error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}