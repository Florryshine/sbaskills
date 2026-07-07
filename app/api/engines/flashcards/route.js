import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';   // ← admin client (bypasses RLS)
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

// Updated models – only currently available
const GEMINI_MODELS = [
  'gemini-3.5-flash',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
];

// ── Helpers ──────────────────────────────────────────────────────────
function parseJsonFromText(text) {
  const cleaned = text.replace(/```json|```/g, '').trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) return null;
  return JSON.parse(match[0]);
}

// 🛡️ NEW: sanitize raw control characters that break JSON.parse
function sanitizeJsonString(str) {
  return str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

async function tryOpenRouter(prompt) {
  // ... (same as before)
}

async function tryHuggingFace(prompt) {
  // ... (same as before)
}

// ── Flashcard prompt ────────────────────────────────────────────────
function buildFlashcardPrompt(asset) {
  // ... (same as you have)
}

// ── Main POST ──────────────────────────────────────────────────────
export async function POST(request) {
  try {
    const { knowledgeAssetId } = await request.json();
    if (!knowledgeAssetId) {
      return NextResponse.json({ error: 'knowledgeAssetId is required' }, { status: 400 });
    }

    // ✅ Use admin client – bypasses RLS
    const supabase = createAdminClient();

    const { data: asset, error: assetError } = await supabase
      .from('knowledge_assets')
      .select('*')
      .eq('id', knowledgeAssetId)
      .single();

    if (assetError || !asset) {
      return NextResponse.json({ error: 'Knowledge asset not found' }, { status: 404 });
    }

    const prompt = buildFlashcardPrompt(asset);
    let result = null;
    let usedProvider = '';
    const errors = [];

    // ── Gemini ──────────────────────────────────────────────────────
    for (const geminiKey of GEMINI_KEYS) {
      if (result) break;
      const client = new GoogleGenerativeAI(geminiKey);
      for (const modelName of GEMINI_MODELS) {
        if (result) break;
        try {
          const model = client.getGenerativeModel({ model: modelName });
          const genResult = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 4096, temperature: 0.7 },
          });
          const text = genResult.response.text();
          const cleaned = sanitizeJsonString(text);   // 🧼 sanitize
          const parsed = parseJsonFromText(cleaned);
          if (parsed && Array.isArray(parsed.cards) && parsed.cards.length >= 15) {
            result = parsed;
            usedProvider = `Gemini (${modelName})`;
          } else {
            errors.push(`Gemini ${modelName}: insufficient cards`);
          }
        } catch (e) {
          errors.push(`Gemini ${modelName}: ${e.message}`);
        }
      }
    }

    // ── Groq ────────────────────────────────────────────────────────
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
          const cleaned = sanitizeJsonString(text);   // 🧼 sanitize
          const parsed = parseJsonFromText(cleaned);
          if (parsed && Array.isArray(parsed.cards) && parsed.cards.length >= 15) {
            result = parsed;
            usedProvider = `Groq (${GROQ_KEYS.indexOf(groqKey) + 1})`;
          } else {
            errors.push('Groq: insufficient cards');
          }
        } catch (e) {
          errors.push(`Groq: ${e.message}`);
        }
      }
    }

    // ── OpenRouter ─────────────────────────────────────────────────
    if (!result) {
      try {
        const text = await tryOpenRouter(prompt);
        if (text) {
          const cleaned = sanitizeJsonString(text);
          const parsed = parseJsonFromText(cleaned);
          if (parsed && Array.isArray(parsed.cards) && parsed.cards.length >= 15) {
            result = parsed;
            usedProvider = 'OpenRouter';
          } else {
            errors.push('OpenRouter: insufficient cards');
          }
        }
      } catch (e) {
        errors.push(`OpenRouter: ${e.message}`);
      }
    }

    // ── HuggingFace ────────────────────────────────────────────────
    if (!result) {
      try {
        const text = await tryHuggingFace(prompt);
        if (text) {
          const cleaned = sanitizeJsonString(text);
          const parsed = parseJsonFromText(cleaned);
          if (parsed && Array.isArray(parsed.cards) && parsed.cards.length >= 15) {
            result = parsed;
            usedProvider = 'HuggingFace';
          } else {
            errors.push('HuggingFace: insufficient cards');
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

    const cards = result.cards.slice(0, 30);

    const { data: draft, error: draftError } = await supabase
      .from('flashcard_drafts')
      .insert({
        knowledge_asset_id: asset.id,
        keyword: asset.keyword,
        cards: cards,
        status: 'draft',
        generated_from: 'knowledge_asset',
        version: 1,
      })
      .select()
      .single();

    if (draftError) {
      console.error('❌ Flashcard insert error:', draftError);
      return NextResponse.json({ error: draftError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      flashcardDraftId: draft.id,
      cardCount: cards.length,
      usedProvider,
    });
  } catch (error) {
    console.error('❌ Flashcard generation error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}